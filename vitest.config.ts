import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Mesmo "@/" do tsconfig — sem isto o teste não consegue importar o
    // middleware, que usa o alias.
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
