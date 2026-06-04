import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

export const CARD_WIDTH = 104;
export const CARD_HEIGHT = 56;

interface WordCardProps {
  word: string;
  style?: ViewStyle;
  ghost?: boolean;
}

export const WordCard: React.FC<WordCardProps> = ({ word, style, ghost }) => {
  return (
    <View
      style={[styles.card, ghost && styles.ghost, style]}
      accessibilityRole="button"
      accessibilityLabel={word}
    >
      <Text style={[styles.word, ghost && styles.ghostWord]}>{word}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#c5cae9',
    borderRadius: 10,
    borderWidth: 1,
    elevation: 3,
    height: CARD_HEIGHT,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    width: CARD_WIDTH,
  },
  ghost: {
    elevation: 0,
    opacity: 0.5,
    shadowOpacity: 0,
  },
  ghostWord: {
    opacity: 1,
  },
  word: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
});
