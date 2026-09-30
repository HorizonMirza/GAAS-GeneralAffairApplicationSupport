import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // GAAS intentionally initializes modal state and starts API loads when an effect observes
      // an open/filter change. Rewriting these as render-time updates would change working flows.
      "react-hooks/set-state-in-effect": "off",
      // Most images are authenticated uploads, blob previews, or runtime URLs where next/image's
      // optimizer cannot fetch the source. Native img elements are the correct transport here.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
