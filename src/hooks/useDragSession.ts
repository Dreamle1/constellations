import { useCallback, type RefObject } from 'react';
import type { View as RNView } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { LayoutRect } from '@/types/cards';

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

export interface DragSession {
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
  beginDrag: (absoluteX: number, absoluteY: number, cardRect: LayoutRect) => void;
  endDrag: () => void;
  floatingStyle: ReturnType<typeof useAnimatedStyle>;
}

export function useDragSession(
  containerRef: RefObject<RNView | null>,
): DragSession {
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const grabOffsetX = useSharedValue(0);
  const grabOffsetY = useSharedValue(0);
  const containerX = useSharedValue(0);
  const containerY = useSharedValue(0);

  const beginDrag = useCallback(
    (absoluteX: number, absoluteY: number, cardRect: LayoutRect) => {
      fingerX.value = absoluteX;
      fingerY.value = absoluteY;
      grabOffsetX.value = absoluteX - cardRect.x;
      grabOffsetY.value = absoluteY - cardRect.y;

      measureViewInWindow(containerRef.current, (containerRect) => {
        containerX.value = containerRect.x;
        containerY.value = containerRect.y;
      });
    },
    [
      containerRef,
      containerX,
      containerY,
      fingerX,
      fingerY,
      grabOffsetX,
      grabOffsetY,
    ],
  );

  const endDrag = useCallback(() => {
    fingerX.value = 0;
    fingerY.value = 0;
  }, [fingerX, fingerY]);

  const floatingStyle = useAnimatedStyle(() => {
    return {
      left: fingerX.value - grabOffsetX.value - containerX.value,
      opacity: fingerX.value > 0 && fingerY.value > 0 ? 1 : 0,
      top: fingerY.value - grabOffsetY.value - containerY.value,
    };
  });

  return {
    beginDrag,
    endDrag,
    fingerX,
    fingerY,
    floatingStyle,
  };
}
