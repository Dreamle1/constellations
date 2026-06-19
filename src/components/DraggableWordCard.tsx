import React, { useMemo, useRef } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type ViewStyle,
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

function preventBrowserPan(event: GestureResponderEvent) {
  event.preventDefault();
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
      lastCardRectRef.current = cardRect;
      pendingCardRectRef.current = cardRect;

      const point = pendingStartPointRef.current;
      if (!pendingDragStartRef.current || activeDragRef.current || !point) {
        return;
      }

      pendingDragStartRef.current = false;
      activeDragRef.current = true;
      onDragStart(cardIdRef.current, point.x, point.y, cardRect);
      onDragMove(cardIdRef.current, point.x, point.y);
    });
  };

  const handleLayout = (_event: LayoutChangeEvent) => {
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
          preventBrowserPan(event);
          resetDragRefs();
          const point = getGesturePoint(event, gestureState);
          pendingStartPointRef.current = point;
          pendingCardRectRef.current = lastCardRectRef.current;
          updateMeasuredRect();
        },
        onPanResponderMove: (event, gestureState) => {
          preventBrowserPan(event);
          const point = getGesturePoint(event, gestureState);
          pendingStartPointRef.current = point;

          if (!activeDragRef.current && shouldStartDrag(gestureState)) {
            const cardRect = pendingCardRectRef.current ?? lastCardRectRef.current;
            if (!cardRect) {
              pendingDragStartRef.current = true;
              updateMeasuredRect();
              return;
            }

            pendingDragStartRef.current = false;
            activeDragRef.current = true;
            onDragStart(cardIdRef.current, point.x, point.y, cardRect);
          }

          if (!activeDragRef.current) {
            return;
          }

          onDragMove(cardIdRef.current, point.x, point.y);
        },
        onPanResponderRelease: (event, gestureState) => {
          preventBrowserPan(event);
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
      onLayout={handleLayout}
      style={[styles.dragSurface, containerStyle]}
      {...panResponder.panHandlers}
    >
      {!hidden && <WordCard cardId={cardId} word={word} style={cardStyle} />}
    </View>
  );
};

const styles = StyleSheet.create({
  dragSurface: {
    touchAction: 'none',
    userSelect: 'none',
  } as ViewStyle,
});
