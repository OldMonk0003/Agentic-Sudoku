import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'coverage/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      /**
       * Principle III: one-way dependency rule, enforced by lint rather than by
       * reviewer memory. engine <- state <- ui, and nothing imports from app/.
       */
      'import/no-restricted-paths': ['error', {
        zones: [
          { target: './src/engine', from: './src/state', message: 'Engine must not import State (Principle III: engine <- state <- ui).' },
          { target: './src/engine', from: './src/ui',    message: 'Engine must not import UI (Principle III).' },
          { target: './src/engine', from: './app',       message: 'Engine must not import the Next.js shell (Principle III).' },
          { target: './src/state',  from: './src/ui',    message: 'State must not import UI (Principle III).' },
          { target: './src/state',  from: './app',       message: 'State must not import the Next.js shell (Principle III).' },
          { target: './src/ui',     from: './app',       message: 'UI must not import the Next.js shell (Principle III).' },
          { target: './src/workers', from: './src/state', message: 'Workers depend only on Engine (Principle III).' },
          { target: './src/workers', from: './src/ui',    message: 'Workers depend only on Engine (Principle III).' },

          /**
           * Feature 002. Tools and View sit at the SAME layer, so neither may
           * import the other: they communicate only through the agent session
           * store (specs/002-webmcp-agent-tutor/contracts/agent-session-store.md).
           * That is what lets playback stop on learner input, and the Disconnect
           * button unregister tools, without either side knowing the other exists.
           */
          { target: './src/ui',      from: './src/tools', message: 'UI must not import Tools. They meet only at src/state/agentSession.ts (002 plan, Structure Decision).' },
          { target: './src/tools',   from: './src/ui',    message: 'Tools must not import UI. Tool handlers must not touch the DOM (Principle III).' },
          { target: './src/engine',  from: './src/tools', message: 'Engine must not import Tools (Principle III).' },
          { target: './src/state',   from: './src/tools', message: 'State must not import Tools (Principle III).' },
          { target: './src/workers', from: './src/tools', message: 'Workers depend only on Engine (Principle III).' },
          { target: './src/tools',   from: './app',       message: 'Tools must not import the Next.js shell (Principle III).' },
        ],
      }],
      'import/no-cycle': ['error', { maxDepth: Infinity }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    /**
     * The Japandi palette lives ONLY in app/globals.css so it has exactly one
     * place it can be audited for contrast (constitution, Technology Constraints).
     * Raw hex or arbitrary-value utilities in a component are a lint failure.
     */
    files: ['src/ui/**/*.tsx', 'src/tools/**/*.tsx', 'app/**/*.tsx'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: 'Raw hex colour in a component. Palette values belong only in app/globals.css @theme.',
        },
        {
          selector: "Literal[value=/\\b(bg|text|border|ring|fill|stroke)-\\[/]",
          message: 'Tailwind arbitrary-value colour utility. Use a named theme token from app/globals.css.',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
