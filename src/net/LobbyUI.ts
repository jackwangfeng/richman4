import { NetworkClient } from './NetworkClient';
import { CHARACTER_DEFS } from '../constants';
import { LobbyPlayer, ServerMessage } from '../shared/protocol';

export interface LobbyResult {
  mode: 'single' | 'multi';
  networkClient?: NetworkClient;
  localPlayerIndex?: number;
}

export class LobbyUI {
  private container: HTMLDivElement;
  private networkClient: NetworkClient | null = null;
  private resolve: ((result: LobbyResult) => void) | null = null;
  private playerId: string = '';
  private isHost: boolean = false;
  private lobbyPlayers: LobbyPlayer[] = [];
  private selectedCharIndex: number | null = null;
  private roomCode: string = '';

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'lobby-overlay';
    this.applyContainerStyle();
    document.body.appendChild(this.container);
  }

  run(): Promise<LobbyResult> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.showMainMenu();
    });
  }

  destroy() {
    this.container.remove();
  }
  private showMainMenu() {
    this.container.innerHTML = `
      <div class="lobby-card">
        <h1>大富翁4</h1>
        <div class="lobby-field">
          <label>你的名字</label>
          <input type="text" id="lobby-name" value="玩家" maxlength="8" />
        </div>
        <button class="lobby-btn primary" id="btn-single">单人游戏</button>
        <button class="lobby-btn" id="btn-create">创建房间</button>
        <div class="lobby-row">
          <input type="text" id="lobby-code" placeholder="房间号" maxlength="4" style="width:100px;text-transform:uppercase" />
          <button class="lobby-btn" id="btn-join">加入房间</button>
        </div>
      </div>
    `;
    this.container.querySelector('#btn-single')!.addEventListener('click', () => {
      this.destroy();
      this.resolve?.({ mode: 'single' });
    });
    this.container.querySelector('#btn-create')!.addEventListener('click', () => this.doCreate());
    this.container.querySelector('#btn-join')!.addEventListener('click', () => this.doJoin());
    // Enter key on code input
    this.container.querySelector('#lobby-code')!.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') this.doJoin();
    });
  }

  private getName(): string {
    const input = this.container.querySelector('#lobby-name') as HTMLInputElement;
    return input?.value.trim() || '玩家';
  }

  private getCode(): string {
    const input = this.container.querySelector('#lobby-code') as HTMLInputElement;
    return input?.value.trim().toUpperCase() || '';
  }

  private async doCreate() {
    const name = this.getName();
    await this.connectWS();
    this.isHost = true;

    this.networkClient!.on('roomCreated', (msg: any) => {
      this.playerId = msg.playerId;
      this.roomCode = msg.roomCode;
      this.lobbyPlayers = [{ id: this.playerId, name, characterIndex: null, isHost: true }];
      this.showLobby();
    });

    this.setupLobbyHandlers();
    this.networkClient!.send({ type: 'createRoom', playerName: name });
  }

  private async doJoin() {
    const name = this.getName();
    const code = this.getCode();
    if (!code) return;

    await this.connectWS();
    this.isHost = false;

    this.networkClient!.on('roomJoined', (msg: any) => {
      this.playerId = msg.playerId;
      this.roomCode = msg.roomCode;
      this.lobbyPlayers = msg.players;
      this.showLobby();
    });

    this.setupLobbyHandlers();
    this.networkClient!.send({ type: 'joinRoom', roomCode: code, playerName: name });
  }

  private async connectWS() {
    const wsUrl = `ws://${window.location.hostname}:3000`;
    this.networkClient = new NetworkClient(wsUrl);
    await this.networkClient.connect();

    this.networkClient.on('error', (msg: any) => {
      alert(msg.message || '连接错误');
    });
  }

  private setupLobbyHandlers() {
    this.networkClient!.on('playerJoined', (msg: any) => {
      this.lobbyPlayers = msg.players;
      this.updateLobbyUI();
    });
    this.networkClient!.on('playerLeft', (msg: any) => {
      this.lobbyPlayers = msg.players;
      this.updateLobbyUI();
    });
    this.networkClient!.on('characterSelected', (msg: any) => {
      this.lobbyPlayers = msg.players;
      this.updateLobbyUI();
    });
    this.networkClient!.on('gameStarted', (msg: any) => {
      this.destroy();
      this.resolve?.({
        mode: 'multi',
        networkClient: this.networkClient!,
        localPlayerIndex: msg.playerIndex,
      });
    });
  }
  private showLobby() {
    const charCards = CHARACTER_DEFS.map((ch, i) => {
      return `<div class="char-card" data-idx="${i}">
        <img src="${ch.imagePath}" alt="${ch.name}" />
        <div class="char-name">${ch.name}</div>
        <div class="char-desc">${ch.description}</div>
      </div>`;
    }).join('');

    this.container.innerHTML = `
      <div class="lobby-card wide">
        <h2>房间: <span class="room-code">${this.roomCode}</span></h2>
        <div class="lobby-section">
          <h3>选择角色</h3>
          <div class="char-grid">${charCards}</div>
        </div>
        <div class="lobby-section">
          <h3>玩家列表</h3>
          <div id="player-list"></div>
        </div>
        ${this.isHost ? '<button class="lobby-btn primary" id="btn-start">开始游戏</button>' : '<p class="wait-text">等待房主开始游戏...</p>'}
      </div>
    `;

    // Character selection clicks
    this.container.querySelectorAll('.char-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt((card as HTMLElement).dataset.idx!);
        this.selectedCharIndex = idx;
        this.networkClient!.send({ type: 'selectCharacter', characterIndex: idx });
      });
    });

    if (this.isHost) {
      this.container.querySelector('#btn-start')!.addEventListener('click', () => {
        this.networkClient!.send({ type: 'startGame' });
      });
    }

    this.updateLobbyUI();
  }

  private updateLobbyUI() {
    const listEl = this.container.querySelector('#player-list');
    if (listEl) {
      listEl.innerHTML = this.lobbyPlayers.map(p => {
        const charName = p.characterIndex !== null ? CHARACTER_DEFS[p.characterIndex].name : '未选择';
        const hostTag = p.isHost ? ' (房主)' : '';
        return `<div class="player-item">
          <span class="player-name">${p.name}${hostTag}</span>
          <span class="player-char">${charName}</span>
        </div>`;
      }).join('');
    }

    // Update character card states
    const takenIndices = new Set(this.lobbyPlayers.filter(p => p.characterIndex !== null).map(p => p.characterIndex));
    const myChar = this.lobbyPlayers.find(p => p.id === this.playerId)?.characterIndex;

    this.container.querySelectorAll('.char-card').forEach(card => {
      const idx = parseInt((card as HTMLElement).dataset.idx!);
      card.classList.remove('selected', 'taken');
      if (idx === myChar) {
        card.classList.add('selected');
      } else if (takenIndices.has(idx)) {
        card.classList.add('taken');
      }
    });
  }
  private applyContainerStyle() {
    const s = this.container.style;
    s.position = 'fixed';
    s.top = '0';
    s.left = '0';
    s.width = '100%';
    s.height = '100%';
    s.background = 'rgba(26,26,46,0.97)';
    s.display = 'flex';
    s.alignItems = 'center';
    s.justifyContent = 'center';
    s.zIndex = '1000';
    s.fontFamily = '"Microsoft YaHei", sans-serif';
    s.color = '#fff';

    // Inject styles
    if (!document.getElementById('lobby-styles')) {
      const style = document.createElement('style');
      style.id = 'lobby-styles';
      style.textContent = LOBBY_CSS;
      document.head.appendChild(style);
    }
  }
}

