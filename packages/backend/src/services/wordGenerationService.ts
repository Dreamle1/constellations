import { createWordChainPrompt } from './prompts/wordChainPrompt';
import { DailyWordStore } from './dailyWordStore';

export interface WordItem {
  id: string;
  word: string;
}

export interface GeneratedWordsResponse {
  words: WordItem[];
  answer: string[];
  answerKey: string[];
  wordCount: number;
  api?: {
    request?: ApiRequestInfo;
    generation: GenerationInfo;
  };
}

export interface ApiRequestInfo {
  id: string;
  method: string;
  path: string;
  query: Record<string, string>;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

export interface GenerationInfo {
  provider: 'openai' | 'local';
  model?: string;
  source: 'provider' | 'database';
  durationMs: number;
  promptLength?: number;
  error?: ProviderErrorInfo;
}

export interface ProviderErrorInfo {
  type: string;
  message: string;
  cause?: string;
  status?: number;
}

export class WordGenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: ProviderErrorInfo,
  ) {
    super(message);
    this.name = 'WordGenerationError';
  }
}

interface OpenAIResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

interface WordChainProviderResponse {
  answer: string[];
}

class ProviderApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly causeMessage?: string,
  ) {
    super(message);
    this.name = 'ProviderApiError';
  }
}

const SUPPORTED_WORD_COUNTS = [5, 7, 9] as const;
type SupportedWordCount = (typeof SUPPORTED_WORD_COUNTS)[number];
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const API_KEY_PLACEHOLDERS = new Set([
  'your_api_key_here',
  'your_openai_api_key_here',
  'sk-your_openai_api_key_here',
]);

const DISPLAY_ORDERS: Record<SupportedWordCount, number[]> = {
  5: [2, 0, 4, 1, 3],
  7: [3, 0, 5, 1, 6, 2, 4],
  9: [4, 0, 7, 2, 8, 1, 6, 3, 5],
};

export class WordGenerationService {
  private apiKey: string | null;
  private model: string;
  private dailyWordStore: DailyWordStore;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    this.model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
    this.dailyWordStore = new DailyWordStore();

    if (!apiKey || API_KEY_PLACEHOLDERS.has(apiKey)) {
      console.warn(
        'OPENAI_API_KEY is not set. Add it to packages/backend/.env to enable word generation.',
      );
      this.apiKey = null;
      return;
    }

