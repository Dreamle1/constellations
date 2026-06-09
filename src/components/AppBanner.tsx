import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AppBannerProps {
  title: string;
}

export const AppBanner: React.FC<AppBannerProps> = ({ title }) => {
  return (
    <View style={styles.banner} accessibilityRole="header">
      <View style={styles.headerContent}>
        <Text style={styles.title}>{title}</Text>
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
    justifyContent: 'center',
  },
  title: {
    color: '#f5f5f5',
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
