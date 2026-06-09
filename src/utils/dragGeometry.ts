import type { LayoutRect } from '@/types/cards';

export interface Point {
  x: number;
  y: number;
}

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

  const measuredItems = playIds
    .map((id, index) => ({
      id,
      index,
      layout: itemLayouts.get(id),
    }))
    .filter(
      (item): item is { id: string; index: number; layout: LayoutRect } =>
        !!item.layout,
    )
    .sort((a, b) => {
      if (a.layout.y !== b.layout.y) {
        return a.layout.y - b.layout.y;
      }
      return a.index - b.index;
    });

  for (let index = 0; index < measuredItems.length; index += 1) {
    const { layout } = measuredItems[index];
    if (!layout) {
      continue;
    }
    const midY = layout.y + layout.height / 2;
    if (pointerY < midY) {
      return measuredItems[index].index;
    }
  }

  return playIds.length;
}

export function getPlayReorderPreviewIndex(
  pointerY: number,
  displayPlayIds: string[],
  itemLayouts: Map<string, LayoutRect>,
  draggedCardId: string | null,
): number {
  const rawIndex = getPlayInsertionIndex(pointerY, displayPlayIds, itemLayouts);
  const fromIndex = draggedCardId ? displayPlayIds.indexOf(draggedCardId) : -1;

  if (fromIndex !== -1 && rawIndex > fromIndex) {
    return rawIndex - 1;
  }

  return rawIndex;
}

export function moveCardInDisplayOrder(
  displayPlayIds: string[],
  cardId: string,
  previewIndex: number,
): string[] {
  const next = displayPlayIds.filter((id) => id !== cardId);
  const insertIndex = Math.max(0, Math.min(previewIndex, next.length));
  next.splice(insertIndex, 0, cardId);
  return next;
}

export function getDragGrabOffset(
  pointerX: number,
  pointerY: number,
  cardRect: LayoutRect,
): Point {
  return {
    x: pointerX - cardRect.x,
    y: pointerY - cardRect.y,
  };
}

export function getFloatingCardPosition(
  pointerX: number,
  pointerY: number,
  grabOffset: Point,
  dragLayerRect: LayoutRect,
): { left: number; top: number } {
  return {
    left: pointerX - grabOffset.x - dragLayerRect.x,
    top: pointerY - grabOffset.y - dragLayerRect.y,
  };
}
