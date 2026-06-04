import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBanner, ConstellationBoard } from '@components';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppBanner title="Constellations" />
      <View style={styles.content}>
        <ConstellationBoard />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
});
