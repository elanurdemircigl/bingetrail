import globals from 'globals';
import tseslint from 'typescript-eslint';

import base from './eslint/base.mjs';

export default tseslint.config(...base, {
  languageOptions: { globals: globals.node },
});
