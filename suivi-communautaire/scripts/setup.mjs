import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".dev.vars"))
  writeFileSync(
    ".dev.vars",
    `AUTH_SECRET=${randomBytes(48).toString("hex")}\n`,
    { mode: 0o600 },
  );
console.log("Configuration locale prête.");
