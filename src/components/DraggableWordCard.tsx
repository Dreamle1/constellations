import React, { useMemo, useRef } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type ViewStyle,
  type View as RNView,
} from 'react-native';

import type { LayoutRect } from '@/types/cards';

import { WordCard } from './WordCard';

const DRAG_THRESHOLD = 4;
const DEBUG_DRAG = true;

function debugDrag(message: string, details?: Record<string, unknown>) {
  if (!DEBUG_DRAG) {
    return;
  }

  console.log(`[drag-card] ${message}`, details ?? '');
}

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
    typeof pageX === 'number' && pageX > 0 ? pageX : gestureState.moveX;
  const y =
    typeof pageY === 'number' && pageY > 0 ? pageY : gestureState.moveY;

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
  containerStyle?: ViewStyle;
  cardStyle?: ViewStyle;
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
  containerStyle,
  cardStyle,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
}) => {
  const cardRef = useRef<RNView>(null);
  const activeDragRef = useRef(false);
  const cardIdRef = useRef(cardId);
  const lastCardRectRef = useRef<LayoutRect | null>(null);
  const pendingCardRectRef = useRef<LayoutRect | null>(null);
  const pendingDragStartRef = useRef(false);
  const pendingStartPointRef = useRef<{ x: number; y: number } | null>(null);
  cardIdRef.current = cardId;

  const resetDragRefs = () => {
    activeDragRef.current = false;
    pendingDragStartRef.current = false;
    pendingCardRectRef.current = null;
    pendingStartPointRef.current = null;
  };

  const updateMeasuredRect = () => {
    measureViewInWindow(cardRef.current, (cardRect) => {
      debugDrag('measured rect', { cardId: cardIdRef.current, cardRect });
      lastCardRectRef.current = cardRect;
      pendingCardRectRef.current = cardRect;

      const point = pendingStartPointRef.current;
      if (!pendingDragStartRef.current || activeDragRef.current || !point) {
        return;
      }

      pendingDragStartRef.current = false;
      activeDragRef.current = true;
      debugDrag('starting pending drag after measure', {
        cardId: cardIdRef.current,
        point,
        cardRect,
      });
      onDragStart(cardIdRef.current, point.x, point.y, cardRect);
      onDragMove(cardIdRef.current, point.x, point.y);
    });
  };

  const handleLayout = (_event: LayoutChangeEvent) => {
    debugDrag('layout', { cardId });
    requestAnimationFrame(updateMeasuredRect);
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
          debugDrag('grant', {
            cardId: cardIdRef.current,
            disabled,
            point,
            pageX: event.nativeEvent.pageX,
            pageY: event.nativeEvent.pageY,
            moveX: gestureState.moveX,
            moveY: gestureState.moveY,
          });
          pendingStartPointRef.current = point;
          pendingCardRectRef.current = lastCardRectRef.current;
          updateMeasuredRect();
        },
        onPanResponderMove: (event, gestureState) => {
          const point = getGesturePoint(event, gestureState);
          pendingStartPointRef.current = point;

          if (!activeDragRef.current && shouldStartDrag(gestureState)) {
            const cardRect = pendingCardRectRef.current ?? lastCardRectRef.current;
          debugDrag('threshold crossed', {
            cardId: cardIdRef.current,
            point,
            dx: gestureState.dx,
            dy: gestureState.dy,
            pageX: event.nativeEvent.pageX,
            pageY: event.nativeEvent.pageY,
            moveX: gestureState.moveX,
            moveY: gestureState.moveY,
            hasPendingRect: Boolean(pendingCardRectRef.current),
            hasLastRect: Boolean(lastCardRectRef.current),
          });
            if (!cardRect) {
              pendingDragStartRef.current = true;
              debugDrag('waiting for rect before drag start', {
                cardId: cardIdRef.current,
              });
              updateMeasuredRect();
              return;
            }

            pendingDragStartRef.current = false;
            activeDragRef.current = true;
            debugDrag('starting drag from move', {
              cardId: cardIdRef.current,
              point,
              cardRect,
            });
            onDragStart(cardIdRef.current, point.x, point.y, cardRect);
          }

          if (!activeDragRef.current) {
            return;
          }

          debugDrag('move active', {
            cardId: cardIdRef.current,
            point,
            dx: gestureState.dx,
            dy: gestureState.dy,
            pageX: event.nativeEvent.pageX,
            pageY: event.nativeEvent.pageY,
            moveX: gestureState.moveX,
            moveY: gestureState.moveY,
          });
          onDragMove(cardIdRef.current, point.x, point.y);
        },
        onPanResponderRelease: (event, gestureState) => {
          const point = getGesturePoint(event, gestureState);
          debugDrag('release', {
            cardId: cardIdRef.current,
            active: activeDragRef.current,
            point,
            dx: gestureState.dx,
            dy: gestureState.dy,
          });

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
          debugDrag('terminate', {
            cardId: cardIdRef.current,
            active: activeDragRef.current,
          });
          resetDragRefs();
        },
        onPanResponderTerminationRequest: () => {
          debugDrag('termination request', {
            cardId: cardIdRef.current,
            active: activeDragRef.current,
          });
          return false;
        },
      }),
    [disabled, onDragEnd, onDragMove, onDragStart, onPress],
  );

  return (
    <View
      ref={cardRef}
      collapsable={false}
      onLayout={handleLayout}
      style={containerStyle}
      {...panResponder.panHandlers}
    >
      {!hidden && <WordCard cardId={cardId} word={word} style={cardStyle} />}
    </View>
  );
};
