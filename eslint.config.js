import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["build/**", "node_modules/**", ".claude/**", ".opencode/**", "dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        project: true,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-var": "warn",
      "prefer-spread": "warn",
    },
  },
  {
    files: ["src/**/*.test.ts", "src/**/__tests__/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "describe",
          property: "only",
          message: "Focused tests are not allowed in committed code.",
        },
        {
          object: "it",
          property: "only",
          message: "Focused tests are not allowed in committed code.",
        },
        {
          object: "test",
          property: "only",
          message: "Focused tests are not allowed in committed code.",
        },
      ],
    },
  },
  {
    files: ["src/tools/**/__tests__/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: "Use deterministic fixtures instead of Math.random in tests.",
        },
        {
          selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
          message: "Use deterministic fixture IDs instead of randomUUID in tests.",
        },
      ],
    },
  },
);
