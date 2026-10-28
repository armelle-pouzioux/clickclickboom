import { defineConfig } from "vite";

export default defineConfig({
  // relative paths: the game works at the root of a domain as well as in a sub-folder (GitHub Pages)
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        game: "game.html",
      },
    },
  },
});
