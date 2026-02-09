import { Room } from './Room';
import { ClientConnection } from './ClientConnection';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(client: ClientConnection, playerName: string): Room {
    const code = this.generateCode();
    const room = new Room(code, client, playerName);
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, client: ClientConnection, playerName: string): Room | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    if (!room.canJoin()) return null;
    room.addClient(client, playerName);
    return room;
  }

  removeRoom(code: string) {
    this.rooms.delete(code);
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }
}
