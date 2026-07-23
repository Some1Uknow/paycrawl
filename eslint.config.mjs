import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const repositoryRoot = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(repositoryRoot, "apps/web");

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
  },
  {
    files: [
      "apps/web/**/*.{js,jsx,ts,tsx}",
      "app/**/*.{js,jsx,ts,tsx}",
      "components/**/*.{js,jsx,ts,tsx}",
    ],
    settings: {
      next: {
        rootDir: webRoot,
      },
    },
    rules: nextPlugin.configs.recommended.rules,
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
);
