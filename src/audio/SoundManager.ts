export type SoundId =
  | 'dice' | 'step' | 'coin' | 'buy' | 'rent'
  | 'build' | 'jail' | 'chance' | 'bankrupt'
  | 'victory' | 'click' | 'turnStart';

export class SoundManager {
  private ctx: AudioContext;
  private volume = 0.5;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  play(id: SoundId) {
    const fn = this.sounds[id];
    if (fn) fn();
  }

  private gain(v = this.volume): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(this.ctx.destination);
    return g;
  }

  private sounds: Record<SoundId, () => void> = {
    dice: () => this.playDice(),
    step: () => this.playStep(),
    coin: () => this.playCoin(),
    buy: () => this.playBuy(),
    rent: () => this.playRent(),
    build: () => this.playBuild(),
    jail: () => this.playJail(),
    chance: () => this.playChance(),
    bankrupt: () => this.playBankrupt(),
    victory: () => this.playVictory(),
    click: () => this.playClick(),
    turnStart: () => this.playTurnStart(),
  };

  // --- Sound implementations ---

  private playDice() {
    const t = this.ctx.currentTime;
    // White noise burst + high-freq oscillation
    const bufLen = this.ctx.sampleRate * 0.15;
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.gain(this.volume * 0.4);
    g.gain.setValueAtTime(this.volume * 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(g);
    src.start(t);

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    const g2 = this.gain(this.volume * 0.15);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g2);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private playStep() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.06);
    const g = this.gain(this.volume * 0.3);
    g.gain.setValueAtTime(this.volume * 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  private playCoin() {
    const t = this.ctx.currentTime;
    // Rising arpeggio ding
    const freqs = [1200, 1500, 1800, 2400];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.gain(this.volume * 0.2);
      g.gain.setValueAtTime(0.001, t + i * 0.08);
      g.gain.linearRampToValueAtTime(this.volume * 0.2, t + i * 0.08 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.2);
      osc.connect(g);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.25);
    });
  }

  private playBuy() {
    const t = this.ctx.currentTime;
    // Cash register ding
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 2000;
    const g = this.gain(this.volume * 0.3);
    g.gain.setValueAtTime(this.volume * 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.35);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 2500;
    const g2 = this.gain(this.volume * 0.2);
    g2.gain.setValueAtTime(0.001, t + 0.05);
    g2.gain.linearRampToValueAtTime(this.volume * 0.2, t + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(g2);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.4);
  }
  private playRent() {
    const t = this.ctx.currentTime;
    // Descending tone
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    const g = this.gain(this.volume * 0.15);
    g.gain.setValueAtTime(this.volume * 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private playBuild() {
    const t = this.ctx.currentTime;
    // Hammer hits
    for (let i = 0; i < 3; i++) {
      const offset = i * 0.12;
      const bufLen = this.ctx.sampleRate * 0.06;
      const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufLen; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufLen * 0.15));
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.gain(this.volume * 0.35);
      g.gain.setValueAtTime(this.volume * 0.35, t + offset);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.08);
      src.connect(g);
      src.start(t + offset);
    }
  }

  private playJail() {
    const t = this.ctx.currentTime;
    // Low metallic clang
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);
    const g = this.gain(this.volume * 0.25);
    g.gain.setValueAtTime(this.volume * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.65);

    // Metallic overtone
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(300, t);
    osc2.frequency.exponentialRampToValueAtTime(80, t + 0.4);
    const g2 = this.gain(this.volume * 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc2.connect(g2);
    osc2.start(t);
    osc2.stop(t + 0.45);
  }

  private playChance() {
    const t = this.ctx.currentTime;
    // Card flip whoosh + ding
    const bufLen = this.ctx.sampleRate * 0.1;
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    const g = this.gain(this.volume * 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(hp);
    hp.connect(g);
    src.start(t);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1800;
    const g2 = this.gain(this.volume * 0.2);
    g2.gain.setValueAtTime(0.001, t + 0.08);
    g2.gain.linearRampToValueAtTime(this.volume * 0.2, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g2);
    osc.start(t + 0.08);
    osc.stop(t + 0.35);
  }
  private playBankrupt() {
    const t = this.ctx.currentTime;
    // Sad descending tones
    const notes = [400, 350, 280, 200];
    notes.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.gain(this.volume * 0.2);
      g.gain.setValueAtTime(0.001, t + i * 0.2);
      g.gain.linearRampToValueAtTime(this.volume * 0.2, t + i * 0.2 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.25);
      osc.connect(g);
      osc.start(t + i * 0.2);
      osc.stop(t + i * 0.2 + 0.3);
    });
  }

  private playVictory() {
    const t = this.ctx.currentTime;
    // Rising fanfare chord
    const chords = [
      [523, 659, 784],  // C major
      [587, 740, 880],  // D major
      [659, 830, 988],  // E major
      [784, 988, 1175], // G major
    ];
    chords.forEach((chord, ci) => {
      chord.forEach(f => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = this.gain(this.volume * 0.12);
        g.gain.setValueAtTime(0.001, t + ci * 0.2);
        g.gain.linearRampToValueAtTime(this.volume * 0.12, t + ci * 0.2 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + ci * 0.2 + 0.5);
        osc.connect(g);
        osc.start(t + ci * 0.2);
        osc.stop(t + ci * 0.2 + 0.55);
      });
    });
  }

  private playClick() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1000;
    const g = this.gain(this.volume * 0.15);
    g.gain.setValueAtTime(this.volume * 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  private playTurnStart() {
    const t = this.ctx.currentTime;
    // Gentle two-note chime
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 880;
    const g1 = this.gain(this.volume * 0.15);
    g1.gain.setValueAtTime(this.volume * 0.15, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc1.connect(g1);
    osc1.start(t);
    osc1.stop(t + 0.25);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 1320;
    const g2 = this.gain(this.volume * 0.15);
    g2.gain.setValueAtTime(0.001, t + 0.1);
    g2.gain.linearRampToValueAtTime(this.volume * 0.15, t + 0.11);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(g2);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.4);
  }
}
