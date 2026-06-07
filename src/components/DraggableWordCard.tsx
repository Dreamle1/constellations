import React, { useCallback, useMemo, useRef } from 'react';
import { View, type View as RNView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, type SharedValue } from 'react-native-reanimated';

import type { LayoutRect } from '@/types/cards';

import { WordCard } from './WordCard';

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

interface DraggableWordCardProps {
  cardId: string;
  word: string;
  isDragging?: boolean;
  disabled?: boolean;
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
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

export const DraggableWordCard: React.FC<DraggableWordCardProps> = ({
  cardId,
  word,
  isDragging,
  disabled = false,
  fingerX,
  fingerY,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
}) => {
  const cardRef = useRef<RNView>(null);
  const cardIdRef = useRef(cardId);
  const gestureActiveRef = useRef(false);
  const dragStartTokenRef = useRef(0);
  cardIdRef.current = cardId;

  const syncFinger = useCallback(
    (x: number, y: number) => {
      fingerX.value = x;
      fingerY.value = y;
    },
    [fingerX, fingerY],
  );

  const measureAndStart = useCallback(
    (absoluteX: number, absoluteY: number) => {
      if (disabled) {
        return;
      }

      gestureActiveRef.current = true;
      const dragStartToken = dragStartTokenRef.current + 1;
      dragStartTokenRef.current = dragStartToken;

      measureViewInWindow(cardRef.current, (cardRect) => {
        if (
          !gestureActiveRef.current ||
          dragStartTokenRef.current !== dragStartToken
        ) {
          return;
        }

        onDragStart(cardIdRef.current, absoluteX, absoluteY, cardRect);
      });
    },
    [disabled, onDragStart],
  );

  const handleDragMove = useCallback(
    (absoluteX: number, absoluteY: number) => {
      syncFinger(absoluteX, absoluteY);
      onDragMove(cardIdRef.current, absoluteX, absoluteY);
    },
    [onDragMove, syncFinger],
  );

  const handleDragEnd = useCallback(
    (absoluteX: number, absoluteY: number) => {
      gestureActiveRef.current = false;
      syncFinger(absoluteX, absoluteY);
      onDragEnd(cardIdRef.current, absoluteX, absoluteY);
    },
    [onDragEnd, syncFinger],
  );

  const gesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .enabled(!disabled)
      .minDistance(4)
      .onStart((event) => {
        try {
          const x = event.absoluteX ?? event.x;
          const y = event.absoluteY ?? event.y;
          runOnJS(measureAndStart)(x, y);
        } catch (error) {
          console.error('Error in drag start:', error, (error as Error).message);
        }
      })
      .onUpdate((event) => {
        try {
          const x = event.absoluteX ?? event.x;
          const y = event.absoluteY ?? event.y;
          runOnJS(handleDragMove)(x, y);
        } catch (error) {
          console.error('Error in drag move:', error, (error as Error).message);
        }
      })
      .onEnd((event) => {
        try {
          const x = event.absoluteX ?? event.x;
          const y = event.absoluteY ?? event.y;
          runOnJS(handleDragEnd)(x, y);
        } catch (error) {
          console.error('Error in drag end:', error, (error as Error).message);
        }
      });

    const tapGesture = Gesture.Tap()
      .enabled(!disabled && !!onPress)
      .maxDistance(8)
      .onEnd((_event, success) => {
        if (success && onPress) {
          runOnJS(onPress)(cardIdRef.current);
        }
      });

    return Gesture.Race(panGesture, tapGesture);
  }, [disabled, handleDragEnd, handleDragMove, measureAndStart, onPress]);

  return (
    <GestureDetector gesture={gesture}>
      <View ref={cardRef} collapsable={false}>
        <WordCard cardId={cardId} word={word} ghost={isDragging} />
      </View>
    </GestureDetector>
  );
};
