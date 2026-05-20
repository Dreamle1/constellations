# Constellations - React Native + TypeScript Template

A modern React Native template with TypeScript, Expo Router, and essential development tools configured.

## 📱 Features

- **React Native** with **Expo** for cross-platform development
- **TypeScript** for type-safe code
- **Expo Router** for file-based routing
- **ESLint** for code quality
- **Jest** for testing
- **Path aliases** for cleaner imports
- **Pre-configured components and hooks** starter files

## 🚀 Quick Start

### Prerequisites

- Node.js (v20.19+ for Expo SDK 54; see `.nvmrc`)
- npm or yarn
- Expo CLI (optional: `npm install -g expo-cli`)

### Installation

1. Install dependencies:

```bash
npm install
# or
yarn install
```

2. Start the development server:

```bash
npm start
# or
yarn start
```

3. Choose your platform:
   - **iOS**: Press `i`
   - **Android**: Press `a`
   - **Web**: Press `w`

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/             # Screen components
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
├── types/               # TypeScript type definitions
app/
├── _layout.tsx          # Root layout with routing
├── index.tsx            # Home screen
assets/                  # Images, fonts, etc.
```

## 🔧 Available Scripts

- `npm start` - Start development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web
- `npm run type-check` - Check TypeScript types
- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier
- `npm test` - Run Jest tests

## 💻 Development

### Creating Components

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MyComponentProps {
  title: string;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  return (
    <View style={styles.container}>
      <Text>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
```

### Using Custom Hooks

```typescript
import { useCounter } from '@hooks';

export default function Counter() {
  const { count, increment, decrement } = useCounter(0);

  return (
    // Use hook values...
  );
}
```

### Using Path Aliases

```typescript
// Instead of: import { Button } from '../../../src/components'
// Use:
import { Button } from '@components';
import { formatDate } from '@utils';
```

## 📦 Path Aliases

The following aliases are pre-configured in `tsconfig.json`:

- `@/*` → `./src/*`
- `@components` / `@components/*` → `./src/components`
- `@screens` / `@screens/*` → `./src/screens`
- `@utils` / `@utils/*` → `./src/utils`
- `@hooks` / `@hooks/*` → `./src/hooks`
- `@types` / `@types/*` → `./src/types`

## 🧪 Testing

```bash
npm test
```

Tests should be placed in `__tests__` folders or named with `.test.ts` or `.spec.ts` suffix.

## 🎨 Styling

This template uses React Native's built-in `StyleSheet` API. For additional styling options, consider:

- **NativeWind**: Tailwind CSS for React Native
- **React Native Paper**: UI component library
- **Styled Components**: CSS-in-JS library

## 📚 Resources

- [React Native Documentation](https://reactnative.dev)
- [Expo Documentation](https://docs.expo.dev)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [TypeScript Documentation](https://www.typescriptlang.org)

## 📝 License

MIT

## 🤝 Contributing

Feel free to fork and submit pull requests for any improvements!
