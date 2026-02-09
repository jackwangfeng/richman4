import { GameState } from '../types';

// ===== Lobby =====

export interface LobbyPlayer {
  id: string;
  name: string;
  characterIndex: number | null;
  isHost: boolean;
}

export interface GameEvent {
  event: string;
  data?: any;
}

// ===== Client → Server =====

export type ClientMessage =
  | { type: 'createRoom'; playerName: string }
  | { type: 'joinRoom'; roomCode: string; playerName: string }
  | { type: 'selectCharacter'; characterIndex: number }
  | { type: 'startGame' }
  | { type: 'action'; action: string };

// ===== Server → Client =====

export type ServerMessage =
  | { type: 'roomCreated'; roomCode: string; playerId: string }
  | { type: 'roomJoined'; roomCode: string; playerId: string; players: LobbyPlayer[] }
  | { type: 'playerJoined'; player: LobbyPlayer; players: LobbyPlayer[] }
  | { type: 'playerLeft'; playerId: string; players: LobbyPlayer[] }
  | { type: 'characterSelected'; playerId: string; characterIndex: number; players: LobbyPlayer[] }
  | { type: 'gameStarted'; playerIndex: number }
  | { type: 'gameState'; state: GameState; events: GameEvent[] }
  | { type: 'error'; message: string };
