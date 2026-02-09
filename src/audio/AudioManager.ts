import { SoundManager, SoundId } from './SoundManager';
import { VoiceManager, VoiceId } from './VoiceManager';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private soundManager: SoundManager | null = null;
  private voiceManager: VoiceManager;
  private unlocked = false;

  constructor() {
    this.voiceManager = new VoiceManager();
  }

  /** Call on first user interaction to unlock AudioContext (browser policy) */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    this.ctx = new AudioContext();
    this.soundManager = new SoundManager(this.ctx);
    this.voiceManager.preload();

    // Resume if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playSound(id: SoundId) {
    if (!this.soundManager) return;
    this.soundManager.play(id);
  }

  playVoice(characterId: string, voiceId: VoiceId) {
    this.voiceManager.play(characterId, voiceId);
  }

  setSoundVolume(v: number) {
    this.soundManager?.setVolume(v);
  }

  setVoiceVolume(v: number) {
    this.voiceManager.setVolume(v);
  }
}
