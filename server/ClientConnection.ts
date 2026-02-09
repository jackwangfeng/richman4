import { WebSocket } from 'ws';
import { ServerMessage } from '../src/shared/protocol';
import type { Room } from './Room';

let nextId = 1;

export class ClientConnection {
  id: string;
  ws: WebSocket;
  playerName: string = '';
  playerIndex: number = -1;
  roomCode: string | null = null;
  room: Room | null = null;

  constructor(ws: WebSocket) {
    this.id = String(nextId++);
    this.ws = ws;
  }

  send(msg: ServerMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
