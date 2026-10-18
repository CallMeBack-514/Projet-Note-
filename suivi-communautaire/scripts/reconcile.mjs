// Précontrôle (lecture seule) et chargement du manifeste de rapprochement sur la base D1 LOCALE.
//   npm run reconcile -- precheck [fichier-sortie]   rapport + gabarit de manifeste
//   npm run reconcile -- apply <manifeste.json>      charge les décisions (avant npm run db:migrate)
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { casesQuery, precheck, validateManifest, manifestStatements, decisionsTable } from "./reconciliation.mjs";
const database = "7e246701-f720-4ed4-9a21-3b5811778d30";
const cf = (extra) =>
  spawnSync(process.execPath, ["node_modules/cf/bin/cf", "d1", "raw", database, "--local", "--persist-to", ".cloudflare/state", ...extra], { encoding: "utf8" });
function readCases() {
  const res = cf(["--sql", casesQuery]);
  if (res.status !== 0) {
    const text = (res.stdout ?? "") + (res.stderr ?? "");
    if (/no such column: service|no such table: cases/.test(text))
      throw new Error("Cette base n’a plus de colonne « service » : elle est déjà au schéma dossier-personne (ou n’est pas migrée). Aucun précontrôle n’est nécessaire.");
    throw new Error("Lecture impossible de la base locale (D1 local, .cloudflare/state).");
  }
  const start = res.stdout.indexOf("[");
  const parsed = JSON.parse(res.stdout.slice(start));
  const block = Array.isArray(parsed) ? parsed[0] : parsed;
  const data = block.results ?? block;
  const cols = data.columns ?? ["id", "organisation_id", "client_id", "owner_id", "service", "opened_at", "version"];
  return (data.rows ?? []).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}
const [command, file] = process.argv.slice(2);
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
if (command === "precheck") {
  const report = precheck(readCases());
  mkdirSync(".local", { recursive: true, mode: 0o700 });
  const out = file ?? ".local/reconciliation-manifest.json";
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  console.log(`${report.people} personne(s), ${report.cases} dossier(s), ${report.blocking.length} regroupement(s) à décider.`);
  console.log(report.blocking.length ? `Complétez les décisions dans ${out}, puis : npm run reconcile -- apply ${out}` : "Aucune décision requise : npm run db:migrate peut être lancé.");
} else if (command === "apply" && file) {
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const problems = validateManifest(manifest, readCases());
  if (problems.length) {
    console.error("Manifeste refusé, rien n’a été chargé :\n- " + problems.join("\n- "));
    process.exit(1);
  }
  const batch = ".local/reconcile-batch.json";
  mkdirSync(".local", { recursive: true, mode: 0o700 });
  writeFileSync(batch, JSON.stringify([{ sql: decisionsTable, params: [] }, ...manifestStatements(manifest)]), { mode: 0o600 });
  try {
    const res = cf(["--batch", "@" + batch]);
    if (res.status !== 0) throw new Error("Chargement impossible.");
    console.log("Décisions chargées. Sauvegardez la base puis lancez npm run db:migrate.");
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    unlinkSync(batch);
  }
} else {
  console.error("Usage : npm run reconcile -- precheck [sortie] | apply <manifeste.json>");
  process.exit(1);
}
