import React, { useCallback, useEffect, useRef } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  View,
  type View as RNView,
} from 'react-native';

import type { LayoutRect } from '@/types/cards';

import { DraggableWordCard } from './DraggableWordCard';

function measureViewInWindow(
  view: RNView | null,
  callback: (rect: LayoutRect) => void,
) {
  if (!view) {
    return;
  }

  view.measureInWindow((x, y, width, height) => {
    callback({ x, y, width, height });
  });
}

interface PlayAreaCardSlotProps {
  cardId: string;
  word: string;
  disabled?: boolean;
  hiddenFromLayout?: boolean;
  layoutKey: string;
  showConnector: boolean;
  showInsertBefore: boolean;
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

export const PlayAreaCardSlot: React.FC<PlayAreaCardSlotProps> = ({
  cardId,
  word,
  disabled,
  hiddenFromLayout,
  layoutKey,
  showConnector,
  showInsertBefore,
  onLayoutMeasured,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
}) => {
  const slotRef = useRef<RNView>(null);

  const reportLayout = useCallback(
    () => {
      if (hiddenFromLayout) {
        return;
      }

      measureViewInWindow(slotRef.current, (rect) => {
        onLayoutMeasured(cardId, rect);
      });
    },
    [cardId, hiddenFromLayout, onLayoutMeasured],
  );

  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      reportLayout();
    },
    [reportLayout],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(reportLayout);
    return () => cancelAnimationFrame(frame);
  }, [layoutKey, reportLayout, showConnector, showInsertBefore]);

  return (
    <View
      ref={slotRef}
      style={[styles.playItem, hiddenFromLayout && styles.hiddenDragSource]}
      onLayout={handleLayout}
    >
      {!hiddenFromLayout && showInsertBefore && (
        <View style={styles.insertPreview} />
      )}
      {!hiddenFromLayout && showConnector && <View style={styles.connector} />}
      <View collapsable={false}>
        <DraggableWordCard
          cardId={cardId}
          word={word}
          disabled={disabled}
          hidden={hiddenFromLayout}
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
    marginVertical: 10,
    width: 120,
  },
  hiddenDragSource: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    position: 'absolute',
    width: 0,
  },
  playItem: {
    alignItems: 'center',
    position: 'relative',
  },
});
