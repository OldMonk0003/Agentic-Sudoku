import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        // Engine and State must be testable with no DOM at all (Principle III).
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          include: ['tests/unit/**/*.test.ts', 'tests/property/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'component',
          environment: 'jsdom',
          globals: true,
          include: ['tests/component/**/*.test.tsx'],
        },
      },
    ],
  },
});
