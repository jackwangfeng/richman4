import { GameState, GamePhase, Button, CardType, Stock } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CHARACTER_DEFS, CARD_DEFS } from '../constants';

export class UIRenderer {
  buttons: Button[] = [];
  localPlayerIndex: number = 0;
  hoveredButton: Button | null = null;
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
    this.drawCardPanel(ctx, state);
    this.drawStockPanel(ctx, state);
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

      // Shadow for panel
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Gradient background
      let gradient: CanvasGradient;
      if (player.bankrupt) {
        gradient = ctx.createLinearGradient(x, y, x, y + panelH);
        gradient.addColorStop(0, 'rgba(120, 120, 120, 0.8)');
        gradient.addColorStop(1, 'rgba(80, 80, 80, 0.8)');
      } else if (isActive) {
        gradient = ctx.createLinearGradient(x, y, x, y + panelH);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        gradient.addColorStop(1, 'rgba(240, 240, 240, 0.95)');
      } else {
        gradient = ctx.createLinearGradient(x, y, x, y + panelH);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        gradient.addColorStop(1, 'rgba(230, 230, 230, 0.8)');
      }
      ctx.fillStyle = gradient;
      this.roundRect(ctx, x, y, panelW, panelH, 10);
      ctx.fill();
      ctx.restore();

      // Border with player color accent
      if (isActive && !player.bankrupt) {
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 3;
        this.roundRect(ctx, x, y, panelW, panelH, 10);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, panelW, panelH, 10);
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

    // Shadow for message panel
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Gradient background for message area
    const msgGradient = ctx.createLinearGradient(msgX, msgY, msgX, msgY + msgH);
    msgGradient.addColorStop(0, 'rgba(20, 20, 40, 0.85)');
    msgGradient.addColorStop(1, 'rgba(10, 10, 30, 0.9)');
    ctx.fillStyle = msgGradient;
    this.roundRect(ctx, msgX, msgY, msgW, msgH, 10);
    ctx.fill();
    ctx.restore();

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, msgX, msgY, msgW, msgH, 10);
    ctx.stroke();

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
    const isHovered = this.hoveredButton &&
      this.hoveredButton.action === action &&
      this.hoveredButton.x === x &&
      this.hoveredButton.y === y;

    const baseColor = color || '#4CAF50';
    const darkColor = this.darkenColor(baseColor, 0.2);
    const lightColor = this.lightenColor(baseColor, 0.15);

    // Shadow effect
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = isHovered ? 12 : 6;
    ctx.shadowOffsetX = isHovered ? 3 : 2;
    ctx.shadowOffsetY = isHovered ? 3 : 2;

    // Button gradient (lighter when hovered)
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    if (!enabled) {
      gradient.addColorStop(0, '#888');
      gradient.addColorStop(1, '#666');
    } else if (isHovered) {
      gradient.addColorStop(0, lightColor);
      gradient.addColorStop(0.5, baseColor);
      gradient.addColorStop(1, darkColor);
    } else {
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(1, darkColor);
    }
    ctx.fillStyle = gradient;
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.restore();

    // Border highlight
    ctx.strokeStyle = isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isHovered ? 2 : 1;
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();

    // Inner highlight at top
    if (enabled) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 2);
      ctx.lineTo(x + w - 10, y + 2);
      ctx.stroke();
    }

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

  private lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) * (1 + amount));
    const g = Math.min(255, ((num >> 8) & 0xff) * (1 + amount));
    const b = Math.min(255, (num & 0xff) * (1 + amount));
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

  // ===== Card Panel =====
  private drawCardPanel(ctx: CanvasRenderingContext2D, state: GameState) {
    if (state.players.length === 0) return;
    const localPlayer = state.players[this.localPlayerIndex];
    if (!localPlayer || localPlayer.cards.length === 0) return;

    const panelX = 10;
    const panelY = 370;
    const panelW = 160;
    const cardH = 24;
    const panelH = 30 + localPlayer.cards.length * (cardH + 4);

    // Panel background
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    gradient.addColorStop(0, 'rgba(155, 89, 182, 0.9)');
    gradient.addColorStop(1, 'rgba(142, 68, 173, 0.9)');
    ctx.fillStyle = gradient;
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.restore();

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('我的卡片', panelX + 10, panelY + 14);

    // Immunity indicator
    if (localPlayer.immuneTurns > 0) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`免租:${localPlayer.immuneTurns}回合`, panelX + panelW - 10, panelY + 14);
    }

    // Card list
    ctx.textAlign = 'left';
    localPlayer.cards.forEach((cardType, i) => {
      const cardDef = CARD_DEFS.find(c => c.type === cardType);
      if (!cardDef) return;

      const y = panelY + 28 + i * (cardH + 4);

      // Card background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.roundRect(ctx, panelX + 6, y, panelW - 12, cardH, 4);
      ctx.fill();

      // Card name
      ctx.fillStyle = '#fff';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.fillText(cardDef.name, panelX + 12, y + cardH / 2);
    });
  }

  // ===== Stock Panel =====
  private drawStockPanel(ctx: CanvasRenderingContext2D, state: GameState) {
    if (!state.stocks || state.stocks.length === 0) return;

    const panelX = CANVAS_WIDTH - 280;
    const panelY = 280;
    const panelW = 270;
    const stockH = 28;
    const panelH = 35 + state.stocks.length * (stockH + 4);

    // Panel background
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    gradient.addColorStop(0, 'rgba(52, 73, 94, 0.9)');
    gradient.addColorStop(1, 'rgba(44, 62, 80, 0.9)');
    ctx.fillStyle = gradient;
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.restore();

    // Title
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('股票市场', panelX + 10, panelY + 16);

    // Local player holdings
    const localPlayer = state.players[this.localPlayerIndex];

    // Stock list
    state.stocks.forEach((stock, i) => {
      const y = panelY + 32 + i * (stockH + 4);

      // Stock row background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      this.roundRect(ctx, panelX + 6, y, panelW - 12, stockH, 4);
      ctx.fill();

      // Stock name
      ctx.fillStyle = '#fff';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(stock.name, panelX + 12, y + stockH / 2);

      // Price with trend indicator
      const trendColor = stock.trend > 0 ? '#2ecc71' : stock.trend < 0 ? '#e74c3c' : '#fff';
      const trendArrow = stock.trend > 0 ? '▲' : stock.trend < 0 ? '▼' : '─';
      ctx.fillStyle = trendColor;
      ctx.textAlign = 'center';
      ctx.fillText(`$${stock.price} ${trendArrow}`, panelX + 130, y + stockH / 2);

      // Player holdings
      if (localPlayer) {
        const holding = localPlayer.stocks[stock.id] || 0;
        ctx.fillStyle = holding > 0 ? '#3498db' : '#888';
        ctx.textAlign = 'right';
        ctx.fillText(`持有: ${holding}`, panelX + panelW - 12, y + stockH / 2);
      }
    });
  }
}
