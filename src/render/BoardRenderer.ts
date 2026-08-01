import { Board } from '../core/Board';
import { GameState, TileType, Vec2 } from '../types';
import { TILE_DEFS, TOTAL_TILES, GROUP_COLORS } from '../constants';

export class BoardRenderer {
  private board: Board;
  private buildingImages: Map<number, HTMLImageElement> = new Map();
  private imagesLoaded = false;
  private currentPlayerPosition: number = -1;
  private decorationPattern: CanvasPattern | null = null;
  private roadPattern: CanvasPattern | null = null;

  constructor(board: Board) {
    this.board = board;
    this.loadBuildingImages();
    this.createPatterns();
  }

  private loadBuildingImages() {
    let loaded = 0;
    const done = () => {
      loaded++;
      if (loaded === 5) this.imagesLoaded = true;
    };
    for (let level = 1; level <= 5; level++) {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = `/buildings/building_${level}.png`;
      this.buildingImages.set(level, img);
    }
  }

  private createPatterns() {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const pCtx = patternCanvas.getContext('2d')!;
    
    pCtx.fillStyle = '#a5d6a7';
    pCtx.fillRect(0, 0, 20, 20);
    pCtx.fillStyle = '#81c784';
    for (let i = 0; i < 20; i += 4) {
      for (let j = 0; j < 20; j += 4) {
        if ((i + j) % 8 === 0) {
          pCtx.fillRect(i, j, 2, 2);
        }
      }
    }
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 20;
    tempCanvas.height = 20;
    const tCtx = tempCanvas.getContext('2d')!;
    tCtx.drawImage(patternCanvas, 0, 0);
    this.decorationPattern = tCtx.createPattern(patternCanvas, 'repeat');

    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 16;
    roadCanvas.height = 16;
    const rCtx = roadCanvas.getContext('2d')!;
    rCtx.fillStyle = '#5d4e37';
    rCtx.fillRect(0, 0, 16, 16);
    rCtx.fillStyle = '#4a3f2d';
    rCtx.fillRect(0, 0, 8, 8);
    rCtx.fillRect(8, 8, 8, 8);
    const roadTempCanvas = document.createElement('canvas');
    const rtCtx = roadTempCanvas.getContext('2d')!;
    this.roadPattern = rtCtx.createPattern(roadCanvas, 'repeat');
  }

  draw(ctx: CanvasRenderingContext2D, state: GameState, currentPlayerIndex?: number) {
    if (currentPlayerIndex !== undefined && state.players[currentPlayerIndex]) {
      this.currentPlayerPosition = state.players[currentPlayerIndex].position;
    } else {
      this.currentPlayerPosition = -1;
    }
    this.drawBoardSurface(ctx);
    this.drawTiles(ctx, state);
    this.drawBoardCenter(ctx);
  }

