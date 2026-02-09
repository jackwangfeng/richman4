import { Board } from '../core/Board';
import { GameEngine } from '../core/GameEngine';
import { BoardRenderer } from './BoardRenderer';
import { TokenRenderer } from './TokenRenderer';
import { DiceRenderer } from './DiceRenderer';
import { UIRenderer } from './UIRenderer';
import { AnimationManager } from './AnimationManager';
import { AudioManager } from '../audio/AudioManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CHARACTER_DEFS } from '../constants';
import { GamePhase, GameState } from '../types';

export interface StateSource {
  state: GameState;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private board: Board;
  private stateSource: StateSource;
  private boardRenderer: BoardRenderer;
  tokenRenderer: TokenRenderer;
  diceRenderer: DiceRenderer;
  uiRenderer: UIRenderer;
  private animManager: AnimationManager;
  audioManager: AudioManager;
  prevPositions: number[] = [0, 0, 0, 0];

  constructor(canvas: HTMLCanvasElement, board: Board, stateSource: StateSource) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    this.ctx = canvas.getContext('2d')!;
    this.board = board;
    this.stateSource = stateSource;
    this.boardRenderer = new BoardRenderer(board);
    this.tokenRenderer = new TokenRenderer(
      board,
      (id) => this.uiRenderer.getCharacterImage(id),
      (id, frame) => this.uiRenderer.getWalkFrame(id, frame),
    );
    this.diceRenderer = new DiceRenderer();
    this.uiRenderer = new UIRenderer();
    this.animManager = new AnimationManager();
    this.audioManager = new AudioManager();
  }

  /** Wire engine events to animation triggers (for single-player mode) */
  wireEngine(engine: GameEngine) {
    engine.on((event, data) => {
      this.handleEvent(event, data);
    });
  }

  /** Handle a game event (from engine or network) */
  handleEvent(event: string, data?: any) {
    const state = this.stateSource.state;

    if (event === 'diceRolled') {
      this.diceRenderer.startAnimation(data);
      this.audioManager.playSound('dice');
      // Voice for current player
      const player = state.players[state.currentPlayerIndex];
      if (player) {
        this.audioManager.playVoice(player.characterId, 'roll');
      }
    }
    if (event === 'playerStep') {
      const { playerIndex, position, fromPos } = data;
      const from = fromPos !== undefined ? fromPos : this.prevPositions[playerIndex];
      this.tokenRenderer.animateStep(playerIndex, from, position);
      this.prevPositions[playerIndex] = position;
      this.audioManager.playSound('step');
    }
    if (event === 'turnChange') {
      const player = state.players[data];
      if (player && player.isHuman) {
        this.audioManager.playSound('turnStart');
        this.audioManager.playVoice(player.characterId, 'turnStart');
      }
    }
    if (event === 'phaseChange') {
      if (data === GamePhase.GAME_OVER) {
        this.audioManager.playSound('victory');
        const winner = state.players[state.winner];
        if (winner) {
          this.audioManager.playVoice(winner.characterId, 'win');
        }
      }
      if (data === GamePhase.PLAYER_DECISION) {
        this.audioManager.playSound('click');
      }
    }
    if (event === 'propertyBought') {
      this.audioManager.playSound('buy');
      const player = state.players[data.playerIndex];
      if (player) {
        this.audioManager.playVoice(player.characterId, 'buyProperty');
      }
    }
    if (event === 'rentPaid') {
      this.audioManager.playSound('rent');
      const payer = state.players[data.payerIndex];
      const owner = state.players[data.ownerIndex];
      if (payer) {
        this.audioManager.playVoice(payer.characterId, 'payRent');
      }
      // Owner gets rent voice after a short delay
      if (owner) {
        setTimeout(() => {
          this.audioManager.playVoice(owner.characterId, 'getRent');
        }, 1200);
      }
    }
    if (event === 'passedGo') {
      this.audioManager.playSound('coin');
      const player = state.players[data.playerIndex];
      if (player) {
        this.audioManager.playVoice(player.characterId, 'passGo');
      }
    }
    if (event === 'goToJail') {
      this.audioManager.playSound('jail');
      const player = state.players[data.playerIndex];
      if (player) {
        this.audioManager.playVoice(player.characterId, 'goToJail');
      }
    }
    if (event === 'jailEscape') {
      const player = state.players[data.playerIndex];
      if (player) {
        this.audioManager.playVoice(player.characterId, 'escapeJail');
      }
    }
    if (event === 'chanceCard') {
      this.audioManager.playSound('chance');
      const player = state.players[data.playerIndex];
      if (player) {
        const voiceId = data.money >= 0 ? 'chancePlus' : 'chanceMinus';
        this.audioManager.playVoice(player.characterId, voiceId);
      }
    }
    if (event === 'bankrupt') {
      this.audioManager.playSound('bankrupt');
      const player = state.players[data.playerIndex];
      if (player) {
        this.audioManager.playVoice(player.characterId, 'bankrupt');
      }
    }
    if (event === 'buildProperty') {
      this.audioManager.playSound('build');
    }
    if (event === 'characterSelected') {
      this.audioManager.playSound('click');
      const charDef = CHARACTER_DEFS[data.charIndex];
      if (charDef) {
        this.audioManager.playVoice(charDef.id, 'select');
      }
    }
  }

  start() {
    const loop = (now: number) => {
      this.animManager.update(now);
      this.render(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private render(now: number) {
    const ctx = this.ctx;
    const state = this.stateSource.state;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (state.phase === GamePhase.CHARACTER_SELECT) {
      this.uiRenderer.draw(ctx, state);
      return;
    }

    this.boardRenderer.draw(ctx, state, state.currentPlayerIndex);
    this.tokenRenderer.draw(ctx, state);
    this.diceRenderer.draw(ctx, now, state.dice);
    this.uiRenderer.draw(ctx, state);
  }
}
