import type { LayoutRect } from '@/types/cards';

import { getPlayInsertionIndex, pointInRect } from './dragGeometry';

describe('pointInRect', () => {
  const rect: LayoutRect = { x: 10, y: 20, width: 100, height: 50 };

  it('returns true for a point inside the rect', () => {
    expect(pointInRect(50, 40, rect)).toBe(true);
  });

  it('returns false for a point outside the rect', () => {
    expect(pointInRect(5, 40, rect)).toBe(false);
  });
});

describe('getPlayInsertionIndex', () => {
  const layouts = new Map<string, LayoutRect>([
    ['a', { x: 0, y: 100, width: 80, height: 40 }],
    ['b', { x: 0, y: 200, width: 80, height: 40 }],
  ]);

  it('returns 0 for an empty play area', () => {
    expect(getPlayInsertionIndex(150, [], layouts)).toBe(0);
  });

  it('inserts before the first card when above its midpoint', () => {
    expect(getPlayInsertionIndex(110, ['a', 'b'], layouts)).toBe(0);
  });

  it('inserts between cards', () => {
    expect(getPlayInsertionIndex(170, ['a', 'b'], layouts)).toBe(1);
  });

  it('appends after the last card', () => {
    expect(getPlayInsertionIndex(250, ['a', 'b'], layouts)).toBe(2);
  });
});
