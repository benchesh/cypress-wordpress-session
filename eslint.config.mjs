import js from '@eslint/js'
import globals from 'globals'
import pluginCypress from 'eslint-plugin-cypress'

export default [
  js.configs.recommended,
  pluginCypress.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.commonjs,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'eqeqeq': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-throw-literal': 'error',
      'no-duplicate-imports': 'error',
    },
  },
]
