import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['test/hardware/**/*.test.ts'], testTimeout: 20_000 } });
