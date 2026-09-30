import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

// Emits the app shell at dist/app/index.html (served at /app/) instead of dist/src/app/index.html.
function relocateApp(): Plugin {
  return {
    name: "zkhub-relocate-app",
    enforce: "post",
    generateBundle(_o, bundle) {
      for (const [name, asset] of Object.entries(bundle)) {
        if (name === "src/app/index.html" && asset.type === "asset") { asset.fileName = "app/index.html"; }
      }
    },
  };
}

export default defineConfig({
  plugins: [relocateApp()],
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: { input: { main: resolve(__dirname, "index.html"), app: resolve(__dirname, "src/app/index.html") } },
  },
});
