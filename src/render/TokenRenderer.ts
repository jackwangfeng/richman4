import { Board } from '../core/Board';
import { GameState, Vec2, Vec3 } from '../types';
import { TOTAL_TILES, TILES_PER_SIDE } from '../constants';

// Direction enum for walking animation
enum WalkDirection {
  RIGHT = 0,  // Bottom edge: tiles 0-7
  UP = 1,     // Right edge: tiles 8-15
  LEFT = 2,   // Top edge: tiles 16-23
  DOWN = 3,   // Left edge: tiles 24-31
}

interface TokenAnim {
  playerIndex: number;
  fromPos: number;
  toPos: number;
  startTime: number;
  duration: number;
  direction: WalkDirection;
}

const TOKEN_SIZE = 72;
const WALK_FRAME_INTERVAL = 150; // ms per frame

export class TokenRenderer {
  private board: Board;
  private activeAnims: TokenAnim[] = [];
  private displayPositions: Map<number, number> = new Map();
  private movingPlayers: Set<number> = new Set();
  private playerDirections: Map<number, WalkDirection> = new Map();
  private getImage: (characterId: string) => HTMLImageElement | undefined;
  private getWalkFrame: (characterId: string, frameIndex: number) => HTMLImageElement | undefined;

  constructor(
    board: Board,
    getImage: (id: string) => HTMLImageElement | undefined,
    getWalkFrame: (id: string, frameIndex: number) => HTMLImageElement | undefined,
  ) {
    this.board = board;
    this.getImage = getImage;
    this.getWalkFrame = getWalkFrame;
  }

  // Determine walking direction based on tile position
  private getDirectionForTile(tileIndex: number): WalkDirection {
    const side = Math.floor(tileIndex / TILES_PER_SIDE);
    switch (side) {
      case 0: return WalkDirection.RIGHT;  // Bottom: 0-7
      case 1: return WalkDirection.UP;     // Right: 8-15
      case 2: return WalkDirection.LEFT;   // Top: 16-23
      case 3: return WalkDirection.DOWN;   // Left: 24-31
      default: return WalkDirection.RIGHT;
    }
  }

  // Called by engine event: start a step animation for one tile
  animateStep(playerIndex: number, fromPos: number, toPos: number) {
    this.movingPlayers.add(playerIndex);
    const direction = this.getDirectionForTile(toPos);
    this.playerDirections.set(playerIndex, direction);
    this.activeAnims.push({
      playerIndex,
      fromPos,
      toPos,
      startTime: performance.now(),
      duration: 180,
      direction,
    });
  }

  draw(ctx: CanvasRenderingContext2D, state: GameState) {
    const now = performance.now();

    // Update animations
    this.updateAnims(now, state);

    // Group players by effective position for offset
    const posMap: Map<string, number[]> = new Map();
    for (const player of state.players) {
      if (player.bankrupt) continue;
      const pos = this.displayPositions.get(player.index) ?? player.position;
      const key = pos.toFixed(2);
      const group = posMap.get(key) || [];
      group.push(player.index);
      posMap.set(key, group);
    }

    for (const [, playerIndices] of posMap) {
      const count = playerIndices.length;
      playerIndices.forEach((pIdx, i) => {
        const player = state.players[pIdx];
        const pos = this.displayPositions.get(pIdx) ?? player.position;
        const worldPos = this.interpolateWorldPos(pos);

        // Offset to avoid overlap
        const offsetX = count > 1 ? (i - (count - 1) / 2) * 0.08 : 0;
        const offsetZ = count > 1 ? ((i % 2) - 0.5) * 0.06 : 0;

        const pos3D: Vec3 = {
          x: worldPos.x + offsetX,
          y: 0.06,
          z: worldPos.z + offsetZ,
        };
        const pos2D = this.board.project(pos3D);
        const isMoving = this.movingPlayers.has(pIdx);
        const direction = this.playerDirections.get(pIdx) ?? WalkDirection.RIGHT;

        this.drawToken(ctx, pos2D, player.color, player.name[0], player.characterId, isMoving, now, direction);
      });
    }
  }

