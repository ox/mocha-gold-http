module.exports = {
  "env": {
    "node": true,
  },
  "extends": "airbnb-base",
  "rules": {
    "arrow-body-style": 0,
    "class-methods-use-this": 0,
    "no-debugger": 0,
    "array-bracket-spacing": ["error", "never"],
    "arrow-parens": [2, "as-needed", { "requireForBlockBody": true }],
    "object-curly-spacing": ["error", "never"],
    "comma-dangle": ["error", "always-multiline"],
    "func-names": ["error", "as-needed"],
    "semi": ["error", "always"],
  },
};
