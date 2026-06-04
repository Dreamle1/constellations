import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

interface GameToastProps {
  message: string;
  onDismiss: () => void;
  durationMs: number;
}

export const GameToast: React.FC<GameToastProps> = ({
  message,
  onDismiss,
  durationMs,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(durationMs),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        onDismiss();
      }
    });

    return () => animation.stop();
  }, [durationMs, message, onDismiss, opacity]);

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  text: {
    color: '#f5f5f5',
    fontSize: 14,
    textAlign: 'center',
  },
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 8,
    marginTop: 8,
    maxWidth: 320,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
