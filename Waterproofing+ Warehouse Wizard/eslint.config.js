// Added after a conditional hook shipped to production and took Crew+ down: a
// useState declared below an early return, which React rejects outright. Nothing
// in the toolchain was looking for it. rules-of-hooks is the reason this exists.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "supabase/functions", "scripts"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      // Advisory: the codebase has deliberate partial dep arrays.
      "react-hooks/exhaustive-deps": "warn",
      // The repo leans on `any` at the Supabase row boundary on purpose.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