const LOBBY_CSS = `
  .lobby-card {
    background: #2a2a4a;
    border-radius: 16px;
    padding: 32px 40px;
    text-align: center;
    min-width: 320px;
  }
  .lobby-card.wide { min-width: 600px; max-width: 700px; }
  .lobby-card h1 { color: #f1c40f; font-size: 36px; margin: 0 0 24px; }
  .lobby-card h2 { color: #fff; font-size: 22px; margin: 0 0 16px; }
  .lobby-card h3 { color: #aaa; font-size: 16px; margin: 0 0 12px; }
  .room-code { color: #f1c40f; font-size: 28px; letter-spacing: 4px; }
  .lobby-field { margin-bottom: 16px; text-align: left; }
  .lobby-field label { display: block; color: #aaa; font-size: 14px; margin-bottom: 4px; }
  .lobby-field input, #lobby-code {
    background: #1a1a2e; border: 1px solid #555; border-radius: 6px;
    color: #fff; padding: 8px 12px; font-size: 16px; outline: none;
    font-family: "Microsoft YaHei", sans-serif;
  }
  .lobby-field input:focus, #lobby-code:focus { border-color: #f1c40f; }
  .lobby-btn {
    display: block; width: 100%; padding: 12px; margin: 8px 0;
    border: none; border-radius: 8px; font-size: 16px; cursor: pointer;
    background: #3a3a5a; color: #fff;
    font-family: "Microsoft YaHei", sans-serif;
    transition: background 0.2s;
  }
  .lobby-btn:hover { background: #4a4a6a; }
  .lobby-btn.primary { background: #4CAF50; }
  .lobby-btn.primary:hover { background: #388E3C; }
  .lobby-row {
    display: flex; gap: 8px; align-items: center; margin-top: 16px;
  }
  .lobby-row .lobby-btn { width: auto; flex: 1; margin: 0; }
  .char-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;
  }
  .char-card {
    background: #1a1a2e; border: 2px solid #555; border-radius: 10px;
    padding: 12px; cursor: pointer; transition: border-color 0.2s, opacity 0.2s;
  }
  .char-card:hover { border-color: #f1c40f; }
  .char-card.selected { border-color: #4CAF50; border-width: 3px; }
  .char-card.taken { opacity: 0.4; pointer-events: none; }
  .char-card img { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; }
  .char-name { color: #fff; font-weight: bold; margin-top: 6px; }
  .char-desc { color: #aaa; font-size: 12px; }
  .lobby-section { margin-bottom: 16px; }
  .player-item {
    display: flex; justify-content: space-between; padding: 6px 12px;
    background: #1a1a2e; border-radius: 6px; margin-bottom: 4px;
  }
  .player-name { color: #fff; }
  .player-char { color: #f1c40f; }
  .wait-text { color: #aaa; font-size: 14px; }
`;
