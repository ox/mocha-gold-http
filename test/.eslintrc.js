module.exports = {
  "env": {
    "node": true,
    "mocha": true,
  },
  "plugins": [
    "mocha",
  ],
  "rules": {
    "prefer-arrow-callback": 0,
    "func-names": ["error", "never"],
  },
};
