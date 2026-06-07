import React, { useCallback, useRef } from 'react';
import { StyleSheet, View, type View as RNView } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import type { LayoutRect } from '@/types/cards';

import { DraggableWordCard } from './DraggableWordCard';

interface PlayAreaCardSlotProps {
  cardId: string;
  word: string;
  isDragging: boolean;
  disabled?: boolean;
  showConnector: boolean;
  showInsertBefore: boolean;
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
  onLayoutMeasured: (cardId: string, rect: LayoutRect) => void;
  onDragStart: (
    cardId: string,
    x: number,
    y: number,
    cardRect: LayoutRect,
  ) => void;
  onDragMove: (cardId: string, x: number, y: number) => void;
  onDragEnd: (cardId: string, x: number, y: number) => void;
  onPress?: (cardId: string) => void;
}

function measureViewInWindow(
  view: RNView | null,
  callback: (rect: LayoutRect) => void,
) {
  if (!view) {
    return;
  }
  try {
    view.measureInWindow((x, y, width, height) => {
      if (x !== null && y !== null && width !== null && height !== null) {
        callback({ x, y, width, height });
      }
    });
  } catch (error) {
    console.warn('Failed to measure view:', error);
  }
}

export const PlayAreaCardSlot: React.FC<PlayAreaCardSlotProps> = ({
  cardId,
  word,
  isDragging,
  disabled,
  showConnector,
  showInsertBefore,
  fingerX,
  fingerY,
  onLayoutMeasured,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
}) => {
  const slotRef = useRef<RNView>(null);

  const reportLayout = useCallback(() => {
    measureViewInWindow(slotRef.current, (rect) => {
      onLayoutMeasured(cardId, rect);
    });
  }, [cardId, onLayoutMeasured]);

  return (
    <View style={styles.playItem}>
      {showInsertBefore && <View style={styles.insertPreview} />}
      {showConnector && <View style={styles.connector} />}
      <View ref={slotRef} onLayout={reportLayout} collapsable={false}>
        <DraggableWordCard
          cardId={cardId}
          word={word}
          isDragging={isDragging}
          disabled={disabled}
          fingerX={fingerX}
          fingerY={fingerY}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onPress={onPress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  connector: {
    alignSelf: 'center',
    backgroundColor: '#5c6bc0',
    borderRadius: 1,
    height: 28,
    width: 3,
  },
  insertPreview: {
    alignSelf: 'center',
    backgroundColor: '#7986cb',
    borderRadius: 2,
    height: 4,
    marginVertical: 4,
    width: 120,
  },
  playItem: {
    alignItems: 'center',
  },
});
