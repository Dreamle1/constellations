import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchGameWords } from '@/utils/gameWordsApi';
import { Button } from './Button';

interface AppBannerProps {
  title: string;
}

export const AppBanner: React.FC<AppBannerProps> = ({ title }) => {
  const [loading, setLoading] = useState(false);

  const handleGenerateWords = async () => {
    setLoading(true);
    try {
      console.log('🎮 Requesting words from backend...');
      const words = await fetchGameWords({ theme: 'constellation' });
      console.log('✅ Received words:', words);
    } catch (error) {
      console.error('❌ Error fetching words:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.banner} accessibilityRole="header">
      <View style={styles.headerContent}>
        <Text style={styles.title}>{title}</Text>
        <Button
          onPress={handleGenerateWords}
          disabled={loading}
          title={loading ? 'Loading...' : 'Generate'}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#1a1a2e',
    borderBottomColor: '#2d2d44',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#f5f5f5',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
});
