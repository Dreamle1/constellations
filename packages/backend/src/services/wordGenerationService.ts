import { WORD_CHAIN_PROMPT } from './prompts/wordChainPrompt';

export interface WordItem {
  id: string;
  word: string;
}

export interface GeneratedWordsResponse {
  words: WordItem[];
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
  source: 'provider' | 'fallback';
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

export class WordGenerationService {
  private apiKey: string | null;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    this.model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;

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

    if (!this.apiKey) {
      return this.createFallbackResponse(normalizedTheme, {
        provider: 'local',
        source: 'fallback',
        durationMs: 0,
        fallbackReason: 'missing_openai_api_key',
      });
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

      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          instructions:
            'You generate short, playable word-card content. Return only the requested words, with no explanations.',
          input: prompt,
          max_output_tokens: 80,
        }),
      });

      const responseBody = await this.parseOpenAIResponse(response);

      console.log('OpenAI API response received');
      console.log('  Status:', response.status);
      console.log('  Raw response:', responseBody);

      const text = this.getGeneratedText(responseBody).trim();

      console.log('Generated text:', text);

      const wordStrings = this.parseWords(text);

      if (wordStrings.length < WORD_COUNT) {
        console.warn(
          `Expected ${WORD_COUNT} words but got ${wordStrings.length}. Using fallback words. Response: ${text}`,
        );
        return this.createFallbackResponse(normalizedTheme, {
          ...baseGenerationInfo,
          source: 'fallback',
          durationMs: Date.now() - startedAt,
          fallbackReason: 'provider_returned_too_few_words',
        });
      }

      return {
        words: this.toWordItems(wordStrings),
        theme: normalizedTheme,
        api: {
          generation: {
            ...baseGenerationInfo,
            source: 'provider',
            durationMs: Date.now() - startedAt,
          },
        },
      };
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

      return this.createFallbackResponse(normalizedTheme, {
        ...baseGenerationInfo,
        source: 'fallback',
        durationMs: Date.now() - startedAt,
        fallbackReason: this.isProviderNetworkError(error)
          ? 'provider_network_error'
          : 'provider_error',
        error: errorInfo,
      });
    }
  }

  private createPrompt(): string {
    return WORD_CHAIN_PROMPT;
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

  private parseWords(text: string): string[] {
    const words = text
      .replace(/^\s*\[|\]\s*$/g, '')
      .split(/,|\n|->|→/)
      .map((word) =>
        word
          .replace(/^\s*[-*\d.)]+\s*/, '')
          .replace(/^["']|["']$/g, '')
          .trim()
          .toLowerCase(),
      )
      .filter((word) => /^[a-z][a-z'-]{1,18}$/.test(word));

    return Array.from(new Set(words)).slice(0, WORD_COUNT);
  }

  private createFallbackResponse(
    theme: string,
    generation: GenerationInfo,
  ): GeneratedWordsResponse {
    return {
      words: this.toWordItems(this.getFallbackWords(theme)),
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
}
