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
          engine.toggleAutoPlay(0);
        } else if (btn.action === 'toggleSettings') {
          renderer.uiRenderer.toggleSettingsPanel();
          renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
        } else if (btn.action === 'toggleStockPanel') {
          renderer.uiRenderer.toggleStockPanel();
        } else if (btn.action === 'closeStockPanel') {
          renderer.uiRenderer.toggleStockPanel();
        } else if (btn.action.startsWith('selectStock_')) {
          const stockId = btn.action.split('_')[1];
          renderer.uiRenderer.selectedStock = stockId;
        } else if (btn.action === 'toggleSound') {
          renderer.audioManager.toggleSound();
          renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
        } else if (btn.action === 'toggleVoice') {
          renderer.audioManager.toggleVoice();
          renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
        } else if (btn.action === 'editApiKey') {
          renderer.uiRenderer.setEditingApiKey(true);
        } else if (btn.action === 'saveApiKey') {
          renderer.uiRenderer.saveApiKey();
        } else if (btn.action === 'cancelEditApiKey') {
          renderer.uiRenderer.setEditingApiKey(false);
        } else {
          engine.handleAction(btn.action);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (renderer.uiRenderer.isEditingApiKey()) {
        if (e.key === 'Enter') {
          renderer.uiRenderer.saveApiKey();
          e.preventDefault();
        } else if (e.key === 'Escape') {
          renderer.uiRenderer.setEditingApiKey(false);
          e.preventDefault();
        } else if (e.key === 'Backspace') {
          const current = renderer.uiRenderer.getApiKeyInput();
          renderer.uiRenderer.setApiKeyInput(current.slice(0, -1));
          e.preventDefault();
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          const current = renderer.uiRenderer.getApiKeyInput();
          renderer.uiRenderer.setApiKeyInput(current + e.key);
          e.preventDefault();
        }
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const slider = renderer.uiRenderer.getSliderAt(x, y);
      if (slider) {
        renderer.uiRenderer.setDraggingSlider(slider);
        const value = renderer.uiRenderer.getSliderValue(x);
        if (slider === 'sound') {
          renderer.audioManager.setSoundVolume(value);
        } else {
          renderer.audioManager.setVoiceVolume(value);
        }
        renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const dragging = renderer.uiRenderer.isDraggingSlider();
      if (dragging) {
        const value = renderer.uiRenderer.getSliderValue(x);
        if (dragging === 'sound') {
          renderer.audioManager.setSoundVolume(value);
        } else {
          renderer.audioManager.setVoiceVolume(value);
        }
        renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
      } else {
        renderer.uiRenderer.hoveredButton = renderer.uiRenderer.getButtonAt(x, y);
      }
    });

    canvas.addEventListener('mouseup', () => {
      renderer.uiRenderer.setDraggingSlider(null);
    });

    canvas.addEventListener('mouseleave', () => {
      renderer.uiRenderer.hoveredButton = null;
      renderer.uiRenderer.setDraggingSlider(null);
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
        if (btn.action === 'toggleSettings') {
          renderer.uiRenderer.toggleSettingsPanel();
          renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
        } else if (btn.action === 'toggleSound') {
          renderer.audioManager.toggleSound();
          renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
        } else if (btn.action === 'toggleVoice') {
          renderer.audioManager.toggleVoice();
          renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
        } else {
          networkClient.send({ type: 'action', action: btn.action });
        }
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const slider = renderer.uiRenderer.getSliderAt(x, y);
      if (slider) {
        renderer.uiRenderer.setDraggingSlider(slider);
        const value = renderer.uiRenderer.getSliderValue(x);
        if (slider === 'sound') {
          renderer.audioManager.setSoundVolume(value);
        } else {
          renderer.audioManager.setVoiceVolume(value);
        }
        renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
      }
    });

    // Mouse move for hover effects
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const dragging = renderer.uiRenderer.isDraggingSlider();
      if (dragging) {
        const value = renderer.uiRenderer.getSliderValue(x);
        if (dragging === 'sound') {
          renderer.audioManager.setSoundVolume(value);
        } else {
          renderer.audioManager.setVoiceVolume(value);
        }
        renderer.uiRenderer.setAudioSettings(renderer.audioManager.getSettings());
      } else {
        renderer.uiRenderer.hoveredButton = renderer.uiRenderer.getButtonAt(x, y);
      }
    });

    canvas.addEventListener('mouseup', () => {
      renderer.uiRenderer.setDraggingSlider(null);
    });

    canvas.addEventListener('mouseleave', () => {
      renderer.uiRenderer.hoveredButton = null;
      renderer.uiRenderer.setDraggingSlider(null);
    });

    renderer.start();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => main());
} else {
  main();
}
