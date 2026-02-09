import { Board } from './core/Board';
import { GameEngine } from './core/GameEngine';
import { Renderer } from './render/Renderer';
import { LobbyUI } from './net/LobbyUI';
import { ClientStateHolder } from './net/ClientStateHolder';
import { GameEvent } from './shared/protocol';

async function main() {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Show lobby to choose mode
  const lobby = new LobbyUI();
  const result = await lobby.run();

  const board = new Board();

  if (result.mode === 'single') {
    // === Single-player mode (existing flow) ===
    const engine = new GameEngine();
    const renderer = new Renderer(canvas, board, engine);
    await renderer.uiRenderer.loadCharacterImages();
    renderer.wireEngine(engine);

    canvas.addEventListener('click', (e) => {
      renderer.audioManager.unlock();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const btn = renderer.uiRenderer.getButtonAt(x, y);
      if (btn) {
        if (btn.action.startsWith('select_')) {
          const charIndex = parseInt(btn.action.split('_')[1]);
          engine.handleCharacterSelect(charIndex);
        } else if (btn.action === 'toggleAutoPlay') {
          engine.toggleAutoPlay(0); // Player 0 is always the human player
        } else {
          engine.handleAction(btn.action);
        }
      }
    });

    // Mouse move for hover effects
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      renderer.uiRenderer.hoveredButton = renderer.uiRenderer.getButtonAt(x, y);
    });

    canvas.addEventListener('mouseleave', () => {
      renderer.uiRenderer.hoveredButton = null;
    });

    renderer.start();
    engine.startGame();
  } else {
    // === Multiplayer mode ===
    const networkClient = result.networkClient!;
    const localPlayerIndex = result.localPlayerIndex!;

    const stateHolder = new ClientStateHolder();
    const renderer = new Renderer(canvas, board, stateHolder);
    renderer.uiRenderer.localPlayerIndex = localPlayerIndex;

    // Register state handler BEFORE loading images to avoid missing early messages
    networkClient.on('gameState', (msg: any) => {
      stateHolder.state = msg.state;
      const events: GameEvent[] = msg.events || [];
      for (const evt of events) {
        renderer.handleEvent(evt.event, evt.data);
      }
    });

    await renderer.uiRenderer.loadCharacterImages();

    // Send actions to server
    canvas.addEventListener('click', (e) => {
      renderer.audioManager.unlock();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const btn = renderer.uiRenderer.getButtonAt(x, y);
      if (btn) {
        networkClient.send({ type: 'action', action: btn.action });
      }
    });

    // Mouse move for hover effects
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      renderer.uiRenderer.hoveredButton = renderer.uiRenderer.getButtonAt(x, y);
    });

    canvas.addEventListener('mouseleave', () => {
      renderer.uiRenderer.hoveredButton = null;
    });

    renderer.start();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => main());
} else {
  main();
}
