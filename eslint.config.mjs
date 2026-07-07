import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "src-tauri/target/**",
    "next-env.d.ts",
    // Local scratch / reverse-engineering artifacts.
    "tmp-*.js",
    "tmp-*.txt",
    "scripts/**/*.mjs",
  ]),
  {
    rules: {
      // This rule is too noisy for our current patterns (async loaders in effects).
      "react-hooks/set-state-in-effect": "off",
      // We intentionally mirror callback refs via useRef assignment.
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
