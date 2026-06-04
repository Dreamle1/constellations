/**
 * Rebuilds field ids so they follow `initialOrder`, including any cards being
 * returned from play while preserving the original left-to-right sequence.
 */
export function mergeIntoFieldOrder(
  currentFieldIds: string[],
  cardId: string,
  initialOrder: readonly string[],
): string[] {
  const withCard = currentFieldIds.includes(cardId)
    ? currentFieldIds
    : [...currentFieldIds, cardId];

  return initialOrder.filter((id) => withCard.includes(id));
}

export function playOrderMatches(
  playIds: string[],
  correctOrder: readonly string[],
): boolean {
  if (playIds.length !== correctOrder.length) {
    return false;
  }
  return playIds.every((id, index) => id === correctOrder[index]);
}
