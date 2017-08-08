module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
    'plugin:import/recommended',
    'plugin:flowtype/recommended',
    'plugin:jest/recommended',
  ],
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 7,
    sourceType: 'module',
  },
  plugins: [
    'jest',
    'babel',
    'import',
    'flowtype',
  ],
  rules: {
    'camelcase': 'off',
    'import/unambiguous': 'off',
    'flowtype/require-valid-file-annotation': ['error', 'always'],
  }
};
