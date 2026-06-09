import React, { useMemo, useRef } from 'react';
import {
  PanResponder,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type View as RNView,
} from 'react-native';

import type { LayoutRect } from '@/types/cards';

import { WordCard } from './WordCard';

const DRAG_THRESHOLD = 4;

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

function getGesturePoint(
  event: GestureResponderEvent,
  gestureState: PanResponderGestureState,
) {
  const pageX = event.nativeEvent.pageX;
  const pageY = event.nativeEvent.pageY;
  const x =
    typeof gestureState.moveX === 'number' && gestureState.moveX > 0
      ? gestureState.moveX
      : pageX;
  const y =
    typeof gestureState.moveY === 'number' && gestureState.moveY > 0
      ? gestureState.moveY
      : pageY;

  return { x, y };
}

function shouldStartDrag(gestureState: PanResponderGestureState) {
  return (
    Math.abs(gestureState.dx) > DRAG_THRESHOLD ||
    Math.abs(gestureState.dy) > DRAG_THRESHOLD
  );
}

interface DraggableWordCardProps {
  cardId: string;
  word: string;
  disabled?: boolean;
  hidden?: boolean;
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
  disabled = false,
  hidden,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
}) => {
  const cardRef = useRef<RNView>(null);
  const activeDragRef = useRef(false);
  const cardIdRef = useRef(cardId);
  const pendingCardRectRef = useRef<LayoutRect | null>(null);
  const pendingStartPointRef = useRef<{ x: number; y: number } | null>(null);
  cardIdRef.current = cardId;

  const resetDragRefs = () => {
    activeDragRef.current = false;
    pendingCardRectRef.current = null;
    pendingStartPointRef.current = null;
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onPanResponderGrant: (event, gestureState) => {
          resetDragRefs();
          const point = getGesturePoint(event, gestureState);
          pendingStartPointRef.current = point;

          measureViewInWindow(cardRef.current, (cardRect) => {
            pendingCardRectRef.current = cardRect;
          });
        },
        onPanResponderMove: (event, gestureState) => {
          const point = getGesturePoint(event, gestureState);

          if (!activeDragRef.current && shouldStartDrag(gestureState)) {
            const cardRect = pendingCardRectRef.current;
            if (!cardRect) {
              return;
            }

            activeDragRef.current = true;
            onDragStart(cardIdRef.current, point.x, point.y, cardRect);
          }

          if (!activeDragRef.current) {
            return;
          }

          onDragMove(cardIdRef.current, point.x, point.y);
        },
        onPanResponderRelease: (event, gestureState) => {
          const point = getGesturePoint(event, gestureState);

          if (!activeDragRef.current) {
            resetDragRefs();
            if (!shouldStartDrag(gestureState)) {
              onPress?.(cardIdRef.current);
            }
            return;
          }

          onDragEnd(cardIdRef.current, point.x, point.y);
          resetDragRefs();
        },
        onPanResponderTerminate: () => {
          resetDragRefs();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [disabled, onDragEnd, onDragMove, onDragStart, onPress],
  );

  return (
    <View
      ref={cardRef}
      collapsable={false}
      {...panResponder.panHandlers}
    >
      {!hidden && <WordCard cardId={cardId} word={word} />}
    </View>
  );
};
