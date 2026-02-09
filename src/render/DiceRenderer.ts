import { DiceResult } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

export class DiceRenderer {
  private animating = false;
  private animStart = 0;
  private animDuration = 1000;
  private currentFaces = [1, 1];
  private finalResult: DiceResult | null = null;

  startAnimation(result: DiceResult) {
    this.finalResult = result;
    this.animating = true;
    this.animStart = performance.now();
  }

  draw(ctx: CanvasRenderingContext2D, now: number, dice: DiceResult | null) {
    if (!dice && !this.animating) return;

    const elapsed = now - this.animStart;
    let die1: number, die2: number;

    if (this.animating && elapsed < this.animDuration) {
      // Randomize faces during animation
      const speed = Math.max(50, 200 - elapsed * 0.2);
      if (elapsed % speed < 16) {
        this.currentFaces[0] = Math.floor(Math.random() * 6) + 1;
        this.currentFaces[1] = Math.floor(Math.random() * 6) + 1;
      }
      die1 = this.currentFaces[0];
      die2 = this.currentFaces[1];
    } else {
      if (this.animating) {
        this.animating = false;
      }
      if (!dice) return;
      die1 = dice.die1;
      die2 = dice.die2;
    }

    // Draw dice in center of board area
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2 + 10;
    const size = 36;
    const gap = 8;

    this.drawDie(ctx, cx - size - gap / 2, cy, size, die1);
    this.drawDie(ctx, cx + gap / 2, cy, size, die2);
  }

  private drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, face: number) {
    const r = 6;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    this.roundRect(ctx, x + 3, y + 3, size, size, r);
    ctx.fill();

    // Die body
    ctx.fillStyle = '#fff';
    this.roundRect(ctx, x, y, size, size, r);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, y, size, size, r);
    ctx.stroke();

    // Dots
    ctx.fillStyle = '#333';
    const dotR = size * 0.08;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const off = size * 0.25;

    const dots: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [[-off, -off], [off, off]],
      3: [[-off, -off], [0, 0], [off, off]],
      4: [[-off, -off], [off, -off], [-off, off], [off, off]],
      5: [[-off, -off], [off, -off], [0, 0], [-off, off], [off, off]],
      6: [[-off, -off], [off, -off], [-off, 0], [off, 0], [-off, off], [off, off]],
    };

    for (const [dx, dy] of dots[face] || []) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
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
