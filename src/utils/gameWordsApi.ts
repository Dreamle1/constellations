/**
 * API client for game word generation
 * Communicates with the backend server to fetch AI-generated words
 */

import type { GameWordsResponse } from '@constellations/shared';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:3001' : '');

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is required for production builds');
  }

  return API_BASE_URL.replace(/\/$/, '');
}

interface FetchWordsOptions {
  retries?: number;
  timeoutMs?: number;
  wordCount?: number;
}

interface GameWordsErrorResponse {
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

export class GameWordsApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'GameWordsApiError';
  }
}

function isGameWordsResponse(value: unknown): value is GameWordsResponse {
  const response = value as Partial<GameWordsResponse>;

  return (
    !!response &&
    Array.isArray(response.words) &&
    response.words.length > 0 &&
    response.words.every(
      (word) => typeof word.id === 'string' && typeof word.word === 'string',
    ) &&
    Array.isArray(response.answer) &&
    response.answer.length > 0 &&
    response.answer.every((word) => typeof word === 'string') &&
    Array.isArray(response.answerKey) &&
    response.answerKey.length > 0 &&
    response.answerKey.every((id) => typeof id === 'string')
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Fetch game words from the backend
 * Returns the requested supported word count.
 * Throws if the backend cannot provide words
 */
export async function fetchGameWords(
  options: FetchWordsOptions = {},
): Promise<GameWordsResponse> {
  const { retries = 1, timeoutMs = 10000, wordCount = 5 } = options;

  const url = `${getApiBaseUrl()}/api/game/words?wordCount=${wordCount}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await parseJsonResponse(response)) as GameWordsErrorResponse;
        const code =
          typeof errorData?.error?.code === 'string'
            ? errorData.error.code
            : `HTTP_${response.status}`;
        const message =
          typeof errorData?.error?.message === 'string'
            ? errorData.error.message
            : `API error: ${response.status}`;

        throw new GameWordsApiError(message, code, response.status);
      }

      const data = await parseJsonResponse(response);
      if (!isGameWordsResponse(data)) {
        throw new GameWordsApiError(
          'API returned an invalid words payload.',
          'INVALID_WORDS_PAYLOAD',
          response.status,
        );
      }

      return data;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error fetching words';

      console.warn(
        `Failed to fetch words (attempt ${attempt + 1}/${retries + 1}): ${errorMessage}`,
      );

      if (isLastAttempt) {
        if (error instanceof GameWordsApiError) {
          throw error;
        }

        throw new GameWordsApiError(
          errorMessage,
          error instanceof Error && error.name === 'AbortError'
            ? 'REQUEST_TIMEOUT'
            : 'REQUEST_FAILED',
        );
      }

      if (error instanceof GameWordsApiError) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000),
      );
    }
  }

  throw new Error('Unable to fetch game words');
}
