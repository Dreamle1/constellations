import { INITIAL_FIELD_CARD_IDS } from '@/constants/game';

import { mergeIntoFieldOrder, playOrderMatches } from './fieldOrder';

describe('mergeIntoFieldOrder', () => {
  it('inserts a card at its initial index among existing field cards', () => {
    expect(mergeIntoFieldOrder(['card-0', 'card-2'], 'card-1', INITIAL_FIELD_CARD_IDS)).toEqual([
      'card-0',
      'card-1',
      'card-2',
    ]);
  });

  it('appends when the card belongs at the end of the field', () => {
    expect(mergeIntoFieldOrder(['card-0'], 'card-4', INITIAL_FIELD_CARD_IDS)).toEqual([
      'card-0',
      'card-4',
    ]);
  });
});

describe('playOrderMatches', () => {
  it('returns true when order matches', () => {
    expect(playOrderMatches(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('returns false when order differs', () => {
    expect(playOrderMatches(['b', 'a'], ['a', 'b'])).toBe(false);
  });
});
