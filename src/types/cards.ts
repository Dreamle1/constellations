export type Zone = 'field' | 'play';

// Re-export shared types
export type { WordCardModel } from '@constellations/shared';

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragState {
  cardId: string;
  fromZone: Zone;
  fromFieldIndex?: number;
  fromPlayIndex?: number;
}
