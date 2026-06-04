/** Initial card-field order (left to right). */
export const INITIAL_FIELD_CARD_IDS = [
  'card-0',
  'card-1',
  'card-2',
  'card-3',
  'card-4',
] as const;

/**
 * Correct play-area order (top to bottom): moon → star → orbit → comet → nova
 */
export const CORRECT_PLAY_ORDER: readonly string[] = [
  'card-1',
  'card-0',
  'card-2',
  'card-4',
  'card-3',
];

export const MAX_SUBMIT_TRIES = 5;

export const TOAST_DURATION_MS = 2800;
