import type { GamePhase, WordCardModel } from '@/types/cards';

const GAME_STATE_CACHE_KEY = 'constellations:game-state:v1';
export const GAME_STATE_CACHE_VERSION = 8;

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface CachedCompletedLevelState {
  levelIndex: number;
  cards: WordCardModel[];
  answerKey: string[];
  fieldIds: string[];
  playIds: string[];
  gamePhase: GamePhase;
  submitTries: number;
  playAreaFlipped: boolean;
}

export interface CachedGameState extends CachedCompletedLevelState {
  version: typeof GAME_STATE_CACHE_VERSION;
  date: string;
  gamePhase: GamePhase;
  currentLevelIndex: number;
  unlockedLevelIndex: number;
  completedLevelIndexes: number[];
  completedLevelStates: CachedCompletedLevelState[];
}

function getStorage(): StorageLike | null {
  const maybeGlobal = globalThis as typeof globalThis & {
    localStorage?: StorageLike;
  };
  return maybeGlobal.localStorage ?? null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isWordCard(value: unknown): value is WordCardModel {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const card = value as Partial<WordCardModel>;
  return typeof card.id === 'string' && typeof card.word === 'string';
}

function isGamePhase(value: unknown): value is GamePhase {
  return value === 'playing' || value === 'success' || value === 'failed';
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

function normalizeCompletedLevelState(
  value: unknown,
): CachedCompletedLevelState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CachedCompletedLevelState>;

  if (
    typeof candidate.levelIndex !== 'number' ||
    !Array.isArray(candidate.cards) ||
    !candidate.cards.every(isWordCard) ||
    !isStringArray(candidate.answerKey) ||
    !isStringArray(candidate.fieldIds) ||
    !isStringArray(candidate.playIds) ||
    !isGamePhase(candidate.gamePhase) ||
    typeof candidate.submitTries !== 'number' ||
    typeof candidate.playAreaFlipped !== 'boolean'
  ) {
    return null;
  }

  const cardIds = new Set(candidate.cards.map((card) => card.id));
  const selectedIds = [...candidate.fieldIds, ...candidate.playIds];
  const selectedIdSet = new Set(selectedIds);
  const allIdsAreKnown = selectedIds.every((id) => cardIds.has(id));
  const noDuplicateIds = selectedIdSet.size === selectedIds.length;
  const allCardsArePlaced = selectedIdSet.size === cardIds.size;
  const answerIdsAreKnown = candidate.answerKey.every((id) => cardIds.has(id));

  if (!allIdsAreKnown || !noDuplicateIds || !allCardsArePlaced || !answerIdsAreKnown) {
    return null;
  }

  return {
    levelIndex: Math.max(0, Math.floor(candidate.levelIndex)),
    cards: candidate.cards,
    answerKey: candidate.answerKey,
    fieldIds: candidate.fieldIds,
    playIds: candidate.playIds,
    gamePhase: candidate.gamePhase,
    submitTries: Math.max(0, Math.floor(candidate.submitTries)),
    playAreaFlipped: candidate.playAreaFlipped,
  };
}

function normalizeCachedState(value: unknown): CachedGameState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CachedGameState>;
  const currentLevelState = normalizeCompletedLevelState(candidate);

  if (
    candidate.version !== GAME_STATE_CACHE_VERSION ||
    candidate.date !== getPacificDateKey() ||
    !currentLevelState ||
    typeof candidate.currentLevelIndex !== 'number' ||
    typeof candidate.unlockedLevelIndex !== 'number' ||
    !Array.isArray(candidate.completedLevelIndexes) ||
    !Array.isArray(candidate.completedLevelStates)
  ) {
    return null;
  }

  return {
    version: GAME_STATE_CACHE_VERSION,
    date: candidate.date,
    ...currentLevelState,
    currentLevelIndex: Math.max(0, Math.floor(candidate.currentLevelIndex)),
    unlockedLevelIndex: Math.max(0, Math.floor(candidate.unlockedLevelIndex)),
    completedLevelIndexes: candidate.completedLevelIndexes
      .filter((index): index is number => typeof index === 'number')
      .map((index) => Math.max(0, Math.floor(index))),
    completedLevelStates: candidate.completedLevelStates
      .map((state) => normalizeCompletedLevelState(state))
      .filter((state): state is CachedCompletedLevelState => Boolean(state)),
  };
}

export async function readCachedGameState(): Promise<CachedGameState | null> {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawState = storage.getItem(GAME_STATE_CACHE_KEY);
    if (!rawState) {
      return null;
    }

    const cachedState = normalizeCachedState(JSON.parse(rawState));
    if (!cachedState) {
      storage.removeItem(GAME_STATE_CACHE_KEY);
    }

    return cachedState;
  } catch {
    storage.removeItem(GAME_STATE_CACHE_KEY);
    return null;
  }
}

export async function writeCachedGameState(
  state: Omit<CachedGameState, 'version' | 'date'>,
): Promise<void> {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      GAME_STATE_CACHE_KEY,
      JSON.stringify({
        ...state,
        version: GAME_STATE_CACHE_VERSION,
        date: getPacificDateKey(),
      }),
    );
  } catch {
    return;
  }
}
