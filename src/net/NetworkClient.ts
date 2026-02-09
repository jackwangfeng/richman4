import { ClientMessage, ServerMessage } from '../shared/protocol';

type MessageHandler = (msg: ServerMessage) => void;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
      this.ws.onmessage = (e) => {
        try {
          const msg: ServerMessage = JSON.parse(e.data as string);
          this.dispatch(msg);
        } catch {}
      };
      this.ws.onclose = () => {
        this.dispatch({ type: 'error', message: '连接已断开' });
      };
    });
  }

  send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(type: string, handler: MessageHandler) {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  off(type: string, handler: MessageHandler) {
    const list = this.handlers.get(type);
    if (list) {
      this.handlers.set(type, list.filter(h => h !== handler));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private dispatch(msg: ServerMessage) {
    const list = this.handlers.get(msg.type);
    if (list) {
      for (const h of list) h(msg);
    }
    // Also dispatch to '*' wildcard handlers
    const all = this.handlers.get('*');
    if (all) {
      for (const h of all) h(msg);
    }
  }
}
