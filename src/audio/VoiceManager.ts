import { CHARACTER_DEFS } from '../constants';

const VOICE_IDS = [
  'select', 'turnStart', 'roll', 'buyProperty', 'payRent', 'getRent',
  'passGo', 'goToJail', 'escapeJail', 'chancePlus', 'chanceMinus',
  'bankrupt', 'win',
] as const;

export type VoiceId = typeof VOICE_IDS[number];

export class VoiceManager {
  private cache = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;
  private volume = 0.8;
  private loaded = false;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  preload() {
    if (this.loaded) return;
    this.loaded = true;
    for (const ch of CHARACTER_DEFS) {
      for (const vid of VOICE_IDS) {
        const path = `/voices/${ch.id}/${vid}.mp3`;
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = path;
        this.cache.set(`${ch.id}/${vid}`, audio);
      }
    }
  }

  play(characterId: string, voiceId: VoiceId) {
    const key = `${characterId}/${voiceId}`;
    const audio = this.cache.get(key);
    if (!audio) return;

    // Stop current voice
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
    }

    audio.volume = this.volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    this.current = audio;
  }

  stop() {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  }
}
