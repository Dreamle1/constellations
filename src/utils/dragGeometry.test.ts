import type { LayoutRect } from '@/types/cards';

import {
  getDragGrabOffset,
  getFloatingCardPosition,
  getPathInsertionIndex,
  getPlayInsertionIndex,
  getPlayReorderPreviewIndex,
  moveCardInDisplayOrder,
  pointInRect,
} from './dragGeometry';

describe('pointInRect', () => {
  const rect: LayoutRect = { x: 10, y: 20, width: 100, height: 50 };

  it('returns true for a point inside the rect', () => {
    expect(pointInRect(50, 40, rect)).toBe(true);
  });

  it('returns false for a point outside the rect', () => {
    expect(pointInRect(5, 40, rect)).toBe(false);
  });
});

describe('getPlayReorderPreviewIndex', () => {
  const layouts = new Map<string, LayoutRect>([
    ['a', { x: 0, y: 0, width: 80, height: 40 }],
    ['b', { x: 0, y: 100, width: 80, height: 40 }],
    ['c', { x: 0, y: 200, width: 80, height: 40 }],
    ['d', { x: 0, y: 300, width: 80, height: 40 }],
    ['e', { x: 0, y: 400, width: 80, height: 40 }],
  ]);

  it('keeps every slot reachable when dragging an existing play card downward', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];

    expect(getPlayReorderPreviewIndex(250, ids, layouts, 'c')).toBe(2);
    expect(getPlayReorderPreviewIndex(350, ids, layouts, 'c')).toBe(3);
    expect(getPlayReorderPreviewIndex(450, ids, layouts, 'c')).toBe(4);
  });
});

describe('moveCardInDisplayOrder', () => {
  it('moves an existing card without changing the number of cards', () => {
    expect(moveCardInDisplayOrder(['a', 'b', 'c', 'd', 'e'], 'c', 3)).toEqual([
      'a',
      'b',
      'd',
      'c',
      'e',
    ]);
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

describe('getPathInsertionIndex', () => {
  const layouts = new Map<string, LayoutRect>([
    ['a', { x: 0, y: 0, width: 80, height: 40 }],
    ['b', { x: 0, y: 80, width: 80, height: 40 }],
    ['c', { x: 120, y: 80, width: 80, height: 40 }],
  ]);

  it('uses both axes when inserting along a bent path', () => {
    expect(getPathInsertionIndex({ x: 95, y: 100 }, ['a', 'b', 'c'], layouts)).toBe(2);
    expect(getPathInsertionIndex({ x: 40, y: 10 }, ['a', 'b', 'c'], layouts)).toBe(0);
  });
});

describe('floating drag geometry', () => {
  const cardRect: LayoutRect = { x: 140, y: 260, width: 104, height: 56 };
  const dragLayerRect: LayoutRect = { x: 24, y: 80, width: 360, height: 640 };

  it('keeps the grabbed point under the pointer while moving', () => {
    const grabOffset = getDragGrabOffset(160, 280, cardRect);

    expect(getFloatingCardPosition(210, 330, grabOffset, dragLayerRect)).toEqual(
      {
        left: 166,
        top: 230,
      },
    );
  });

  it('does not include parent padding from unrelated coordinate spaces', () => {
    const grabOffset = getDragGrabOffset(192, 288, cardRect);

    expect(getFloatingCardPosition(192, 288, grabOffset, dragLayerRect)).toEqual(
      {
        left: 116,
        top: 180,
      },
    );
  });
});
