import { SoundManager, SoundId } from './SoundManager';
import { VoiceManager, VoiceId } from './VoiceManager';

export interface AudioSettings {
  soundEnabled: boolean;
  voiceEnabled: boolean;
  soundVolume: number;
  voiceVolume: number;
}

const SETTINGS_KEY = 'monopoly_audio_settings';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private soundManager: SoundManager | null = null;
  private voiceManager: VoiceManager;
  private unlocked = false;
  private settings: AudioSettings;

  constructor() {
    this.voiceManager = new VoiceManager();
    this.settings = this.loadSettings();
    this.applySettings();
  }

  private loadSettings(): AudioSettings {
    const defaults: AudioSettings = {
      soundEnabled: true,
      voiceEnabled: true,
      soundVolume: 0.5,
      voiceVolume: 0.7,
    };

    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load audio settings:', e);
    }
    return defaults;
  }

  private saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save audio settings:', e);
    }
  }

  private applySettings() {
    if (this.soundManager) {
      this.soundManager.setVolume(this.settings.soundVolume);
      this.soundManager.setMuted(!this.settings.soundEnabled);
    }
    this.voiceManager.setVolume(this.settings.voiceVolume);
    this.voiceManager.setMuted(!this.settings.voiceEnabled);
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.applySettings();
  }

  toggleSound() {
    this.settings.soundEnabled = !this.settings.soundEnabled;
    this.saveSettings();
    this.applySettings();
  }

  toggleVoice() {
    this.settings.voiceEnabled = !this.settings.voiceEnabled;
    this.saveSettings();
    this.applySettings();
  }

  setSoundVolume(v: number) {
    this.settings.soundVolume = Math.max(0, Math.min(1, v));
    this.saveSettings();
    if (this.soundManager) {
      this.soundManager.setVolume(this.settings.soundVolume);
    }
  }

  setVoiceVolume(v: number) {
    this.settings.voiceVolume = Math.max(0, Math.min(1, v));
    this.saveSettings();
    this.voiceManager.setVolume(this.settings.voiceVolume);
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    this.ctx = new AudioContext();
    this.soundManager = new SoundManager(this.ctx);
    this.voiceManager.preload();

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.applySettings();
  }

  playSound(id: SoundId) {
    if (!this.soundManager || !this.settings.soundEnabled) return;
    this.soundManager.play(id);
  }

  playVoice(characterId: string, voiceId: VoiceId) {
    if (!this.settings.voiceEnabled) return;
    this.voiceManager.play(characterId, voiceId);
  }

  isSoundEnabled(): boolean {
    return this.settings.soundEnabled;
  }

  isVoiceEnabled(): boolean {
    return this.settings.voiceEnabled;
  }

  getSoundVolume(): number {
    return this.settings.soundVolume;
  }

  getVoiceVolume(): number {
    return this.settings.voiceVolume;
  }
}
