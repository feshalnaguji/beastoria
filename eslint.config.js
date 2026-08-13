import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // THE boundary rule: src/sim is pure and deterministic.
    // No renderer/DOM imports, no wall-clock time, no unseeded randomness.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['pixi.js', 'pixi.js/*'], message: 'sim/ must stay headless — no Pixi.' },
            {
              group: ['../app/*', '../render/*', '../audio/*', '../persist/*', '../ui/*', '../rigs/*'],
              message: 'sim/ must not depend on presentation, persistence, or app layers.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in sim/rng.ts.' },
        { object: 'Date', property: 'now', message: 'Sim time is tick count only.' },
        { object: 'performance', property: 'now', message: 'Sim time is tick count only.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'sim/ must stay headless.' },
        { name: 'window', message: 'sim/ must stay headless.' },
      ],
    },
  },
);