    this.apiKey = apiKey;
  }

  async generateWords(wordCount: number): Promise<GeneratedWordsResponse> {
    const requestedWordCount = this.normalizeWordCount(wordCount);
    const currentPacificDate = this.getPacificDateKey();
    const cachedWords = await this.dailyWordStore.getCurrent(
      currentPacificDate,
      requestedWordCount,
    );

    if (cachedWords) {
      return {
        ...this.toGameWords(cachedWords.answer, requestedWordCount),
        api: {
          generation: {
            provider: 'local',
            source: 'database',
            durationMs: 0,
          },
        },
      };
    }

    if (!this.apiKey) {
      throw new WordGenerationError(
        'SERVICE_UNCONFIGURED',
        'Word generation service is not configured.',
      );
    }

    const startedAt = Date.now();
    const recentWords = await this.dailyWordStore.getRecentWords(currentPacificDate, 7);
    const prompt = this.createPrompt(requestedWordCount, recentWords);
    const baseGenerationInfo = {
      provider: 'openai' as const,
      model: this.model,
      promptLength: prompt.length,
    };

    try {
      console.log('Calling OpenAI Responses API...');
      console.log('  Endpoint:', OPENAI_RESPONSES_URL);
      console.log('  Model:', this.model);
      console.log('  Prompt Length:', prompt.length);
      console.log('  Prompt:', prompt);

      const providerResponse = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: prompt,
          max_output_tokens: 220,
        }),
      });

      const responseBody = await this.parseOpenAIResponse(providerResponse);

      console.log('OpenAI API response received');
      console.log('  Status:', providerResponse.status);
      console.log('  Raw response:', responseBody);

      const text = this.getGeneratedText(responseBody).trim();

      console.log('Generated text:', text);

      const wordStrings = this.parseWordChainAnswer(text, requestedWordCount);

      if (wordStrings.length < requestedWordCount) {
        console.warn(
          `Expected ${requestedWordCount} words but got ${wordStrings.length}. Response: ${text}`,
        );
        throw new WordGenerationError(
          'PROVIDER_INVALID_RESPONSE',
          'Word generation provider returned too few words.',
          {
            type: 'ProviderInvalidResponse',
            message: `Expected ${requestedWordCount} words but got ${wordStrings.length}.`,
          },
        );
      }

      const generatedResponse: GeneratedWordsResponse = {
        ...this.toGameWords(wordStrings, requestedWordCount),
        api: {
          generation: {
            ...baseGenerationInfo,
            source: 'provider',
            durationMs: Date.now() - startedAt,
          },
        },
      };
      await this.saveDailyWords(currentPacificDate, requestedWordCount, generatedResponse);
      return generatedResponse;
    } catch (error) {
      if (error instanceof WordGenerationError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      const errorInfo = this.getProviderErrorInfo(error);

      if (this.isProviderNetworkError(error)) {
        console.warn(`OpenAI API unavailable (${message}).`);
        if (errorInfo.cause) {
          console.warn('  Cause:', errorInfo.cause);
        }
      } else {
        console.error('OpenAI API Error:');
        console.error('  Type:', errorInfo.type);
        console.error('  Message:', errorInfo.message);
        if (errorInfo.status) {
          console.error('  Status:', errorInfo.status);
        }
        if (errorInfo.cause) {
          console.error('  Cause:', errorInfo.cause);
        }
      }

      throw new WordGenerationError(
        this.isProviderNetworkError(error)
          ? 'PROVIDER_NETWORK_ERROR'
          : 'PROVIDER_ERROR',
        'Word generation provider is unavailable.',
        errorInfo,
      );
    }
  }

  private normalizeWordCount(wordCount: number): SupportedWordCount {
    return SUPPORTED_WORD_COUNTS.includes(wordCount as SupportedWordCount)
      ? (wordCount as SupportedWordCount)
      : 5;
  }

  private createPrompt(wordCount: SupportedWordCount, recentWords: string[]): string {
    return createWordChainPrompt(wordCount, recentWords);
  }

  private getPacificDateKey(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const getPart = (type: string) => parts.find((part) => part.type === type)?.value;
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  }

  private async saveDailyWords(
    date: string,
    wordCount: SupportedWordCount,
    response: GeneratedWordsResponse,
  ): Promise<void> {
    await this.dailyWordStore.save({
      date,
      wordCount,
      answer: response.answer,
      createdAt: new Date().toISOString(),
    });
  }

  private async parseOpenAIResponse(response: Response): Promise<OpenAIResponse> {
    const text = await response.text();
    const body = this.parseJson(text);

    if (!response.ok) {
      const errorMessage =
        body?.error?.message || text || `OpenAI request failed with status ${response.status}`;
      const errorCause = body?.error?.code || body?.error?.type;

      throw new ProviderApiError(errorMessage, response.status, errorCause);
    }

    if (!body) {
      throw new ProviderApiError('OpenAI returned an empty or non-JSON response.', response.status);
    }

    return body;
  }

  private parseJson(text: string): OpenAIResponse | null {
    try {
      return JSON.parse(text) as OpenAIResponse;
    } catch {
      return null;
    }
  }

  private isProviderNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return ['fetch failed', 'terminated', 'network error'].includes(error.message.toLowerCase());
  }

  private getProviderErrorInfo(error: unknown): ProviderErrorInfo {
    if (!(error instanceof Error)) {
      return {
        type: typeof error,
        message: String(error),
      };
    }

    const cause = this.getErrorCause(error);
    const status = this.getErrorStatus(error);

    return {
      type: error.constructor.name,
      message: error.message,
      ...(cause ? { cause } : {}),
      ...(status ? { status } : {}),
    };
  }

  private getErrorCause(error: Error): string | undefined {
    if (error instanceof ProviderApiError) {
      return error.causeMessage;
    }

    const errorWithCause = error as Error & { cause?: unknown };
    const cause = errorWithCause.cause;

    if (!cause) {
      return undefined;
    }

    if (cause instanceof Error) {
      return cause.message;
    }

    if (typeof cause === 'object') {
      const maybeCause = cause as { code?: unknown; message?: unknown };
      const code = typeof maybeCause.code === 'string' ? maybeCause.code : undefined;
      const message =
        typeof maybeCause.message === 'string' ? maybeCause.message : undefined;

      return [code, message].filter(Boolean).join(': ') || undefined;
    }

    return String(cause);
  }

  private getErrorStatus(error: Error): number | undefined {
    if (error instanceof ProviderApiError) {
      return error.status;
    }

    const errorWithStatus = error as Error & { status?: unknown; response?: { status?: unknown } };

    if (typeof errorWithStatus.status === 'number') {
      return errorWithStatus.status;
    }

    if (typeof errorWithStatus.response?.status === 'number') {
      return errorWithStatus.response.status;
    }

    return undefined;
  }

  private getGeneratedText(response: OpenAIResponse): string {
    if (typeof response.output_text === 'string') {
      return response.output_text;
    }

    return (
      response.output
        ?.flatMap((outputItem) => outputItem.content ?? [])
        .filter((content) => content.type === 'output_text' && typeof content.text === 'string')
        .map((content) => content.text)
        .join('\n') ?? ''
    );
  }

  private parseWordChainAnswer(
    text: string,
    wordCount: SupportedWordCount,
  ): string[] {
    const parsed = this.parseJsonObject(text) as Partial<WordChainProviderResponse> | null;
    const answer = Array.isArray(parsed?.answer)
      ? parsed.answer.map((word) => String(word))
      : this.parseWords(text);

    return this.normalizeWords(answer, wordCount);
  }

  private parseJsonObject(text: string): unknown | null {
    const trimmed = text.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  private parseWords(text: string): string[] {
    const words = text
      .replace(/^\s*\[|\]\s*$/g, '')
      .split(/,|\n|->|\u2192/)
      .map((word) => word.replace(/^\s*[-*\d.)]+\s*/, '').replace(/^["']|["']$/g, ''));

    return this.normalizeWords(words, 9);
  }

  private normalizeWords(words: string[], wordCount: SupportedWordCount): string[] {
    const normalizedWords = words
      .map((word) => word.trim().toLowerCase())
      .filter((word) => /^[a-z][a-z'-]{1,18}$/.test(word));

    return Array.from(new Set(normalizedWords)).slice(0, wordCount);
  }

  private toWordItems(wordStrings: string[]): WordItem[] {
    return wordStrings.map((word, index) => ({
      id: `card-${index}`,
      word,
    }));
  }

  private toGameWords(
    answer: string[],
    wordCount: SupportedWordCount,
  ): Pick<GeneratedWordsResponse, 'words' | 'answer' | 'answerKey' | 'wordCount'> {
    const orderedWords = this.toWordItems(answer);
    const answerKey = orderedWords.map((word) => word.id);
    const words = DISPLAY_ORDERS[wordCount].map((index) => orderedWords[index]).filter(
      (word): word is WordItem => Boolean(word),
    );

    return {
      words,
      answer,
      answerKey,
      wordCount,
    };
  }
}
