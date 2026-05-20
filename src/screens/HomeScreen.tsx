import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '@components';
import { useCounter } from '@hooks';

export default function HomeScreen() {
  const { count, increment, decrement, reset } = useCounter(0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Constellations</Text>

      <View style={styles.counterSection}>
        <Text style={styles.counterLabel}>Counter: {count}</Text>
        <View style={styles.buttonGroup}>
          <Button title="Increment" onPress={increment} />
          <Button title="Decrement" onPress={decrement} />
          <Button title="Reset" onPress={reset} />
        </View>
      </View>

      <Text style={styles.footer}>Happy coding 33248! 🚀</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  counterSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  counterLabel: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
  },
  buttonGroup: {
    gap: 10,
  },
  footer: {
    fontSize: 14,
    color: '#999',
    marginTop: 20,
  },
});
