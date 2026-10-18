import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({
  plugins: [cloudflare({ persistState: { path: ".cloudflare/state" } })],
  server: { host: "localhost", port: 5173, strictPort: true },
});
