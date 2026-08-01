import { GeminiConfig } from '../types';

const DEFAULT_CONFIG: GeminiConfig = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY ?? '',
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxTokens: 1024
};

const STORAGE_KEY = 'gemini_ai_config';

export class GeminiConfigManager {
  private static instance: GeminiConfigManager;
  private config: GeminiConfig;
  private listeners: ((config: GeminiConfig) => void)[] = [];

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): GeminiConfigManager {
    if (!GeminiConfigManager.instance) {
      GeminiConfigManager.instance = new GeminiConfigManager();
    }
    return GeminiConfigManager.instance;
  }

  private loadConfig(): GeminiConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 只有当保存的apiKey有效时才使用保存的配置
        if (parsed && parsed.apiKey && parsed.apiKey.length > 0) {
          return { ...DEFAULT_CONFIG, ...parsed };
        }
      }
    } catch (error) {
      console.error('Failed to load Gemini config:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save Gemini config:', error);
    }
  }

  getConfig(): GeminiConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<GeminiConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.saveConfig();
  }

  getApiKey(): string {
    return this.config.apiKey;
  }

  isConfigured(): boolean {
    return this.config.apiKey.length > 0;
  }

  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig();
  }

  onConfigChange(callback: (config: GeminiConfig) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback({ ...this.config }));
  }
}
