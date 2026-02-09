import { ClientConnection } from './ClientConnection';
import { GameEngine } from '../src/core/GameEngine';
import { GamePhase, AIPersonality } from '../src/types';
import { CHARACTER_DEFS } from '../src/constants';
import { LobbyPlayer, GameEvent, ServerMessage } from '../src/shared/protocol';

const MAX_PLAYERS = 4;
const ACTION_TIMEOUT_MS = 30000;

export class Room {
  code: string;
  hostId: string;
  clients: Map<string, ClientConnection> = new Map();
  lobbyPlayers: LobbyPlayer[] = [];
  engine: GameEngine | null = null;
  roomState: 'lobby' | 'playing' | 'finished' = 'lobby';
  // Maps engine player index -> client ID (null for AI)
  private playerClientMap: Map<number, string | null> = new Map();
  private eventBuffer: GameEvent[] = [];
  private actionTimeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectedPlayers: Set<string> = new Set();

  constructor(code: string, host: ClientConnection, playerName: string) {
    this.code = code;
    this.hostId = host.id;
    this.addClient(host, playerName);
  }

  canJoin(): boolean {
    return this.roomState === 'lobby' && this.lobbyPlayers.length < MAX_PLAYERS;
  }

  addClient(client: ClientConnection, playerName: string) {
    client.roomCode = this.code;
    client.room = this;
    client.playerName = playerName;
    this.clients.set(client.id, client);

    const lobbyPlayer: LobbyPlayer = {
      id: client.id,
      name: playerName,
      characterIndex: null,
      isHost: client.id === this.hostId,
    };
    this.lobbyPlayers.push(lobbyPlayer);

    if (client.id === this.hostId) {
      client.send({ type: 'roomCreated', roomCode: this.code, playerId: client.id });
    } else {
      client.send({ type: 'roomJoined', roomCode: this.code, playerId: client.id, players: this.lobbyPlayers });
      this.broadcast({ type: 'playerJoined', player: lobbyPlayer, players: this.lobbyPlayers }, client.id);
    }
  }

  handleCharacterSelect(client: ClientConnection, characterIndex: number) {
    if (this.roomState !== 'lobby') return;
    if (characterIndex < 0 || characterIndex >= CHARACTER_DEFS.length) return;

    // Check if character already taken
    const taken = this.lobbyPlayers.some(p => p.characterIndex === characterIndex && p.id !== client.id);
    if (taken) {
      client.send({ type: 'error', message: '该角色已被选择' });
      return;
    }

    const lp = this.lobbyPlayers.find(p => p.id === client.id);
    if (lp) lp.characterIndex = characterIndex;

    this.broadcastAll({ type: 'characterSelected', playerId: client.id, characterIndex, players: this.lobbyPlayers });
  }

  handleStartGame(client: ClientConnection) {
    if (client.id !== this.hostId) return;
    if (this.roomState !== 'lobby') return;

    // All players must have selected a character
    const ready = this.lobbyPlayers.every(p => p.characterIndex !== null);
    if (!ready) {
      client.send({ type: 'error', message: '所有玩家必须选择角色' });
      return;
    }

    this.startGame();
  }
  private startGame() {
    this.roomState = 'playing';
    this.engine = new GameEngine();

    // Build player configs: humans first (lobby players), then AI for remaining slots
    const usedCharIndices = new Set(this.lobbyPlayers.map(p => p.characterIndex!));
    const aiCharIndices = CHARACTER_DEFS.map((_, i) => i).filter(i => !usedCharIndices.has(i));
    const personalities = [AIPersonality.AGGRESSIVE, AIPersonality.CONSERVATIVE, AIPersonality.BALANCED];

    const configs: { name: string; characterId: string; isHuman: boolean; personality: AIPersonality | null }[] = [];

    // Human players
    this.lobbyPlayers.forEach((lp, i) => {
      const charDef = CHARACTER_DEFS[lp.characterIndex!];
      configs.push({ name: lp.name || charDef.name, characterId: charDef.id, isHuman: true, personality: null });
    });

    // AI players to fill remaining slots
    let aiIdx = 0;
    while (configs.length < MAX_PLAYERS && aiIdx < aiCharIndices.length) {
      const charDef = CHARACTER_DEFS[aiCharIndices[aiIdx]];
      configs.push({ name: charDef.name, characterId: charDef.id, isHuman: false, personality: personalities[aiIdx % personalities.length] });
      aiIdx++;
    }

    this.engine.setupPlayers(configs);

    // Map player indices to client IDs
    this.lobbyPlayers.forEach((lp, i) => {
      this.playerClientMap.set(i, lp.id);
      const client = this.clients.get(lp.id);
      if (client) client.playerIndex = i;
    });
    for (let i = this.lobbyPlayers.length; i < configs.length; i++) {
      this.playerClientMap.set(i, null);
    }

    // Send gameStarted with each player's index
    for (const [clientId, client] of this.clients) {
      client.send({ type: 'gameStarted', playerIndex: client.playerIndex });
    }

    // Register event listener
    this.engine.on((event, data) => {
      this.eventBuffer.push({ event, data });
    });

    // Broadcast state on every delay point and when waiting for input
    this.engine.onDelay = () => {
      this.broadcastState();
    };
    this.engine.onWaitingForInput = () => {
      this.broadcastState();
      this.setupActionTimeout();
    };

    // Broadcast initial state so clients see the board
    this.broadcastState();

    // Run game loop
    this.runGameLoop();
  }

