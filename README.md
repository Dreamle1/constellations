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

## Project Structure

```
app/                         Expo Router entry points
  _layout.tsx                Root route layout
  index.tsx                  Main game screen route

src/                         React Native frontend source
  components/                Game UI components, board, cards, banners, controls
  constants/                 Shared frontend constants such as game levels
  hooks/                     Reusable React hooks
  screens/                   Screen-level components
  types/                     Frontend TypeScript types
  utils/                     API clients, cache helpers, layout/drag utilities

packages/
  backend/                   Express backend deployed to Render
    src/server.ts            Express app setup, CORS, health route
    src/routes/              API route handlers
    src/services/            Word generation and daily word storage
    data/                    Local generated daily word cache
  shared/                    Types shared by frontend and backend
    src/index.ts             Shared API response and word models

assets/                      Expo icons, splash images, and static assets
scripts/                     Repo-level helper scripts
docs/                        Project documentation
```

The mobile app fetches game words from the backend using `EXPO_PUBLIC_API_URL`
from the root `.env`. For the hosted Render backend, this should point at:

```bash
EXPO_PUBLIC_API_URL=https://constellations-3ils.onrender.com
```

Backend secrets such as `OPENAI_API_KEY` belong in Render environment variables
or `packages/backend/.env` for local backend development. Do not put backend
secrets in Expo public env vars.

## Agent Context

Persistent notes for Codex and other coding agents live in `AGENTS.md` at the
repo root. Use that file for project-specific context, conventions, known
deployment URLs, commands, and things future chats should understand before
making changes.

## 🔧 Available Scripts

- `npm start` - Start development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web
- `npm run dev:all` - Run frontend and backend concurrently
- `npm run backend:dev` - Run backend server only
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
