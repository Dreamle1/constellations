import path from 'path';
import dotenv from 'dotenv';

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '../..');

// Backend .env takes precedence; repo root .env is a fallback.
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env'), override: true });