  private async runGameLoop() {
    if (!this.engine) return;
    while ((this.engine.state.phase as GamePhase) !== GamePhase.GAME_OVER) {
      // Before each turn, check if current human player is disconnected → treat as AI
      const player = this.engine.state.players[this.engine.state.currentPlayerIndex];
      if (player.isHuman) {
        const clientId = this.playerClientMap.get(player.index);
        if (clientId && this.disconnectedPlayers.has(clientId)) {
          // Temporarily make AI-controlled
          player.isHuman = false;
          player.personality = AIPersonality.BALANCED;
          await this.engine.executeTurn();
          player.isHuman = true;
          player.personality = null;
          this.broadcastState();
          continue;
        }
      }

      // Run the turn (timeouts are set via onWaitingForInput hook)
      await this.engine.executeTurn();
      this.clearActionTimeout();
      this.broadcastState();
    }
    this.roomState = 'finished';
  }
  handleAction(client: ClientConnection, action: string) {
    if (!this.engine || this.roomState !== 'playing') return;
    const currentIdx = this.engine.state.currentPlayerIndex;
    const expectedClientId = this.playerClientMap.get(currentIdx);
    if (expectedClientId !== client.id) return;

    this.clearActionTimeout();
    this.engine.handleAction(action);
  }

  handleDisconnect(client: ClientConnection) {
    this.clients.delete(client.id);

    if (this.roomState === 'lobby') {
      this.lobbyPlayers = this.lobbyPlayers.filter(p => p.id !== client.id);
      if (client.id === this.hostId && this.lobbyPlayers.length > 0) {
        this.hostId = this.lobbyPlayers[0].id;
        this.lobbyPlayers[0].isHost = true;
      }
      this.broadcastAll({ type: 'playerLeft', playerId: client.id, players: this.lobbyPlayers });
    } else if (this.roomState === 'playing') {
      this.disconnectedPlayers.add(client.id);
      // If it's this player's turn and engine is waiting, auto-act
      if (this.engine) {
        const currentIdx = this.engine.state.currentPlayerIndex;
        const expectedClientId = this.playerClientMap.get(currentIdx);
        if (expectedClientId === client.id) {
          this.clearActionTimeout();
          this.autoAct();
        }
      }
    }
  }

  private setupActionTimeout() {
    this.clearActionTimeout();
    if (!this.engine) return;
    const player = this.engine.state.players[this.engine.state.currentPlayerIndex];
    if (!player.isHuman) return;

    this.actionTimeout = setTimeout(() => {
      this.autoAct();
    }, ACTION_TIMEOUT_MS);
  }

  private clearActionTimeout() {
    if (this.actionTimeout) {
      clearTimeout(this.actionTimeout);
      this.actionTimeout = null;
    }
  }

  private autoAct() {
    if (!this.engine) return;
    const phase = this.engine.state.phase;
    if (phase === GamePhase.WAITING) {
      this.engine.handleAction('roll');
    } else if (phase === GamePhase.PLAYER_DECISION) {
      this.engine.handleAction('pass');
    }
  }

  private broadcastState() {
    if (!this.engine) return;
    const msg: ServerMessage = {
      type: 'gameState',
      state: this.engine.state,
      events: [...this.eventBuffer],
    };
    this.eventBuffer = [];
    for (const client of this.clients.values()) {
      client.send(msg);
    }
  }

  private broadcast(msg: ServerMessage, excludeId?: string) {
    for (const [id, client] of this.clients) {
      if (id !== excludeId) client.send(msg);
    }
  }

  private broadcastAll(msg: ServerMessage) {
    for (const client of this.clients.values()) {
      client.send(msg);
    }
  }

  get isEmpty(): boolean {
    return this.clients.size === 0;
  }
}
