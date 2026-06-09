import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type GameBannerVariant = 'success' | 'failed';

interface GameBannerProps {
  variant: GameBannerVariant;
}

const COPY: Record<GameBannerVariant, { title: string; subtitle: string }> = {
  success: {
    title: 'Constellation complete!',
    subtitle: 'You found the correct order.',
  },
  failed: {
    title: 'Out of tries',
    subtitle: 'This constellation has faded.',
  },
};

export const GameBanner: React.FC<GameBannerProps> = ({ variant }) => {
  const { title, subtitle } = COPY[variant];

  return (
    <View
      style={[styles.banner, variant === 'success' ? styles.success : styles.failed]}
      accessibilityRole="alert"
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  failed: {
    backgroundColor: '#ffebee',
    borderColor: '#ef9a9a',
    borderWidth: 1,
  },
  subtitle: {
    color: '#444',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  success: {
    backgroundColor: '#e8f5e9',
    borderColor: '#a5d6a7',
    borderWidth: 1,
  },
  title: {
    color: '#1a1a2e',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
});
