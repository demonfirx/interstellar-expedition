import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        archive: fileURLToPath(new URL("./index.html", import.meta.url)),
        voyage: fileURLToPath(new URL("./voyage.html", import.meta.url)),
        elden: fileURLToPath(new URL("./elden.html", import.meta.url)),
      },
      output: { manualChunks: { three: ["three"], icons: ["lucide"] } },
    },
  },
  server: { port: 5174, strictPort: true },
});
