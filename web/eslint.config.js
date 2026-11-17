import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "public/mockServiceWorker.js"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/mocks/*", "**/mocks/*"],
              message: "mock은 src/main.tsx의 개발 모드 분기에서만 불러옵니다.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/main.tsx", "src/mocks/**", "src/test/**", "**/*.test.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" },
  },
);
