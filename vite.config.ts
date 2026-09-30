import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  appType: "mpa",
  plugins: [solid(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        examples: resolve(import.meta.dirname, "examples.html"),
        supported: resolve(import.meta.dirname, "supported.html"),
      },
    },
  },
});
