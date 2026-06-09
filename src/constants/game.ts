/** Initial card-field order (left to right). */
export const INITIAL_FIELD_CARD_IDS = [
  'card-0',
  'card-1',
  'card-2',
  'card-3',
  'card-4',
] as const;

export const MAX_SUBMIT_TRIES = 5;

export const TOAST_DURATION_MS = 2800;

export const GAME_LEVELS = [
  { id: 'level-1', label: 'Level 1', wordCount: 5 },
  { id: 'level-2', label: 'Level 2', wordCount: 7 },
  { id: 'level-3', label: 'Level 3', wordCount: 9 },
] as const;
