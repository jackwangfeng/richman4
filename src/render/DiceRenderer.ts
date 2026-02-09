import { DiceResult } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

export class DiceRenderer {
  private animating = false;
  private animStart = 0;
  private animDuration = 1000;
  private currentFaces = [1, 1];
  private finalResult: DiceResult | null = null;
  private rotation = [0, 0];
  private bounce = [0, 0];
  private bounceVelocity = [0, 0];

  startAnimation(result: DiceResult) {
    this.finalResult = result;
    this.animating = true;
    this.animStart = performance.now();
    this.rotation = [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2];
    this.bounce = [0, 0];
    this.bounceVelocity = [-8 - Math.random() * 4, -10 - Math.random() * 4];
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

      // Update rotation (slowing down over time)
      const rotationSpeed = Math.max(0, 0.3 - elapsed * 0.0003);
      this.rotation[0] += rotationSpeed;
      this.rotation[1] += rotationSpeed * 1.1;

      // Update bounce physics
      const gravity = 0.5;
      for (let i = 0; i < 2; i++) {
        this.bounceVelocity[i] += gravity;
        this.bounce[i] += this.bounceVelocity[i];
        if (this.bounce[i] > 0) {
          this.bounce[i] = 0;
          this.bounceVelocity[i] = -this.bounceVelocity[i] * 0.5;
          if (Math.abs(this.bounceVelocity[i]) < 1) {
            this.bounceVelocity[i] = 0;
          }
        }
      }
    } else {
      if (this.animating) {
        this.animating = false;
        this.rotation = [0, 0];
        this.bounce = [0, 0];
      }
      if (!dice) return;
      die1 = dice.die1;
      die2 = dice.die2;
    }

    // Draw dice in center of board area
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2 + 10;
    const size = 40;
    const gap = 12;

    const animProgress = this.animating ? Math.min(1, elapsed / this.animDuration) : 1;
    const rot1 = this.animating ? this.rotation[0] * (1 - animProgress) : 0;
    const rot2 = this.animating ? this.rotation[1] * (1 - animProgress) : 0;

    this.drawDie(ctx, cx - size - gap / 2, cy + this.bounce[0], size, die1, rot1);
    this.drawDie(ctx, cx + gap / 2, cy + this.bounce[1], size, die2, rot2);
  }

  private drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, face: number, rotation: number = 0) {
    const r = 8;

    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(rotation);
    ctx.translate(-size / 2, -size / 2);

    // Enhanced shadow with blur
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    // Die body with gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#f5f5f5');
    gradient.addColorStop(1, '#e8e8e8');
    ctx.fillStyle = gradient;
    this.roundRect(ctx, 0, 0, size, size, r);
    ctx.fill();

    // Reset shadow for border
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    this.roundRect(ctx, 0, 0, size, size, r);
    ctx.stroke();

    // Inner highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, 2, 2, size - 4, size - 4, r - 1);
    ctx.stroke();

    // Dots
    ctx.fillStyle = '#222';
    const dotR = size * 0.09;
    const cx = size / 2;
    const cy = size / 2;
    const off = size * 0.26;

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

    ctx.restore();
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
