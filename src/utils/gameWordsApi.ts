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
        throw new Error(`API error: ${response.status}`);
      }

      const data: GameWordsResponse = await response.json();
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
