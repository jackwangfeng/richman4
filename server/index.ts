import { WebSocketServer } from 'ws';
import { RoomManager } from './RoomManager';
import { ClientConnection } from './ClientConnection';
import { ClientMessage } from '../src/shared/protocol';

const PORT = parseInt(process.env.PORT || '3000');
const wss = new WebSocketServer({ port: PORT });
const roomManager = new RoomManager();

wss.on('listening', () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

wss.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: PORT=3001 npm run server`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

wss.on('connection', (ws) => {
  const client = new ClientConnection(ws);
  console.log(`Client connected: ${client.id}`);

  ws.on('message', (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString());
      handleMessage(client, msg);
    } catch (e) {
      client.send({ type: 'error', message: '无效消息' });
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${client.id}`);
    if (client.room) {
      client.room.handleDisconnect(client);
      if (client.room.isEmpty) {
        roomManager.removeRoom(client.room.code);
        console.log(`Room ${client.room.code} removed (empty)`);
      }
    }
  });
});

function handleMessage(client: ClientConnection, msg: ClientMessage) {
  switch (msg.type) {
    case 'createRoom': {
      const room = roomManager.createRoom(client, msg.playerName);
      console.log(`Room ${room.code} created by ${msg.playerName}`);
      break;
    }
    case 'joinRoom': {
      const room = roomManager.joinRoom(msg.roomCode, client, msg.playerName);
      if (!room) {
        client.send({ type: 'error', message: '房间不存在或已满' });
      } else {
        console.log(`${msg.playerName} joined room ${room.code}`);
      }
      break;
    }
    case 'selectCharacter':
      client.room?.handleCharacterSelect(client, msg.characterIndex);
      break;
    case 'startGame':
      client.room?.handleStartGame(client);
      break;
    case 'action':
      client.room?.handleAction(client, msg.action);
      break;
  }
}
