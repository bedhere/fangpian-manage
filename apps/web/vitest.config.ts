import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "@external-collab": fileURLToPath(new URL("../external-collab/client/src", import.meta.url)) },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
