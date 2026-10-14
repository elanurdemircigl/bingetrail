import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import base from '@bingetrail/config/eslint/base';

export default tseslint.config(...base, reactHooks.configs.flat.recommended, {
  files: ['*.config.js', 'babel.config.js', 'metro.config.js', 'tailwind.config.js'],
  languageOptions: { globals: globals.node, sourceType: 'commonjs' },
  rules: { '@typescript-eslint/no-require-imports': 'off' },
});
