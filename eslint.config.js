import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, __APP_VERSION__: "readonly" },
    },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { sourceType: "script", globals: globals.serviceworker },
  },
  {
    files: ["tests/**", "*.config.js"],
    languageOptions: { globals: globals.node },
  },
];
