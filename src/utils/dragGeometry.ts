import type { LayoutRect } from '@/types/cards';

export function pointInRect(
  x: number,
  y: number,
  rect: LayoutRect | null,
): boolean {
  if (!rect) {
    return false;
  }
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

export function getPlayInsertionIndex(
  pointerY: number,
  playIds: string[],
  itemLayouts: Map<string, LayoutRect>,
): number {
  if (playIds.length === 0) {
    return 0;
  }

  for (let index = 0; index < playIds.length; index += 1) {
    const layout = itemLayouts.get(playIds[index]);
    if (!layout) {
      continue;
    }
    const midY = layout.y + layout.height / 2;
    if (pointerY < midY) {
      return index;
    }
  }

  return playIds.length;
}
