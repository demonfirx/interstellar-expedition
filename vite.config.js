import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

function preloadCriticalFonts() {
  const pageFontPatterns = {
    "index.html": [/bodoni-moda-.*\.woff2$/, /manrope-.*\.woff2$/],
    "maerith.html": [/cinzel-.*\.woff2$/, /manrope-.*\.woff2$/],
    "elden.html": [/cinzel-.*\.woff2$/],
  };

  return {
    name: "preload-critical-fonts",
    enforce: "post",
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const fileName = ctx.path.replace(/^\/+/, "") || "index.html";
      const patterns = pageFontPatterns[fileName];
      if (!patterns) return html;

      const assets = Object.keys(ctx.bundle);
      const tags = [];
      for (const re of patterns) {
        const match = assets.find((a) => re.test(a));
        if (match) {
          tags.push({
            tag: "link",
            attrs: {
              rel: "preload",
              as: "font",
              type: "font/woff2",
              crossorigin: "",
              href: `/${match}`,
            },
            injectTo: "head",
          });
        }
      }
      return tags;
    },
  };
}

export default defineConfig({
  plugins: [preloadCriticalFonts()],
  optimizeDeps: {
    include: [
      "three",
      "three/addons/loaders/GLTFLoader.js",
      "three/addons/libs/meshopt_decoder.module.js",
      "three/addons/utils/SkeletonUtils.js",
      "three/addons/postprocessing/EffectComposer.js",
      "three/addons/postprocessing/RenderPass.js",
      "three/addons/postprocessing/UnrealBloomPass.js",
      "three/addons/postprocessing/OutputPass.js",
    ],
  },
  build: {
    rollupOptions: {
      input: {
        archive: fileURLToPath(new URL("./index.html", import.meta.url)),
        voyage: fileURLToPath(new URL("./voyage.html", import.meta.url)),
        maerith: fileURLToPath(new URL("./maerith.html", import.meta.url)),
        elden: fileURLToPath(new URL("./elden.html", import.meta.url)),
      },
      output: { manualChunks: { three: ["three"], icons: ["lucide"] } },
    },
  },
  server: { port: 5174, strictPort: true },
});
