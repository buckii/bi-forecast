import globals from 'globals'
import vuePlugin from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

// Deliberately narrow: this catches the class of bug a formatter cannot — a name used but never
// imported or defined. Style is Prettier's job.
const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-unreachable': 'error',
  // Views are legitimately single-word here (Login, Settings, Users).
  'vue/multi-word-component-names': 'off',
}

export default [
  { ignores: ['dist/**', 'node_modules/**', 'dev-dist/**', 'coverage/**', 'public/**', '.netlify/**'] },
  {
    files: ['netlify/functions/**/*.js', 'netlify/functions/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules,
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules,
  },
  // The Vue flat config makes the template visible to the linter, so a binding used only in the
  // template is not reported as unused.
  ...vuePlugin.configs['flat/essential'].map((config) => ({
    ...config,
    files: ['src/**/*.vue'],
  })),
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      ...rules,
      // A <script setup> binding used only in the template reads as unused here, so this rule is
      // left to the .js files where it is reliable.
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.js', 'src/test/**'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser, ...globals.vitest },
    },
  },
  {
    files: ['*.config.js', 'vite.config.js', 'vitest.config.js', 'tailwind.config.js', 'postcss.config.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },
]
