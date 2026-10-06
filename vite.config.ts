import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
const assets = ["cmaps", "standard_fonts", "wasm", "iccs"];
export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-pdf-assets",
      configureServer(server) {
        server.middlewares.use("/pdfjs/", (request, response, next) => {
          try {
            const relative = decodeURIComponent(
              (request.url || "").split("?")[0],
            );
            const base = resolve("node_modules/pdfjs-dist");
            const path = resolve(base, relative.replace(/^\//, ""));
            if (
              !path.startsWith(base + sep) ||
              !assets.some((a) => path.startsWith(resolve(base, a) + sep)) ||
              !existsSync(path)
            ) {
              next();
              return;
            }
            response.setHeader(
              "Content-Type",
              path.endsWith(".wasm")
                ? "application/wasm"
                : "application/octet-stream",
            );
            response.end(readFileSync(path));
          } catch {
            next();
          }
        });
      },
      closeBundle() {
        for (const asset of assets)
          cpSync(
            resolve("node_modules/pdfjs-dist", asset),
            resolve("dist/pdfjs", asset),
            { recursive: true },
          );
      },
    },
  ],
  build: { chunkSizeWarningLimit: 1700 },
});
