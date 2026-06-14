import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

export const CARD_WIDTH = 104;
export const CARD_HEIGHT = 56;

interface WordCardProps {
  cardId?: string;
  word: string;
  style?: ViewStyle;
  ghost?: boolean;
}

const CARD_COLORS = [
  { background: '#fde2e4', border: '#d46a7c' },
  { background: '#dbeafe', border: '#4f83cc' },
  { background: '#dcfce7', border: '#4f9f69' },
  { background: '#fff1c7', border: '#c28a21' },
  { background: '#e9d5ff', border: '#8b5fbf' },
  { background: '#cffafe', border: '#0891b2' },
  { background: '#fed7aa', border: '#c2410c' },
  { background: '#d9f99d', border: '#65a30d' },
  { background: '#fbcfe8', border: '#be185d' },
] as const;

function getFallbackColorIndex(word: string): number {
  return Array.from(word).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
}

function getCardColor(cardId: string | undefined, word: string) {
  const suffix = Number(cardId?.split('-').at(-1));
  const colorIndex = Number.isFinite(suffix)
    ? suffix
    : getFallbackColorIndex(word);
  return CARD_COLORS[colorIndex % CARD_COLORS.length];
}

function getWordFontSize(word: string): number {
  if (word.length >= 10) {
    return 12;
  }

  if (word.length >= 8) {
    return 13;
  }

  if (word.length >= 7) {
    return 14;
  }

  return 16;
}

function getWordTextStyle(word: string) {
  const fontSize = getWordFontSize(word);

  return {
    fontSize,
    lineHeight: Math.ceil(fontSize * 1.38),
  };
}

export const WordCard: React.FC<WordCardProps> = ({
  cardId,
  word,
  style,
  ghost,
}) => {
  const cardColor = getCardColor(cardId, word);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardColor.background,
          borderColor: cardColor.border,
        },
        ghost && styles.ghost,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={word}
    >
      <Text
        style={[styles.word, getWordTextStyle(word)]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {word}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
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
    opacity: 0.35,
    shadowOpacity: 0,
  },
  word: {
    color: '#1a1a2e',
    fontWeight: '600',
    paddingHorizontal: 4,
    textAlign: 'center',
    textTransform: 'lowercase',
    width: '100%',
  },
});
