import { GameState, GamePhase, Button } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CHARACTER_DEFS } from '../constants';

export class UIRenderer {
  buttons: Button[] = [];
  localPlayerIndex: number = 0;
  private characterImages: Map<string, HTMLImageElement> = new Map();
  private walkImages: Map<string, HTMLImageElement[]> = new Map();
  private imagesLoaded = false;

  loadCharacterImages(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const char of CHARACTER_DEFS) {
      // Load standing image
      promises.push(new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => { this.characterImages.set(char.id, img); resolve(); };
        img.onerror = () => { console.warn(`Failed to load: ${char.imagePath}`); resolve(); };
        img.src = char.imagePath;
      }));

      // Load walk frames
      const frames: HTMLImageElement[] = [];
      this.walkImages.set(char.id, frames);
      for (let i = 0; i < char.walkFrames.length; i++) {
        const frameImg = new Image();
        frames.push(frameImg);
        promises.push(new Promise<void>((resolve) => {
          frameImg.onload = () => { resolve(); };
          frameImg.onerror = () => { console.warn(`Failed to load walk frame: ${char.walkFrames[i]}`); resolve(); };
          frameImg.src = char.walkFrames[i];
        }));
      }
    }

    return Promise.all(promises).then(() => { this.imagesLoaded = true; });
  }

  getCharacterImage(id: string): HTMLImageElement | undefined {
    return this.characterImages.get(id);
  }

  getWalkFrame(id: string, frameIndex: number): HTMLImageElement | undefined {
    const frames = this.walkImages.get(id);
    if (!frames || frameIndex < 0 || frameIndex >= frames.length) return undefined;
    const img = frames[frameIndex];
    return (img && img.complete && img.naturalWidth > 0) ? img : undefined;
  }

  draw(ctx: CanvasRenderingContext2D, state: GameState) {
    this.buttons = [];
    if (state.phase === GamePhase.CHARACTER_SELECT) {
      this.drawCharacterSelect(ctx);
      return;
    }
    this.drawPlayerPanels(ctx, state);
    this.drawMessages(ctx, state);
    this.drawActionButtons(ctx, state);
    this.drawPhaseIndicator(ctx, state);
  }

  // ===== Character Selection Screen =====
  private drawCharacterSelect(ctx: CanvasRenderingContext2D) {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Title
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('大富翁4', CANVAS_WIDTH / 2, 60);

    ctx.fillStyle = '#aaa';
    ctx.font = '18px "Microsoft YaHei", sans-serif';
    ctx.fillText('选择你的角色', CANVAS_WIDTH / 2, 105);
    // Character cards - 2x2 grid
    const cardW = 220;
    const cardH = 300;
    const gap = 30;
    const gridW = cardW * 2 + gap;
    const gridH = cardH * 2 + gap;
    const startX = (CANVAS_WIDTH - gridW) / 2;
    const startY = 140;

    for (let i = 0; i < CHARACTER_DEFS.length; i++) {
      const char = CHARACTER_DEFS[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      // Card background
      ctx.fillStyle = '#2a2a4a';
      this.roundRect(ctx, x, y, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = char.color;
      ctx.lineWidth = 2;
      this.roundRect(ctx, x, y, cardW, cardH, 12);
      ctx.stroke();

      // Character image
      const img = this.characterImages.get(char.id);
      const imgSize = 160;
      const imgX = x + (cardW - imgSize) / 2;
      const imgY = y + 15;
      if (img && img.complete && img.naturalWidth > 0) {
        // Rounded clip for image
        ctx.save();
        this.roundRect(ctx, imgX, imgY, imgSize, imgSize, 8);
        ctx.clip();
        ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
        ctx.restore();
      } else {
        // Placeholder
        ctx.fillStyle = '#3a3a5a';
        this.roundRect(ctx, imgX, imgY, imgSize, imgSize, 8);
        ctx.fill();
        ctx.fillStyle = '#666';
        ctx.font = '48px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char.name[0], imgX + imgSize / 2, imgY + imgSize / 2);
      }

      // Name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char.name, x + cardW / 2, y + imgSize + 35);

      // Description
      ctx.fillStyle = '#aaa';
      ctx.font = '14px "Microsoft YaHei", sans-serif';
      ctx.fillText(char.description, x + cardW / 2, y + imgSize + 60);

      // Register as clickable button
      this.buttons.push({
        x, y, w: cardW, h: cardH,
        label: char.name, action: `select_${i}`,
        visible: true, enabled: true,
      });
    }
  }
  // ===== Player Panels =====
  private drawPlayerPanels(ctx: CanvasRenderingContext2D, state: GameState) {
    const panelW = 160;
    const panelH = 80;
    const startX = 10;
    const startY = 10;

    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      const x = startX;
      const y = startY + i * (panelH + 8);
      const isActive = i === state.currentPlayerIndex;

      ctx.fillStyle = player.bankrupt
        ? 'rgba(100,100,100,0.7)'
        : isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)';
      this.roundRect(ctx, x, y, panelW, panelH, 8);
      ctx.fill();

      if (isActive && !player.bankrupt) {
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 3;
        this.roundRect(ctx, x, y, panelW, panelH, 8);
        ctx.stroke();
      }

      // Character portrait or color dot
      const charImg = this.characterImages.get(player.characterId);
      if (charImg && charImg.complete && charImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + 16, y + 20, 10, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(charImg, x + 6, y + 10, 20, 20);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(x + 16, y + 20, 10, 0, Math.PI * 2);
        ctx.strokeStyle = player.bankrupt ? '#999' : player.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x + 16, y + 20, 8, 0, Math.PI * 2);
        ctx.fillStyle = player.bankrupt ? '#999' : player.color;
        ctx.fill();
      }

      // Name
      ctx.fillStyle = player.bankrupt ? '#999' : '#333';
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let nameLabel = player.index === this.localPlayerIndex ? `${player.name} (你)` : player.name;
      if (player.isHuman && player.autoPlay) {
        nameLabel += ' [托管]';
      }
      ctx.fillText(nameLabel, x + 30, y + 20);

      // Money
      ctx.fillStyle = player.bankrupt ? '#999' : '#2e7d32';
      ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
      ctx.fillText(`$${player.money}`, x + 16, y + 48);

      if (player.bankrupt) {
        ctx.fillStyle = '#e74c3c';
        ctx.font = '12px "Microsoft YaHei", sans-serif';
        ctx.fillText('破产', x + 110, y + 48);
      } else if (player.inJail) {
        ctx.fillStyle = '#e74c3c';
        ctx.font = '12px "Microsoft YaHei", sans-serif';
        ctx.fillText('监狱中', x + 100, y + 48);
      }
    }
  }

  private drawMessages(ctx: CanvasRenderingContext2D, state: GameState) {
    const msgX = CANVAS_WIDTH - 280;
    const msgY = 10;
    const msgW = 270;
    const msgH = 260;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.roundRect(ctx, msgX, msgY, msgW, msgH, 8);
    ctx.fill();

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('游戏消息', msgX + 10, msgY + 8);

    const maxShow = 10;
    const msgs = state.messages.slice(-maxShow);
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    msgs.forEach((msg, i) => {
      ctx.fillStyle = msg.color || '#ddd';
      const y = msgY + 30 + i * 22;
      let text = msg.text;
      if (text.length > 22) text = text.substring(0, 21) + '\u2026';
      ctx.fillText(text, msgX + 10, y);
    });
  }

  private drawActionButtons(ctx: CanvasRenderingContext2D, state: GameState) {
    if (state.players.length === 0) return;
    const player = state.players[state.currentPlayerIndex];
    const localPlayer = state.players[this.localPlayerIndex];

    const btnY = CANVAS_HEIGHT - 70;
    const btnH = 45;
    const btnW = 160;

    // Always show auto-play toggle for local human player
    if (localPlayer && localPlayer.isHuman) {
      const autoLabel = localPlayer.autoPlay ? '取消托管' : '托管给AI';
      const autoColor = localPlayer.autoPlay ? '#e74c3c' : '#9b59b6';
      this.drawButton(ctx, 20, btnY, 100, btnH, autoLabel, 'toggleAutoPlay', true, autoColor);
    }

    // Don't show action buttons if not current player or in autoPlay mode
    if (!player || state.currentPlayerIndex !== this.localPlayerIndex) return;
    if (localPlayer && localPlayer.autoPlay) return;

    if (state.phase === GamePhase.WAITING) {
      this.drawButton(ctx, CANVAS_WIDTH / 2 - btnW / 2, btnY, btnW, btnH, '掷骰子', 'roll', true);
    } else if (state.phase === GamePhase.PLAYER_DECISION) {
      const options = state.decisionOptions;
      const totalW = options.length * (btnW + 10) - 10;
      const startX = CANVAS_WIDTH / 2 - totalW / 2;
      options.forEach((opt, i) => {
        this.drawButton(ctx, startX + i * (btnW + 10), btnY, btnW, btnH, opt.label, opt.action, true);
      });
    }
  }

  private drawButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, action: string, enabled: boolean, color?: string) {
    const baseColor = color || '#4CAF50';
    const darkColor = this.darkenColor(baseColor, 0.2);
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, enabled ? baseColor : '#888');
    gradient.addColorStop(1, enabled ? darkColor : '#666');
    ctx.fillStyle = gradient;
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let displayLabel = label;
    if (displayLabel.length > 14) displayLabel = displayLabel.substring(0, 13) + '\u2026';
    ctx.fillText(displayLabel, x + w / 2, y + h / 2);

    this.buttons.push({ x, y, w, h, label, action, visible: true, enabled });
  }

  private darkenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount));
    const g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount));
    const b = Math.max(0, (num & 0xff) * (1 - amount));
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  private drawPhaseIndicator(ctx: CanvasRenderingContext2D, state: GameState) {
    if (state.phase === GamePhase.GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 48px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('游戏结束', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
      if (state.winner >= 0) {
        const winner = state.players[state.winner];
        ctx.fillStyle = winner.color;
        ctx.font = 'bold 32px "Microsoft YaHei", sans-serif';
        ctx.fillText(`${winner.name} 获胜！`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
      }
      return;
    }

    if (state.players.length === 0) return;
    const player = state.players[state.currentPlayerIndex];
    if (player && (state.phase === GamePhase.AI_THINKING || (state.phase !== GamePhase.WAITING && !player.isHuman))) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.roundRect(ctx, CANVAS_WIDTH / 2 - 100, CANVAS_HEIGHT - 50, 200, 35, 8);
      ctx.fill();
      ctx.fillStyle = player.color;
      ctx.font = '14px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${player.name} 思考中...`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 32);
    }
  }

  getButtonAt(x: number, y: number): Button | null {
    for (const btn of this.buttons) {
      if (btn.visible && btn.enabled &&
          x >= btn.x && x <= btn.x + btn.w &&
          y >= btn.y && y <= btn.y + btn.h) {
        return btn;
      }
    }
    return null;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
