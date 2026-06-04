import { WORD_CHAIN_PROMPT } from './prompts/wordChainPrompt';
import { DailyWordStore } from './dailyWordStore';

export interface WordItem {
  id: string;
  word: string;
}

export interface GeneratedWordsResponse {
  words: WordItem[];
  answer: string[];
  answerKey: string[];
  theme: string;
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
  source: 'provider' | 'fallback' | 'database';
  durationMs: number;
  promptLength?: number;
  fallbackReason?: string;
  error?: ProviderErrorInfo;
}

export interface ProviderErrorInfo {
  type: string;
  message: string;
  cause?: string;
  status?: number;
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

interface WordChainResponse {
  answer: string[];
  answerKey: string[];
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

const WORD_COUNT = 5;
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const API_KEY_PLACEHOLDERS = new Set([
  'your_api_key_here',
  'your_openai_api_key_here',
  'sk-your_openai_api_key_here',
]);

const FALLBACK_WORDS_BY_THEME: Record<string, string[]> = {
  constellation: ['star', 'moon', 'orbit', 'nova', 'comet'],
  space: ['nebula', 'galaxy', 'meteor', 'eclipse', 'quasar'],
  ocean: ['coral', 'tide', 'reef', 'current', 'lagoon'],
  forest: ['moss', 'fern', 'cedar', 'acorn', 'canopy'],
  fantasy: ['dragon', 'rune', 'quest', 'charm', 'castle'],
  music: ['melody', 'rhythm', 'chorus', 'tempo', 'harmony'],
  sports: ['rally', 'sprint', 'goal', 'match', 'score'],
};

const DISPLAY_ORDER = [2, 0, 4, 1, 3] as const;

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
        'OPENAI_API_KEY is not set. Using local fallback words. Add it to packages/backend/.env to enable OpenAI generation.',
      );
      this.apiKey = null;
      return;
    }

    this.apiKey = apiKey;
  }

  async generateWords(theme: string): Promise<GeneratedWordsResponse> {
    const normalizedTheme = theme.trim() || 'constellation';
    const currentPacificDate = this.getPacificDateKey();
    const cachedWords = await this.dailyWordStore.getCurrent(currentPacificDate);

    if (cachedWords) {
      return {
        words: cachedWords.words,
        answer: cachedWords.answer,
        answerKey: cachedWords.answerKey,
        theme: cachedWords.theme,
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
      const response = this.createFallbackResponse(normalizedTheme, {
        provider: 'local',
        source: 'fallback',
        durationMs: 0,
        fallbackReason: 'missing_openai_api_key',
      });
      await this.saveDailyWords(currentPacificDate, response);
      return response;
    }

    const startedAt = Date.now();
    const prompt = this.createPrompt();
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
          instructions:
            'You generate short, playable word-card content. Return only valid JSON that matches the requested schema.',
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

      const wordStrings = this.parseWordChainResponse(text).answer;

      if (wordStrings.length < WORD_COUNT) {
        console.warn(
          `Expected ${WORD_COUNT} words but got ${wordStrings.length}. Using fallback words. Response: ${text}`,
        );
        const fallbackResponse = this.createFallbackResponse(normalizedTheme, {
          ...baseGenerationInfo,
          source: 'fallback',
          durationMs: Date.now() - startedAt,
          fallbackReason: 'provider_returned_too_few_words',
        });
        await this.saveDailyWords(currentPacificDate, fallbackResponse);
        return fallbackResponse;
      }

      const generatedResponse: GeneratedWordsResponse = {
        ...this.toGameWords(wordStrings),
        theme: normalizedTheme,
        api: {
          generation: {
            ...baseGenerationInfo,
            source: 'provider',
            durationMs: Date.now() - startedAt,
          },
        },
      };
      await this.saveDailyWords(currentPacificDate, generatedResponse);
      return generatedResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorInfo = this.getProviderErrorInfo(error);

      if (this.isProviderNetworkError(error)) {
        console.warn(`OpenAI API unavailable (${message}). Falling back to local words.`);
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

      const fallbackResponse = this.createFallbackResponse(normalizedTheme, {
        ...baseGenerationInfo,
        source: 'fallback',
        durationMs: Date.now() - startedAt,
        fallbackReason: this.isProviderNetworkError(error)
          ? 'provider_network_error'
          : 'provider_error',
        error: errorInfo,
      });
      await this.saveDailyWords(currentPacificDate, fallbackResponse);
      return fallbackResponse;
    }
  }

  private createPrompt(): string {
    return WORD_CHAIN_PROMPT;
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
    response: GeneratedWordsResponse,
  ): Promise<void> {
    await this.dailyWordStore.save({
      date,
      theme: response.theme,
      words: response.words,
      answer: response.answer,
      answerKey: response.answerKey,
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

  private parseWordChainResponse(text: string): WordChainResponse {
    const parsed = this.parseJsonObject(text) as Partial<WordChainResponse> | null;
    const answer = Array.isArray(parsed?.answer)
      ? parsed.answer.map((word) => String(word))
      : this.parseWords(text);
    const normalizedAnswer = this.normalizeWords(answer);

    return {
      answer: normalizedAnswer,
      answerKey: normalizedAnswer.map((_, index) => `card-${index}`),
    };
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

    return this.normalizeWords(words);
  }

  private normalizeWords(words: string[]): string[] {
    const normalizedWords = words
      .map((word) => word.trim().toLowerCase())
      .filter((word) => /^[a-z][a-z'-]{1,18}$/.test(word));

    return Array.from(new Set(normalizedWords)).slice(0, WORD_COUNT);
  }

  private createFallbackResponse(
    theme: string,
    generation: GenerationInfo,
  ): GeneratedWordsResponse {
    return {
      ...this.toGameWords(this.getFallbackWords(theme)),
      theme,
      api: {
        generation,
      },
    };
  }

  private getFallbackWords(theme: string): string[] {
    const normalizedTheme = theme.toLowerCase();
    const matchingTheme = Object.keys(FALLBACK_WORDS_BY_THEME).find((key) =>
      normalizedTheme.includes(key),
    );

    if (matchingTheme) {
      return FALLBACK_WORDS_BY_THEME[matchingTheme];
    }

    const themeWord = normalizedTheme.replace(/[^a-z'-]/g, '').slice(0, 18);
    return [themeWord || 'spark', 'story', 'mystery', 'wonder', 'quest'];
  }

  private toWordItems(wordStrings: string[]): WordItem[] {
    return wordStrings.map((word, index) => ({
      id: `card-${index}`,
      word,
    }));
  }

  private toGameWords(answer: string[]): Pick<GeneratedWordsResponse, 'words' | 'answer' | 'answerKey'> {
    const orderedWords = this.toWordItems(answer);
    const answerKey = orderedWords.map((word) => word.id);
    const words = DISPLAY_ORDER.map((index) => orderedWords[index]).filter(
      (word): word is WordItem => Boolean(word),
    );

    return {
      words,
      answer,
      answerKey,
    };
  }
}
