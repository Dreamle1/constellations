import {
  GAME_STATE_CACHE_VERSION,
  readCachedGameState,
  writeCachedGameState,
} from './gameStateCache';

const CACHE_KEY = 'constellations:game-state:v1';

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      values.delete(key);
    }),
  };
}

function createCachedState(date: string) {
  const cards = [
    { id: 'card-0', word: 'spark' },
    { id: 'card-1', word: 'flame' },
  ];

  return {
    version: GAME_STATE_CACHE_VERSION,
    date,
    levelIndex: 0,
    cards,
    answerKey: ['card-0', 'card-1'],
    fieldIds: ['card-0', 'card-1'],
    playIds: [],
    gamePhase: 'playing' as const,
    submitTries: 0,
    playAreaFlipped: false,
    currentLevelIndex: 0,
    unlockedLevelIndex: 0,
    completedLevelIndexes: [],
    completedLevelStates: [],
  };
}

describe('gameStateCache', () => {
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-14T07:30:00.000Z'));
    storage = createStorage();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('reads a cache entry from the current Pacific date', async () => {
    storage.setItem(CACHE_KEY, JSON.stringify(createCachedState('2026-06-14')));

    await expect(readCachedGameState()).resolves.toMatchObject({
      date: '2026-06-14',
      cards: [
        { id: 'card-0', word: 'spark' },
        { id: 'card-1', word: 'flame' },
      ],
    });
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('removes and ignores a cache entry from a previous Pacific date', async () => {
    storage.setItem(CACHE_KEY, JSON.stringify(createCachedState('2026-06-13')));

    await expect(readCachedGameState()).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    expect(storage.getItem(CACHE_KEY)).toBeNull();
  });

  it('writes cache entries with the current Pacific date', async () => {
    const state = createCachedState('2026-06-13');
    const { version, date, ...stateWithoutMetadata } = state;
    expect(version).toBe(GAME_STATE_CACHE_VERSION);
    expect(date).toBe('2026-06-13');

    await writeCachedGameState(stateWithoutMetadata);

    expect(JSON.parse(storage.getItem(CACHE_KEY) ?? '{}')).toMatchObject({
      version: GAME_STATE_CACHE_VERSION,
      date: '2026-06-14',
    });
  });
});
