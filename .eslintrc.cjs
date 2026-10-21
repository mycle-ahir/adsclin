/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
  ],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
  },
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  ignorePatterns: ['dist', 'release', 'node_modules', '*.js', '*.cjs'],
};
