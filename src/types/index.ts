/**
 * Application-wide type definitions
 */

export * from './cards';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AppTheme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    text: string;
    textSecondary: string;
  };
}
