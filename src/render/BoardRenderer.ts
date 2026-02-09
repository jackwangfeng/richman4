import { Board } from '../core/Board';
import { GameState, TileType, Vec2 } from '../types';
import { TILE_DEFS, TOTAL_TILES, GROUP_COLORS } from '../constants';

export class BoardRenderer {
  private board: Board;
  private buildingImages: Map<number, HTMLImageElement> = new Map();
  private imagesLoaded = false;
  private currentPlayerPosition: number = -1;

  constructor(board: Board) {
    this.board = board;
    this.loadBuildingImages();
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
      img.onerror = done; // don't block on failed images
      img.src = `/buildings/building_${level}.png`;
      this.buildingImages.set(level, img);
    }
  }

  draw(ctx: CanvasRenderingContext2D, state: GameState, currentPlayerIndex?: number) {
    // Track current player position for highlighting
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
    // Outer board border
    const outerCorners = [
      { x: -1.02, y: 0, z: 1.02 },
      { x: 1.02, y: 0, z: 1.02 },
      { x: 1.02, y: 0, z: -1.02 },
      { x: -1.02, y: 0, z: -1.02 },
    ].map(c => this.board.project(c));

    ctx.beginPath();
    ctx.moveTo(outerCorners[0].x, outerCorners[0].y);
    for (let i = 1; i < outerCorners.length; i++) {
      ctx.lineTo(outerCorners[i].x, outerCorners[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = '#2d5016';
    ctx.fill();
    ctx.strokeStyle = '#1a3a0a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private drawBoardCenter(ctx: CanvasRenderingContext2D) {
    // Inner board area (green felt)
    const innerCorners = [
      { x: -0.72, y: 0, z: 0.72 },
      { x: 0.72, y: 0, z: 0.72 },
      { x: 0.72, y: 0, z: -0.72 },
      { x: -0.72, y: 0, z: -0.72 },
    ].map(c => this.board.project(c));
    ctx.beginPath();
    ctx.moveTo(innerCorners[0].x, innerCorners[0].y);
    for (let i = 1; i < innerCorners.length; i++) {
      ctx.lineTo(innerCorners[i].x, innerCorners[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = '#c8e6c9';
    ctx.fill();
    ctx.strokeStyle = '#81c784';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title
    const center = this.board.project({ x: 0, y: 0, z: -0.05 });
    ctx.fillStyle = '#2e7d32';
    ctx.font = 'bold 32px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('大富翁4', center.x, center.y - 10);

    ctx.fillStyle = '#388e3c';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.fillText('MONOPOLY', center.x, center.y + 18);
  }
  private drawTiles(ctx: CanvasRenderingContext2D, state: GameState) {
    // Pass 1: Draw all tile backgrounds, borders, and text labels
    for (let i = 0; i < TOTAL_TILES; i++) {
      const poly = this.board.getTileScreenPoly(i);
      if (poly.length < 4) continue;
      const tile = TILE_DEFS[i];
      const prop = state.properties[i];
      const isCurrentPlayerTile = i === this.currentPlayerPosition;

      // Fill tile background
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let j = 1; j < poly.length; j++) {
        ctx.lineTo(poly[j].x, poly[j].y);
      }
      ctx.closePath();

      // Color based on type
      if (tile.type === TileType.PROPERTY && tile.colorGroup >= 0) {
        ctx.fillStyle = GROUP_COLORS[tile.colorGroup] || '#ddd';
      } else if (tile.type === TileType.GO) {
        ctx.fillStyle = '#fff9c4';
      } else if (tile.type === TileType.JAIL || tile.type === TileType.GO_TO_JAIL) {
        ctx.fillStyle = '#ffccbc';
      } else if (tile.type === TileType.CHANCE) {
        ctx.fillStyle = '#e1bee7';
      } else if (tile.type === TileType.TAX) {
        ctx.fillStyle = '#ffcdd2';
      } else if (tile.type === TileType.FREE_PARKING) {
        ctx.fillStyle = '#b2dfdb';
      } else {
        ctx.fillStyle = '#e0e0e0';
      }
      ctx.fill();

      // Inner shadow effect
      ctx.save();
      ctx.clip();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();

      // Tile border
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let j = 1; j < poly.length; j++) {
        ctx.lineTo(poly[j].x, poly[j].y);
      }
      ctx.closePath();
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Highlight current player's tile
      if (isCurrentPlayerTile) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let j = 1; j < poly.length; j++) {
          ctx.lineTo(poly[j].x, poly[j].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 235, 59, 0.35)';
        ctx.fill();
        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      // Owner border highlight and ownership indicator
      if (prop.ownerIndex >= 0 && state.players[prop.ownerIndex]) {
        const ownerColor = state.players[prop.ownerIndex].color;
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let j = 1; j < poly.length; j++) {
          ctx.lineTo(poly[j].x, poly[j].y);
        }
        ctx.closePath();
        ctx.strokeStyle = ownerColor;
        ctx.lineWidth = 4;
        ctx.stroke();

        // Draw ownership flag in corner when no buildings yet
        if (prop.buildings === 0) {
          const flagX = poly[0].x;
          const flagY = poly[0].y;
          ctx.beginPath();
          ctx.arc(flagX, flagY, 6, 0, Math.PI * 2);
          ctx.fillStyle = ownerColor;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Tile label
      const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
      const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;

      // Estimate tile screen size for font scaling
      const dx = poly[1].x - poly[0].x;
      const dy = poly[1].y - poly[0].y;
      const tileW = Math.sqrt(dx * dx + dy * dy);
      const fontSize = Math.max(7, Math.min(12, tileW * 0.3));

      ctx.fillStyle = '#222';
      ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.name, cx, cy - fontSize * 0.35);

      // Price text for unowned properties
      if (tile.type === TileType.PROPERTY && prop.ownerIndex === -1) {
        const infoSize = Math.max(6, fontSize * 0.7);
        ctx.font = `${infoSize}px "Microsoft YaHei", sans-serif`;
        ctx.fillStyle = '#555';
        ctx.fillText(`$${tile.price}`, cx, cy + fontSize * 0.45);
      }
    }

    // Pass 2: Draw all building sprites on top so they aren't covered by adjacent tiles
    for (let i = 0; i < TOTAL_TILES; i++) {
      const poly = this.board.getTileScreenPoly(i);
      if (poly.length < 4) continue;
      const tile = TILE_DEFS[i];
      const prop = state.properties[i];

      if (tile.type !== TileType.PROPERTY || prop.ownerIndex === -1 || prop.buildings <= 0) continue;

      // Calculate tile center and size
      const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
      const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;

      // Compute bounding box for size reference
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const tileW = maxX - minX;
      const tileH = maxY - minY;
      const imgSize = Math.min(tileW, tileH) * 0.7;

      const buildingImg = this.buildingImages.get(prop.buildings);
      if (buildingImg && buildingImg.complete && buildingImg.naturalWidth > 0) {
        // Draw building image centered on tile
        ctx.drawImage(
          buildingImg,
          cx - imgSize / 2,
          cy - imgSize / 2,
          imgSize,
          imgSize
        );
      } else {
        // Fallback to colored house icons if images not loaded
        const houseSize = Math.max(6, imgSize * 0.25);
        const houseCount = prop.buildings === 5 ? 1 : prop.buildings;
        const isHotel = prop.buildings === 5;

        ctx.fillStyle = isHotel ? '#c62828' : '#2e7d32';

        if (isHotel) {
          // Draw hotel as a larger rectangle
          ctx.fillRect(cx - houseSize, cy - houseSize * 0.6, houseSize * 2, houseSize * 1.2);
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${houseSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('H', cx, cy);
        } else {
          // Draw small house icons
          const spacing = houseSize * 1.2;
          const startX = cx - ((houseCount - 1) * spacing) / 2;
          for (let h = 0; h < houseCount; h++) {
            const hx = startX + h * spacing;
            // Draw simple house shape
            ctx.beginPath();
            ctx.moveTo(hx, cy - houseSize * 0.5); // roof top
            ctx.lineTo(hx + houseSize * 0.5, cy); // roof right
            ctx.lineTo(hx + houseSize * 0.4, cy); // wall right top
            ctx.lineTo(hx + houseSize * 0.4, cy + houseSize * 0.4); // wall right bottom
            ctx.lineTo(hx - houseSize * 0.4, cy + houseSize * 0.4); // wall left bottom
            ctx.lineTo(hx - houseSize * 0.4, cy); // wall left top
            ctx.lineTo(hx - houseSize * 0.5, cy); // roof left
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  }
}
