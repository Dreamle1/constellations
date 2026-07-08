interface Env {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  WORDS_DB: D1Database;
}

interface WordItem {
  id: string;
  word: string;
}

interface GeneratedWordsResponse {
  words: WordItem[];
  answer: string[];
  answerKey: string[];
  wordCount: number;
  api?: {
    generation: GenerationInfo;
  };
}

interface GenerationInfo {
  provider: 'openai' | 'local';
  model?: string;
  source: 'provider' | 'database';
  durationMs: number;
  promptLength?: number;
  error?: ProviderErrorInfo;
}

interface ProviderErrorInfo {
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

interface StoredDailyWords {
  date: string;
  wordCount: number;
  answer: string[];
  createdAt: string;
}

interface StoredDailyWordRow {
  date: string;
  word_count: number;
  answer_json: string;
  created_at: string;
}

interface WordChainProviderResponse {
  answer: string[];
}

class WordGenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: ProviderErrorInfo,
  ) {
    super(message);
    this.name = 'WordGenerationError';
  }
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
const PROMPT_TEMPLATE = `Generate {{wordCount}} words arranged in a linear chain ({{chain}}) where each word is related only to its immediate neighbors in the sequence. Specifically:

{{relationships}}

Ensure there are no meaningful semantic or obvious associations between non-adjacent words. For example, Word 1 should have no clear relation to Word 3 or any later word, and each middle word should only clearly connect to the word immediately before it and immediately after it. The relationships between adjacent words should be clear and defensible (categorical, functional, or contextual).

Choose words that are a bit more interesting and complex when possible, while still being familiar, playable, and easy to spell. Prefer evocative nouns, concrete concepts, and slightly richer vocabulary over generic words, but avoid obscure, technical, proper, or multi-word answers.

Return only valid JSON in this exact shape:
{
  "answer": [{{answerExample}}]
}

The answer array must contain exactly {{wordCount}} unique lowercase words in the correct chain order. Do not include explanations, markdown, numbering outside JSON, or extra keys.

Do not repeat any words from this recent daily word list when one is provided:
{{recentWords}}`;

const DISPLAY_ORDERS: Record<SupportedWordCount, number[]> = {
  5: [2, 0, 4, 1, 3],
  7: [3, 0, 5, 1, 6, 2, 4],
  9: [4, 0, 7, 2, 8, 1, 6, 3, 5],
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...init.headers,
    },
  });
}

function normalizeWordCount(wordCount: number): SupportedWordCount {
  return SUPPORTED_WORD_COUNTS.includes(wordCount as SupportedWordCount)
    ? (wordCount as SupportedWordCount)
    : 5;
}

function getPacificDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function toDateKeyTime(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function formatRecentWords(recentWords: string[]): string {
  const uniqueWords = Array.from(
    new Set(
      recentWords
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  return uniqueWords.length > 0 ? uniqueWords.join(', ') : 'None';
}

function createWordChainPrompt(wordCount: number, recentWords: string[] = []): string {
  const wordLabels = Array.from({ length: wordCount }, (_, index) => `Word ${index + 1}`);
  const chain = wordLabels.join(' -> ');
  const relationships = wordLabels
    .map((label, index) => {
      const neighbors = [
        index > 0 ? wordLabels[index - 1] : null,
        index < wordLabels.length - 1 ? wordLabels[index + 1] : null,
      ].filter(Boolean);

      return `${label} relates only to ${neighbors.join(' and ')}`;
    })
    .join('\n');
  const answerExample = Array.from(
    { length: wordCount },
    (_, index) => `"word${index + 1}"`,
  ).join(', ');

  return PROMPT_TEMPLATE.replaceAll('{{wordCount}}', String(wordCount))
    .replaceAll('{{chain}}', chain)
    .replaceAll('{{relationships}}', relationships)
    .replaceAll('{{answerExample}}', answerExample)
    .replaceAll('{{recentWords}}', formatRecentWords(recentWords));
}

class D1DailyWordStore {
  constructor(private readonly db: D1Database) {}

  async getCurrent(date: string, wordCount: number): Promise<StoredDailyWords | null> {
    const row = await this.db
      .prepare(
        `SELECT date, word_count, answer_json, created_at
         FROM daily_words
         WHERE date = ? AND word_count = ?`,
      )
      .bind(date, wordCount)
      .first<StoredDailyWordRow>();

    return row ? this.normalizeRow(row) : null;
  }

  async getRecentWords(date: string, days: number): Promise<string[]> {
    const result = await this.db
      .prepare(
        `SELECT date, word_count, answer_json, created_at
         FROM daily_words
         ORDER BY date DESC`,
      )
      .all<StoredDailyWordRow>();
    const currentTime = toDateKeyTime(date);
    if (currentTime === null) {
      return [];
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const uniqueWords = new Set<string>();

    for (const row of result.results ?? []) {
      const entry = this.normalizeRow(row);
      if (!entry) {
        continue;
      }

      const entryTime = toDateKeyTime(entry.date);
      if (entryTime === null) {
        continue;
      }

      const daysAgo = Math.floor((currentTime - entryTime) / dayMs);
      if (daysAgo < 0 || daysAgo > days) {
        continue;
      }

      entry.answer.forEach((word) => uniqueWords.add(word));
    }

    return Array.from(uniqueWords);
  }

  async save(entry: StoredDailyWords): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO daily_words (date, word_count, answer_json, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(date, word_count) DO UPDATE SET
           answer_json = excluded.answer_json,
           created_at = excluded.created_at`,
      )
      .bind(entry.date, entry.wordCount, JSON.stringify(entry.answer), entry.createdAt)
      .run();
  }

  private normalizeRow(row: StoredDailyWordRow): StoredDailyWords | null {
    try {
      const answer = JSON.parse(row.answer_json) as unknown;
      if (!Array.isArray(answer)) {
        return null;
      }

      return {
        date: row.date,
        wordCount: row.word_count,
        answer: answer.filter((word): word is string => typeof word === 'string'),
        createdAt: row.created_at,
      };
    } catch {
      return null;
    }
  }
}

class WordGenerationService {
  private readonly model: string;
  private readonly dailyWordStore: D1DailyWordStore;

  constructor(private readonly env: Env) {
    this.model = env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
    this.dailyWordStore = new D1DailyWordStore(env.WORDS_DB);
  }

  async generateWords(wordCount: number): Promise<GeneratedWordsResponse> {
    const requestedWordCount = normalizeWordCount(wordCount);
    const currentPacificDate = getPacificDateKey();
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

    const apiKey = this.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new WordGenerationError(
        'SERVICE_UNCONFIGURED',
        'Word generation service is not configured.',
      );
    }

    const startedAt = Date.now();
    const recentWords = await this.dailyWordStore.getRecentWords(currentPacificDate, 7);
    const prompt = createWordChainPrompt(requestedWordCount, recentWords);
    const baseGenerationInfo = {
      provider: 'openai' as const,
      model: this.model,
      promptLength: prompt.length,
    };

    try {
      const providerResponse = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: prompt,
          max_output_tokens: 220,
        }),
      });

      const responseBody = await this.parseOpenAIResponse(providerResponse);
      const text = this.getGeneratedText(responseBody).trim();
      const wordStrings = this.parseWordChainAnswer(text, requestedWordCount);

      if (wordStrings.length < requestedWordCount) {
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
      await this.dailyWordStore.save({
        date: currentPacificDate,
        wordCount: requestedWordCount,
        answer: generatedResponse.answer,
        createdAt: new Date().toISOString(),
      });
      return generatedResponse;
    } catch (error) {
      if (error instanceof WordGenerationError) {
        throw error;
      }

      const errorInfo = this.getProviderErrorInfo(error);
      throw new WordGenerationError(
        this.isProviderNetworkError(error) ? 'PROVIDER_NETWORK_ERROR' : 'PROVIDER_ERROR',
        'Word generation provider is unavailable.',
        errorInfo,
      );
    }
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
      const message = typeof maybeCause.message === 'string' ? maybeCause.message : undefined;

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

  private parseWordChainAnswer(text: string, wordCount: SupportedWordCount): string[] {
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
    const words = DISPLAY_ORDERS[wordCount]
      .map((index) => orderedWords[index])
      .filter((word): word is WordItem => Boolean(word));

    return {
      words,
      answer,
      answerKey,
      wordCount,
    };
  }
}

async function handleGameWords(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const wordCount = Number(url.searchParams.get('wordCount') ?? 5);
    const response = await new WordGenerationService(env).generateWords(wordCount);

    return jsonResponse(response);
  } catch (error) {
    const code =
      error instanceof WordGenerationError ? error.code : 'WORD_GENERATION_FAILED';
    const message =
      error instanceof WordGenerationError ? error.message : 'Unable to generate words.';

    console.error('Failed to serve game words:', { code, message });

    return jsonResponse(
      {
        error: {
          code,
          message,
        },
      },
      { status: 500 },
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ status: 'ok' });
    }

    if (request.method === 'GET' && url.pathname === '/api/game/words') {
      return handleGameWords(request, env);
    }

    return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, { status: 404 });
  },
};
