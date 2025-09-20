/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended",
    "prettier"
  ],
  plugins: ["react", "react-hooks", "jsx-a11y", "import"],
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  settings: { react: { version: "detect" } },
  rules: {
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "import/order": ["warn", { "newlines-between": "always", "groups": ["builtin","external","internal","parent","sibling","index"] }]
  }
};
