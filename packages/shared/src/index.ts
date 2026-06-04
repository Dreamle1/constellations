export interface WordCardModel {
  id: string;
  word: string;
}

export interface GameWordsResponse {
  words: WordCardModel[];
  theme: string;
  api?: {
    request?: {
      id: string;
      method: string;
      path: string;
      query: Record<string, string>;
      timestamp: string;
      userAgent?: string;
      ip?: string;
    };
    generation: {
      provider: 'openai' | 'local';
      model?: string;
      source: 'provider' | 'fallback';
      durationMs: number;
      promptLength?: number;
      fallbackReason?: string;
      error?: {
        type: string;
        message: string;
        cause?: string;
        status?: number;
      };
    };
  };
}
