import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The app is compiled by Next/SWC (tsconfig says `jsx: preserve`); in tests the transformer
  // itself has to turn TSX into calls, using React's automatic runtime.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", ".next-ci/**"],
    css: false,
  },
});
