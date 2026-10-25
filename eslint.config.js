import unjs from 'eslint-config-unjs'

export default unjs({
  ignores: ['**/node_modules/**', '**/dist/**', '**/static/**', '**/postman/**'],
  rules: {
    'unicorn/no-anonymous-default-export': 0,
  },
})
