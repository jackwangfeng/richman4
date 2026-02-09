import { Animation } from '../types';

export class AnimationManager {
  private animations: Animation[] = [];
  private nextId = 0;

  add(anim: Omit<Animation, 'id' | 'startTime' | 'current'>): Promise<void> {
    return new Promise(resolve => {
      const a: Animation = {
        ...anim,
        id: this.nextId++,
        startTime: performance.now(),
        current: { ...anim.from },
        resolve,
      };
      this.animations.push(a);
    });
  }

  update(now: number) {
    const done: Animation[] = [];
    for (const anim of this.animations) {
      const elapsed = now - anim.startTime;
      let progress = Math.min(elapsed / anim.duration, 1);
      // Ease out cubic
      progress = 1 - Math.pow(1 - progress, 3);

      if (anim.onUpdate) {
        anim.onUpdate(progress, anim);
      }

      if (elapsed >= anim.duration) {
        done.push(anim);
      }
    }
    for (const anim of done) {
      this.animations = this.animations.filter(a => a.id !== anim.id);
      if (anim.resolve) anim.resolve();
    }
  }

  get active(): Animation[] {
    return this.animations;
  }

  get hasAnimations(): boolean {
    return this.animations.length > 0;
  }
}