  private updateAnims(now: number, state: GameState) {
    const done: TokenAnim[] = [];
    for (const anim of this.activeAnims) {
      const elapsed = now - anim.startTime;
      const t = Math.min(elapsed / anim.duration, 1);
      const eased = 1 - Math.pow(1 - t, 2);

      if (t >= 1) {
        this.displayPositions.set(anim.playerIndex, anim.toPos);
        done.push(anim);
      } else {
        const interp = anim.fromPos + eased * (anim.toPos - anim.fromPos);
        this.displayPositions.set(anim.playerIndex, interp);
      }
    }
    for (const d of done) {
      this.activeAnims = this.activeAnims.filter(a => a !== d);
    }
    for (const d of done) {
      const hasMore = this.activeAnims.some(a => a.playerIndex === d.playerIndex);
      if (!hasMore) {
        this.movingPlayers.delete(d.playerIndex);
      }
    }
  }

  private interpolateWorldPos(pos: number): Vec3 {
    const floor = Math.floor(pos);
    const frac = pos - floor;
    if (frac < 0.001) {
      return this.board.getTileWorldPos(floor % 32);
    }
    const p0 = this.board.getTileWorldPos(floor % 32);
    const p1 = this.board.getTileWorldPos((floor + 1) % 32);
    return {
      x: p0.x + (p1.x - p0.x) * frac,
      y: p0.y + (p1.y - p0.y) * frac,
      z: p0.z + (p1.z - p0.z) * frac,
    };
  }

  private drawToken(ctx: CanvasRenderingContext2D, pos: Vec2, color: string, initial: string, characterId: string, isMoving: boolean, now: number, direction: WalkDirection) {
    const size = TOKEN_SIZE;

    let img: HTMLImageElement | undefined;
    if (isMoving) {
      const frameIndex = Math.floor(now / WALK_FRAME_INTERVAL) % 4;
      img = this.getWalkFrame(characterId, frameIndex);
    }
    if (!img) {
      img = this.getImage(characterId);
    }

    // Determine if we need to flip the image based on direction
    // Original sprites face right, so flip for left-facing directions
    const shouldFlip = direction === WalkDirection.LEFT || direction === WalkDirection.DOWN;

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + size * 0.38, size * 0.3, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (shouldFlip) {
        // Flip horizontally
        ctx.translate(pos.x, pos.y - size * 0.7);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -size / 2, 0, size, size);
      } else {
        ctx.drawImage(img, pos.x - size / 2, pos.y - size * 0.7, size, size);
      }
      ctx.restore();

      const tagY = pos.y + size * 0.32;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      const tagW = 36;
      const tagH = 13;
      ctx.beginPath();
      ctx.moveTo(pos.x - tagW / 2 + 3, tagY - tagH / 2);
      ctx.lineTo(pos.x + tagW / 2 - 3, tagY - tagH / 2);
      ctx.quadraticCurveTo(pos.x + tagW / 2, tagY - tagH / 2, pos.x + tagW / 2, tagY - tagH / 2 + 3);
      ctx.lineTo(pos.x + tagW / 2, tagY + tagH / 2 - 3);
      ctx.quadraticCurveTo(pos.x + tagW / 2, tagY + tagH / 2, pos.x + tagW / 2 - 3, tagY + tagH / 2);
      ctx.lineTo(pos.x - tagW / 2 + 3, tagY + tagH / 2);
      ctx.quadraticCurveTo(pos.x - tagW / 2, tagY + tagH / 2, pos.x - tagW / 2, tagY + tagH / 2 - 3);
      ctx.lineTo(pos.x - tagW / 2, tagY - tagH / 2 + 3);
      ctx.quadraticCurveTo(pos.x - tagW / 2, tagY - tagH / 2, pos.x - tagW / 2 + 3, tagY - tagH / 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1.0;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, pos.x, tagY);
    } else {
      const r = 20;
      ctx.beginPath();
      ctx.ellipse(pos.x + 2, pos.y + 3, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      const grad = ctx.createRadialGradient(pos.x - 2, pos.y - 3, 1, pos.x, pos.y, r);
      grad.addColorStop(0, lighten(color, 60));
      grad.addColorStop(1, color);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, pos.x, pos.y + 1);
    }
  }
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}