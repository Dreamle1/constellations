# Development Guide

This guide provides information on developing with the Constellations React Native template.

## Development Setup

### Prerequisites

- **Node.js**: v18 or higher (use `.nvmrc` with nvm)
- **npm** or **yarn** package manager
- **Expo CLI** (optional): `npm install -g expo-cli`
- **Android Studio** (for Android development)
- **Xcode** (for iOS development on macOS)

### Initial Setup

```bash
# Install dependencies
npm install

# Verify TypeScript setup
npm run type-check

# Start development server
npm start
```

## Development Commands

### Running the App

```bash
# Start Expo CLI (interactive menu)
npm start

# Run on specific platform
npm run ios      # iOS (requires macOS)
npm run android  # Android
npm run web      # Web browser
```

### Code Quality

```bash
# Type check
npm run type-check

# Lint code
npm run lint

# Format code (using Prettier)
npm run format
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── Button.tsx
│   └── index.ts
├── screens/          # Full-screen components
│   ├── HomeScreen.tsx
│   └── index.ts
├── hooks/            # Custom React hooks
│   ├── useCounter.ts
│   └── index.ts
├── utils/            # Utility functions
│   ├── helpers.ts
│   └── index.ts
└── types/            # TypeScript types
    └── index.ts

app/                  # Expo Router navigation
├── _layout.tsx       # Root layout
└── index.tsx         # Home route

assets/               # Images, fonts, etc.
```

## Creating Components

### Class Component Example

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NavbarProps {
  title: string;
}

export class Navbar extends React.Component<NavbarProps> {
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{this.props.title}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
```

### Functional Component Example

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CardProps {
  title: string;
  description: string;
}

export const Card: React.FC<CardProps> = ({ title, description }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
});
```

## Creating Custom Hooks

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export const useFetch = <T,>(url: string): UseFetchResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        const json = await response.json();

        if (mounted) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [url]);

  return { data, loading, error };
};
```

## Using Path Aliases

Instead of relative imports:

```typescript
// ❌ Avoid
import { Button } from '../../../components';
import { formatDate } from '../../utils/helpers';

// ✅ Prefer
import { Button } from '@components';
import { formatDate } from '@utils';
```

## Styling Best Practices

1. **Use StyleSheet**: Creates optimized style objects
2. **Responsive Design**: Use percentage and flex for responsive layouts
3. **Consistency**: Define common styles and reuse them
4. **Platform-specific**: Use `Platform.select()` for OS differences

```typescript
import { StyleSheet, Platform } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: '5%',
    paddingTop: Platform.OS === 'ios' ? 10 : 0,
  },
  text: {
    fontSize: 16,
    color: '#333',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
    }),
  },
});
```

## Environment Variables

1. Copy `.env.example` to `.env`
2. Fill in your environment-specific values
3. Access in your code:

```typescript
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
```

## Debugging

### Using React Native Debugger

1. Install [React Native Debugger](https://github.com/jhen0409/react-native-debugger)
2. Run your app: `npm start`
3. Open React Native Debugger
4. Press `Cmd+D` (iOS) or `Cmd+M` (Android) in Expo to open developer menu
5. Select "Open Redux DevTools"

### Console Logging

```typescript
console.log('Debug message:', value);
console.warn('Warning message:', value);
console.error('Error message:', value);
```

## Performance Tips

1. **Use memoization**: Wrap components with `React.memo`
2. **Optimize lists**: Use `FlatList` instead of `ScrollView`
3. **Lazy load**: Load screens only when needed with Expo Router
4. **Image optimization**: Use proper image dimensions

## Deployment

### Building for Production

Use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

See the [Expo deployment docs](https://docs.expo.dev/deploy/build-project/) for details.

## Troubleshooting

### Common Issues

**Module not found error**
- Check path aliases in `tsconfig.json`
- Verify import statements match file location

**TypeScript errors**
- Run `npm run type-check` to see all errors
- Check type definitions in `src/types/`

**Port already in use**
- Kill the process: `lsof -i :19000` (macOS/Linux)
- Or specify different port: `npm start -- --port 19001`

## Resources

- [React Native Docs](https://reactnative.dev/)
- [Expo Router Guide](https://docs.expo.dev/router/introduction/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Hooks API](https://react.dev/reference/react)

## Getting Help

- Check the main [README.md](./README.md)
- Open an issue on GitHub
- Ask in the community forums