  private drawBoardSurface(ctx: CanvasRenderingContext2D) {
    const outerCorners = [
      { x: -1.05, y: 0, z: 1.05 },
      { x: 1.05, y: 0, z: 1.05 },
      { x: 1.05, y: 0, z: -1.05 },
      { x: -1.05, y: 0, z: -1.05 },
    ].map(c => this.board.project(c));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(outerCorners[0].x, outerCorners[0].y);
    for (let i = 1; i < outerCorners.length; i++) {
      ctx.lineTo(outerCorners[i].x, outerCorners[i].y);
    }
    ctx.closePath();
    ctx.clip();

    const gradient = ctx.createLinearGradient(
      outerCorners[0].x, outerCorners[0].y,
      outerCorners[2].x, outerCorners[2].y
    );
    gradient.addColorStop(0, '#1a472a');
    gradient.addColorStop(0.5, '#2d5a3d');
    gradient.addColorStop(1, '#1a472a');
    ctx.fillStyle = gradient;
    ctx.fill();

    if (this.decorationPattern) {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = this.decorationPattern;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(outerCorners[0].x, outerCorners[0].y);
    for (let i = 1; i < outerCorners.length; i++) {
      ctx.lineTo(outerCorners[i].x, outerCorners[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#0d2818';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#3d7a4a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawBoardCenter(ctx: CanvasRenderingContext2D) {
    const innerCorners = [
      { x: -0.72, y: 0, z: 0.72 },
      { x: 0.72, y: 0, z: 0.72 },
      { x: 0.72, y: 0, z: -0.72 },
      { x: -0.72, y: 0, z: -0.72 },
    ].map(c => this.board.project(c));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(innerCorners[0].x, innerCorners[0].y);
    for (let i = 1; i < innerCorners.length; i++) {
      ctx.lineTo(innerCorners[i].x, innerCorners[i].y);
    }
    ctx.closePath();
    ctx.clip();

    const gradient = ctx.createRadialGradient(
      (innerCorners[0].x + innerCorners[2].x) / 2,
      (innerCorners[0].y + innerCorners[2].y) / 2,
      0,
      (innerCorners[0].x + innerCorners[2].x) / 2,
      (innerCorners[0].y + innerCorners[2].y) / 2,
      Math.max(
        Math.abs(innerCorners[2].x - innerCorners[0].x),
        Math.abs(innerCorners[2].y - innerCorners[0].y)
      ) / 2
    );
    gradient.addColorStop(0, '#e8f5e9');
    gradient.addColorStop(0.7, '#c8e6c9');
    gradient.addColorStop(1, '#a5d6a7');
    ctx.fillStyle = gradient;
    ctx.fill();

    if (this.decorationPattern) {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = this.decorationPattern;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(innerCorners[0].x, innerCorners[0].y);
    for (let i = 1; i < innerCorners.length; i++) {
      ctx.lineTo(innerCorners[i].x, innerCorners[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#66bb6a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 1;
    ctx.stroke();

    this.drawCenterDecoration(ctx, innerCorners);
  }

  private drawCenterDecoration(ctx: CanvasRenderingContext2D, innerCorners: Vec2[]) {
    const centerX = (innerCorners[0].x + innerCorners[2].x) / 2;
    const centerY = (innerCorners[0].y + innerCorners[2].y) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY - 5, 55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(46, 125, 50, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(46, 125, 50, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#1b5e20';
    ctx.font = 'bold 36px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('大富翁4', centerX, centerY - 12);
    ctx.restore();

    ctx.fillStyle = '#2e7d32';
    ctx.font = 'bold 13px "Arial", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MONOPOLY', centerX, centerY + 18);

    ctx.fillStyle = '#4caf50';
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.fillText('★ 经典版 ★', centerX, centerY + 35);

    this.drawCornerIcons(ctx, innerCorners);
  }

  private drawCornerIcons(ctx: CanvasRenderingContext2D, innerCorners: Vec2[]) {
    const iconSize = 18;
    const margin = 25;
    
    const corners = [
      { x: innerCorners[0].x + margin, y: innerCorners[0].y + margin, icon: '🏠' },
      { x: innerCorners[1].x - margin, y: innerCorners[1].y + margin, icon: '💰' },
      { x: innerCorners[2].x - margin, y: innerCorners[2].y - margin, icon: '🎲' },
      { x: innerCorners[3].x + margin, y: innerCorners[3].y - margin, icon: '🏆' },
    ];

    corners.forEach(corner => {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.font = `${iconSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(corner.icon, corner.x, corner.y);
      ctx.restore();
    });
  }
  private drawTiles(ctx: CanvasRenderingContext2D, state: GameState) {
    for (let i = 0; i < TOTAL_TILES; i++) {
      const poly = this.board.getTileScreenPoly(i);
      if (poly.length < 4) continue;
      const tile = TILE_DEFS[i];
      const prop = state.properties[i];
      const isCurrentPlayerTile = i === this.currentPlayerPosition;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let j = 1; j < poly.length; j++) {
        ctx.lineTo(poly[j].x, poly[j].y);
      }
      ctx.closePath();
      ctx.clip();

      const colors = this.getTileColors(tile);
      const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
      const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
      
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
      gradient.addColorStop(0, colors.light);
      gradient.addColorStop(1, colors.base);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let j = 1; j < poly.length; j++) {
        ctx.lineTo(poly[j].x, poly[j].y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (tile.type === TileType.PROPERTY && tile.colorGroup >= 0) {
        this.drawColorBar(ctx, poly, tile.colorGroup);
      }

      if (isCurrentPlayerTile) {
        this.drawTileHighlight(ctx, poly);
      }

      if (prop.ownerIndex >= 0 && state.players[prop.ownerIndex]) {
        this.drawOwnershipIndicator(ctx, poly, state.players[prop.ownerIndex].color, prop.buildings);
      }

      this.drawTileLabel(ctx, poly, tile, prop);
    }

    for (let i = 0; i < TOTAL_TILES; i++) {
      const poly = this.board.getTileScreenPoly(i);
      if (poly.length < 4) continue;
      const tile = TILE_DEFS[i];
      const prop = state.properties[i];

      if (tile.type !== TileType.PROPERTY || prop.ownerIndex === -1 || prop.buildings <= 0) continue;

      const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
      const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const tileW = maxX - minX;
      const tileH = maxY - minY;
      const imgSize = Math.min(tileW, tileH) * 0.95;

      const buildingImg = this.buildingImages.get(prop.buildings);
      if (buildingImg && buildingImg.complete && buildingImg.naturalWidth > 0) {
        ctx.drawImage(
          buildingImg,
          cx - imgSize / 2,
          cy - imgSize / 2,
          imgSize,
          imgSize
        );
      } else {
        this.drawFallbackBuilding(ctx, cx, cy, prop.buildings, imgSize);
      }
    }
  }

  private getTileColors(tile: typeof TILE_DEFS[0]): { base: string; light: string } {
    if (tile.type === TileType.PROPERTY && tile.colorGroup >= 0) {
      const baseColor = GROUP_COLORS[tile.colorGroup] || '#ddd';
      return {
        base: baseColor,
        light: this.lightenColor(baseColor, 30)
      };
    }
    
    const colorMap: Record<TileType, { base: string; light: string }> = {
      [TileType.GO]: { base: '#fff59d', light: '#ffffb3' },
      [TileType.JAIL]: { base: '#ffab91', light: '#ffccbc' },
      [TileType.GO_TO_JAIL]: { base: '#ef9a9a', light: '#ffcdd2' },
      [TileType.CHANCE]: { base: '#ce93d8', light: '#e1bee7' },
      [TileType.TAX]: { base: '#ef9a9a', light: '#ffcdd2' },
      [TileType.FREE_PARKING]: { base: '#80cbc4', light: '#b2dfdb' },
      [TileType.PROPERTY]: { base: '#e0e0e0', light: '#f5f5f5' },
    };
    
    return colorMap[tile.type] || { base: '#e0e0e0', light: '#f5f5f5' };
  }

  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    const hex = (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    return `#${hex.padStart(6, '0')}`;
  }

  private drawColorBar(ctx: CanvasRenderingContext2D, poly: Vec2[], colorGroup: number) {
    const color = GROUP_COLORS[colorGroup] || '#ddd';
    const barWidth = 8;
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let j = 1; j < poly.length; j++) {
      ctx.lineTo(poly[j].x, poly[j].y);
    }
    ctx.closePath();
    ctx.clip();

    const minX = Math.min(...poly.map(p => p.x));
    const minY = Math.min(...poly.map(p => p.y));
    const maxY = Math.max(...poly.map(p => p.y));

    const gradient = ctx.createLinearGradient(minX, minY, minX + barWidth, maxY);
    gradient.addColorStop(0, this.lightenColor(color, 20));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, this.lightenColor(color, -20));
    
    ctx.fillStyle = gradient;
    ctx.fillRect(minX, minY, barWidth, maxY - minY);
    ctx.restore();
  }

  private drawTileHighlight(ctx: CanvasRenderingContext2D, poly: Vec2[]) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let j = 1; j < poly.length; j++) {
      ctx.lineTo(poly[j].x, poly[j].y);
    }
    ctx.closePath();
    
    ctx.shadowColor = 'rgba(255, 193, 7, 0.8)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(255, 235, 59, 0.4)';
    ctx.fill();
    
    ctx.strokeStyle = '#ffc107';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private drawOwnershipIndicator(ctx: CanvasRenderingContext2D, poly: Vec2[], ownerColor: string, buildings: number) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let j = 1; j < poly.length; j++) {
      ctx.lineTo(poly[j].x, poly[j].y);
    }
    ctx.closePath();
    
    ctx.shadowColor = ownerColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = ownerColor;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    if (buildings === 0) {
      const flagX = poly[0].x;
      const flagY = poly[0].y;
      
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      
      ctx.beginPath();
      ctx.arc(flagX, flagY, 8, 0, Math.PI * 2);
      ctx.fillStyle = ownerColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', flagX, flagY);
    }
  }

  private drawTileLabel(ctx: CanvasRenderingContext2D, poly: Vec2[], tile: typeof TILE_DEFS[0], prop: { ownerIndex: number }) {
    const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;

    const dx = poly[1].x - poly[0].x;
    const dy = poly[1].y - poly[0].y;
    const tileW = Math.sqrt(dx * dx + dy * dy);
    const fontSize = Math.max(8, Math.min(13, tileW * 0.28));

    ctx.save();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.name, cx, cy - fontSize * 0.4);
    ctx.restore();

    if (tile.type === TileType.PROPERTY && prop.ownerIndex === -1) {
      const infoSize = Math.max(7, fontSize * 0.75);
      
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(cx - infoSize * 2, cy + fontSize * 0.2, infoSize * 4, infoSize * 1.4);
      ctx.fillStyle = '#ffd700';
      ctx.font = `bold ${infoSize}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`$${tile.price}`, cx, cy + fontSize * 0.55);
      ctx.restore();
    }

    if (tile.type === TileType.GO) {
      ctx.fillStyle = '#2e7d32';
      ctx.font = `${fontSize * 0.6}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('→', cx + fontSize * 1.5, cy);
    } else if (tile.type === TileType.JAIL) {
      ctx.fillStyle = '#c62828';
      ctx.font = `${fontSize * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('🔒', cx, cy + fontSize * 0.8);
    } else if (tile.type === TileType.GO_TO_JAIL) {
      ctx.fillStyle = '#c62828';
      ctx.font = `${fontSize * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('👮', cx, cy + fontSize * 0.8);
    } else if (tile.type === TileType.CHANCE) {
      ctx.fillStyle = '#7b1fa2';
      ctx.font = `${fontSize * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('?', cx, cy + fontSize * 0.8);
    } else if (tile.type === TileType.TAX) {
      ctx.fillStyle = '#c62828';
      ctx.font = `${fontSize * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('💰', cx, cy + fontSize * 0.8);
    } else if (tile.type === TileType.FREE_PARKING) {
      ctx.fillStyle = '#00695c';
      ctx.font = `${fontSize * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('🅿️', cx, cy + fontSize * 0.8);
    }
  }

  private drawFallbackBuilding(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, imgSize: number) {
    const isHotel = level === 5;
    const buildingLevels = isHotel ? 5 : level;
    const floorHeight = imgSize * 0.12;
    const bodyWidth = imgSize * 0.45;
    const depth = imgSize * 0.08;
    const isoAngle = 0.4;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    const baseY = cy + imgSize * 0.15;
    
    const colors = isHotel 
      ? { top: '#E57373', left: '#C62828', right: '#B71C1C', roof: '#B71C1C', roofDark: '#7F0000', roofLight: '#D32F2F' }
      : { top: '#A5D6A7', left: '#4CAF50', right: '#388E3C', roof: '#5D4037', roofDark: '#3E2723', roofLight: '#795548' };

    for (let floor = 0; floor < buildingLevels; floor++) {
      const floorY = baseY - floor * floorHeight;
      const brightnessFactor = 1 - floor * 0.03;
      
      const topColor = this.lightenColor(colors.top, (1 - brightnessFactor) * 20);
      const leftColor = this.lightenColor(colors.left, (1 - brightnessFactor) * 20);
      const rightColor = this.lightenColor(colors.right, (1 - brightnessFactor) * 20);

      const x = cx - bodyWidth / 2;
      
      const leftGradient = ctx.createLinearGradient(x, floorY, x, floorY + floorHeight);
      leftGradient.addColorStop(0, this.lightenColor(leftColor, 10));
      leftGradient.addColorStop(1, this.lightenColor(leftColor, -10));
      ctx.fillStyle = leftGradient;
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x + bodyWidth / 2, floorY + depth);
      ctx.lineTo(x + bodyWidth / 2, floorY + floorHeight + depth);
      ctx.lineTo(x, floorY + floorHeight);
      ctx.closePath();
      ctx.fill();

      const rightGradient = ctx.createLinearGradient(x + bodyWidth, floorY, x + bodyWidth, floorY + floorHeight);
      rightGradient.addColorStop(0, this.lightenColor(rightColor, 5));
      rightGradient.addColorStop(1, this.lightenColor(rightColor, -15));
      ctx.fillStyle = rightGradient;
      ctx.beginPath();
      ctx.moveTo(x + bodyWidth, floorY);
      ctx.lineTo(x + bodyWidth / 2, floorY + depth);
      ctx.lineTo(x + bodyWidth / 2, floorY + floorHeight + depth);
      ctx.lineTo(x + bodyWidth, floorY + floorHeight);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = topColor;
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x + bodyWidth / 2, floorY - depth * isoAngle);
      ctx.lineTo(x + bodyWidth, floorY);
      ctx.lineTo(x + bodyWidth / 2, floorY + depth);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = this.lightenColor(topColor, -30);
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.strokeStyle = this.lightenColor(leftColor, 20);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x, floorY + floorHeight);
      ctx.stroke();

      const winW = bodyWidth * 0.12;
      const winH = floorHeight * 0.45;
      const winY = floorY + floorHeight * 0.25;
      const winPositions = isHotel ? [0.18, 0.45, 0.72] : [0.22, 0.62];
      
      for (let i = 0; i < winPositions.length; i++) {
        const winX = x + bodyWidth * winPositions[i];
        const lit = (floor + i) % 3 !== 0;
        
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(winX - 1, winY - 1, winW + 2, winH + 2);
        
        ctx.fillStyle = lit ? '#FFFDE7' : '#B3E5FC';
        ctx.fillRect(winX, winY, winW, winH);
        
        if (lit) {
          ctx.fillStyle = '#FFF9C4';
          ctx.fillRect(winX, winY, winW, 1);
          ctx.fillRect(winX, winY, 1, winH);
        }
        
        ctx.strokeStyle = '#3A3A3A';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(winX + winW / 2, winY);
        ctx.lineTo(winX + winW / 2, winY + winH);
        ctx.moveTo(winX, winY + winH / 2);
        ctx.lineTo(winX + winW, winY + winH / 2);
        ctx.stroke();
      }

      if (floor > 0 && floor % 2 === 0 && !isHotel) {
        const balconyX = x + bodyWidth * 0.08;
        const balconyW = bodyWidth * 0.25;
        ctx.strokeStyle = '#78909C';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(balconyX, floorY + floorHeight - 4, balconyW, 5);
        for (let b = 1; b < 4; b++) {
          ctx.beginPath();
          ctx.moveTo(balconyX + b * balconyW / 4, floorY + floorHeight - 4);
          ctx.lineTo(balconyX + b * balconyW / 4, floorY + floorHeight + 1);
          ctx.stroke();
        }
      }
    }

    const roofY = baseY - buildingLevels * floorHeight;
    const roofHeight = imgSize * 0.08;

    if (isHotel) {
      ctx.fillStyle = colors.roof;
      ctx.fillRect(cx - bodyWidth / 2 - 4, roofY - roofHeight, bodyWidth + 8, roofHeight);
      
      const tileH = 3;
      for (let i = 0; i < roofHeight / tileH; i++) {
        const tileY = roofY - roofHeight + i * tileH;
        const offset = (i % 2) * 5;
        ctx.fillStyle = (i % 2 === 0) ? colors.roofDark : colors.roofLight;
        for (let j = -1; j < bodyWidth / 8 + 2; j++) {
          ctx.fillRect(cx - bodyWidth / 2 + j * 8 + offset - 4, tileY, 7, tileH - 0.5);
        }
      }
      
      ctx.fillStyle = '#5D0000';
      ctx.fillRect(cx - bodyWidth / 2 - 4, roofY - roofHeight, bodyWidth + 8, 2);

      for (let i = 0; i < 3; i++) {
        const flagX = cx - bodyWidth * 0.2 + i * bodyWidth * 0.2;
        const flagH = 8;
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(flagX, roofY - roofHeight - 2);
        ctx.lineTo(flagX, roofY - roofHeight - flagH - 2);
        ctx.stroke();
        ctx.fillStyle = '#FF5252';
        ctx.beginPath();
        ctx.moveTo(flagX, roofY - roofHeight - flagH - 2);
        ctx.lineTo(flagX + 6, roofY - roofHeight - flagH / 2 - 2);
        ctx.lineTo(flagX, roofY - roofHeight - 2);
        ctx.closePath();
        ctx.fill();
      }

      const signW = bodyWidth * 0.5;
      const signH = 8;
      const signX = cx - signW / 2;
      const signY = roofY - roofHeight - signH - 12;
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(signX - 1, signY - 1, signW + 2, signH + 2);
      ctx.fillStyle = '#FFEB3B';
      ctx.fillRect(signX, signY, signW, signH);
      ctx.strokeStyle = '#FFA000';
      ctx.lineWidth = 1;
      ctx.strokeRect(signX - 1, signY - 1, signW + 2, signH + 2);
      ctx.fillStyle = '#C62828';
      ctx.font = `bold ${signH - 2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HOTEL', cx, signY + signH / 2);
    } else {
      ctx.fillStyle = colors.roof;
      ctx.beginPath();
      ctx.moveTo(cx, roofY - roofHeight);
      ctx.lineTo(cx - bodyWidth / 2 - 8, roofY);
      ctx.lineTo(cx + bodyWidth / 2 + 8, roofY);
      ctx.closePath();
      ctx.fill();
      
      const tileRows = Math.floor(roofHeight / 4);
      for (let i = 0; i < tileRows; i++) {
        const rowY = roofY - roofHeight + i * 4 + 2;
        const rowWidth = (roofHeight - i * 4) * 0.8;
        if (i % 2 === 0) {
          ctx.strokeStyle = colors.roofDark;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - rowWidth, rowY);
          ctx.lineTo(cx + rowWidth, rowY);
          ctx.stroke();
        }
      }
      
      ctx.strokeStyle = colors.roofDark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, roofY - roofHeight);
      ctx.lineTo(cx - bodyWidth / 2 - 8, roofY);
      ctx.moveTo(cx, roofY - roofHeight);
      ctx.lineTo(cx + bodyWidth / 2 + 8, roofY);
      ctx.stroke();

      const chimneyW = 5;
      const chimneyH = 10;
      const chimneyX = cx + bodyWidth * 0.25;
      const chimneyY = roofY - roofHeight + 4;
      ctx.fillStyle = '#8D6E63';
      ctx.fillRect(chimneyX, chimneyY - chimneyH, chimneyW, chimneyH + 2);
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(chimneyX, chimneyY - chimneyH, chimneyW, chimneyH + 2);
      ctx.fillStyle = '#795548';
      ctx.fillRect(chimneyX - 1, chimneyY - chimneyH - 2, chimneyW + 2, 2);
    }

    const doorW = bodyWidth * 0.2;
    const doorH = floorHeight * 0.7;
    const doorX = cx - doorW / 2;
    const doorY = baseY + floorHeight - doorH;
    
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);
    
    const doorGradient = ctx.createLinearGradient(doorX, doorY, doorX + doorW, doorY);
    doorGradient.addColorStop(0, '#A1887F');
    doorGradient.addColorStop(0.3, '#8D6E63');
    doorGradient.addColorStop(1, '#6D4C41');
    ctx.fillStyle = doorGradient;
    ctx.fillRect(doorX, doorY, doorW, doorH);
    
    ctx.strokeStyle = '#A1887F';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(doorX + 2, doorY + 2, doorW - 4, doorH * 0.3);
    ctx.strokeRect(doorX + 2, doorY + doorH * 0.5, doorW - 4, doorH * 0.35);
    
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(doorX + doorW - 4, doorY + doorH / 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFC107';
    ctx.beginPath();
    ctx.arc(doorX + doorW - 4, doorY + doorH / 2, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
