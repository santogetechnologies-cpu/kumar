import { defineConfig } from "vite";
import { TanStackStartVite } from "@tanstack/react-start/plugin";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    TanStackStartVite({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
