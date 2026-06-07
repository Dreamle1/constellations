import type { GamePhase, WordCardModel } from '@/types/cards';

const GAME_STATE_CACHE_KEY = 'constellations:game-state:v1';
const GAME_STATE_CACHE_VERSION = 1;

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface CachedGameState {
  version: typeof GAME_STATE_CACHE_VERSION;
  cards: WordCardModel[];
  answerKey: string[];
  fieldIds: string[];
  playIds: string[];
  gamePhase: GamePhase;
  submitTries: number;
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

function normalizeCachedState(value: unknown): CachedGameState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CachedGameState>;

  if (
    candidate.version !== GAME_STATE_CACHE_VERSION ||
    !Array.isArray(candidate.cards) ||
    !candidate.cards.every(isWordCard) ||
    !isStringArray(candidate.answerKey) ||
    !isStringArray(candidate.fieldIds) ||
    !isStringArray(candidate.playIds) ||
    !isGamePhase(candidate.gamePhase) ||
    typeof candidate.submitTries !== 'number'
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
    version: GAME_STATE_CACHE_VERSION,
    cards: candidate.cards,
    answerKey: candidate.answerKey,
    fieldIds: candidate.fieldIds,
    playIds: candidate.playIds,
    gamePhase: candidate.gamePhase,
    submitTries: Math.max(0, Math.floor(candidate.submitTries)),
  };
}

export async function readCachedGameState(): Promise<CachedGameState | null> {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawState = storage.getItem(GAME_STATE_CACHE_KEY);
    return rawState ? normalizeCachedState(JSON.parse(rawState)) : null;
  } catch (error) {
    console.warn('Failed to read cached game state:', error);
    return null;
  }
}

export async function writeCachedGameState(
  state: CachedGameState,
): Promise<void> {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(GAME_STATE_CACHE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to write cached game state:', error);
  }
}
