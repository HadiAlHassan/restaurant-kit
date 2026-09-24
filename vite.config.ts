import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const bundledDependencies = new Set<string>();

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        worker: resolve(__dirname, "src/worker/index.ts"),
      },
      formats: ["es"],
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: (id) => !id.startsWith(".") && !id.startsWith("/") && !bundledDependencies.has(id),
      output: {
        // One file per source module, so a site's bundler can tree-shake the barrel and split
        // the lazily loaded admin into its own chunk.
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        assetFileNames: "restaurant-kit[extname]",
      },
    },
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
