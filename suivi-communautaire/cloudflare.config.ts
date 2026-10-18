import { bindings, defineConfig } from "cf/config";
export default defineConfig(({ mode }) => ({
  worker: {
    name: "suivi-communautaire",
    entrypoint: "./src/index.tsx",
    compatibilityDate: "2026-10-17",
    compatibilityFlags: ["nodejs_compat"],
    env: {
      DB: bindings.d1({
        name: "suivi-communautaire-db",
        ...(mode === "production"
          ? {}
          : { id: "7e246701-f720-4ed4-9a21-3b5811778d30" }),
      }),
      AUTH_SECRET: bindings.secret(),
      APP_ORIGIN: bindings.text(
        mode === "production"
          ? (process.env.APP_ORIGIN ??
              "https://configure-before-deploy.invalid")
          : "http://localhost:5173",
      ),
    },
    observability: { enabled: false },
  },
}));
