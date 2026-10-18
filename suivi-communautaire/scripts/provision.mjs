import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fixtureQueries, people } from "./fixtures.mjs";
const database = "7e246701-f720-4ed4-9a21-3b5811778d30";
mkdirSync(".local", { recursive: true, mode: 0o700 });
const file = ".local/credentials.json";
const credentials = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : {
      password: randomBytes(18).toString("base64url"),
      accounts: people.map(([id, name, role]) => ({
        email: `${id}@demo.example`,
        name,
        role,
      })),
    };
const args = process.argv.slice(2);
let queries;
if (args[0] === "disable" && people.some(([id]) => id === args[1]))
  queries = [
    { sql: "UPDATE profiles SET active=0 WHERE user_id=?", params: [args[1]] },
  ];
else if (args.length === 0)
  queries = await fixtureQueries(credentials.password);
else
  throw new Error(
    "Usage: npm run demo ou npm run demo -- disable <identifiant>",
  );
const batch = ".local/provision-batch.json";
writeFileSync(batch, JSON.stringify(queries), { mode: 0o600 });
try {
  const res = spawnSync(
    process.execPath,
    [
      "node_modules/cf/bin/cf",
      "d1",
      "raw",
      database,
      "--local",
      "--persist-to",
      ".cloudflare/state",
      "--batch",
      "@" + batch,
    ],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    console.error("Le provisioning a échoué. Vérifiez les migrations locales.");
    process.exitCode = 1;
  } else {
    if (!existsSync(file))
      writeFileSync(file, JSON.stringify(credentials, null, 2) + "\n", {
        mode: 0o600,
      });
    console.log(
      args.length
        ? "Compte désactivé."
        : "Comptes fictifs prêts. Identifiants dans .local/credentials.json (local uniquement).",
    );
  }
} finally {
  unlinkSync(batch);
}
