import type { Actor } from "./auth";
import type { AuditFilters, AuditPage, AuditRow } from "./audit";
import { Layout, PageHeading, Notice, AccessStatus } from "./views";
import { LinkButton, Button } from "./ui/button";
import { Input, Label, NativeSelect } from "./ui/form";
import { Badge, Card, Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/surface";
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "medium" });
const actionLabel: Record<string, string> = {
  create: "Création",
  read: "Consultation",
  update: "Modification",
  transfer: "Transfert",
  status_change: "Changement de statut",
  audit_read: "Consultation du journal",
  access_denied: "Refus d’accès",
};
const routeLabel: Record<string, string> = {
  case_read: "lecture de dossier",
  case_write: "écriture de dossier",
  content_read: "lecture de contenu",
  content_write: "écriture de contenu",
  audit_read: "consultation du journal",
};
const typeLabel: Record<string, string> = {
  case: "Dossier",
  note: "Note",
  follow_up: "Suivi",
  document: "Document",
  document_template: "Modèle",
  audit_log: "Journal",
};
const short = (id: string) => id.slice(0, 8).toUpperCase();
const ids = (json: string | null): string[] => {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
// Références minimales : identifiants abrégés, versions et états techniques, jamais de contenu.
function references(r: AuditRow) {
  const parts: string[] = [];
  const cases = ids(r.case_ids);
  if (cases.length) parts.push("Dossier" + (cases.length > 1 ? "s " : " ") + cases.map(short).join(", "));
  if (r.resource_type && r.resource_type !== "case" && r.resource_type !== "audit_log")
    parts.push(`${typeLabel[r.resource_type] ?? r.resource_type} ${r.resource_id ? short(r.resource_id) : ""}`.trim());
  if (r.template_id) parts.push(`Modèle ${short(r.template_id)}${r.template_version ? " v" + r.template_version : ""}`);
  if (r.previous_status || r.new_status) parts.push(`${r.previous_status ?? "—"} → ${r.new_status ?? "—"}`);
  if (r.previous_owner_id || r.new_owner_id)
    parts.push(`Responsable ${r.previous_owner_id ? short(r.previous_owner_id) : "—"} → ${r.new_owner_id ? short(r.new_owner_id) : "—"}`);
  if (r.previous_state || r.new_state) parts.push(`État ${r.previous_state ?? "—"} → ${r.new_state ?? "—"}`);
  if (r.action === "audit_read") {
    const viewed = ids(r.viewed_event_ids);
    parts.push(viewed.length ? `${viewed.length} événement${viewed.length > 1 ? "s" : ""} consulté${viewed.length > 1 ? "s" : ""} (${viewed.slice(0, 3).map(short).join(", ")}${viewed.length > 3 ? "…" : ""})` : "Page vide");
  }
  if (r.action === "access_denied" && r.route_code) parts.push(`Catégorie : ${routeLabel[r.route_code] ?? r.route_code}`);
  return parts.length ? parts : ["—"];
}
export function AuditPageView({
  actor,
  page,
  filters,
  query,
}: {
  actor: Actor;
  page: AuditPage;
  filters: AuditFilters;
  query: string;
}) {
  const denied = (r: AuditRow) => r.result === "denied";
  return (
    <Layout title="Journal des accès" actor={actor} section="audit">
      <div data-requires-supervisor data-audit-org={actor.organisation_id}>
        <PageHeading
          title="Journal des accès"
          description="Consultations, modifications et refus enregistrés pour votre organisme. Les références ne contiennent aucun contenu de dossier."
        />
        <AccessStatus />
        <form method="get" action="/audit" class="mb-6 grid gap-4 md:grid-cols-2" aria-label="Filtres du journal">
          <div class="flex flex-col gap-2">
            <Label for="f-dossier">Dossier (identifiant)</Label>
            <Input id="f-dossier" name="dossier" value={filters.case} maxlength={100} autocomplete="off" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="f-acteur">Acteur</Label>
            <NativeSelect id="f-acteur" name="acteur">
              <option value="">Tous les acteurs</option>
              {page.actors.map((a) => (
                <option value={a.id} selected={filters.actor === a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div class="flex flex-col gap-2">
            <Label for="f-action">Action</Label>
            <NativeSelect id="f-action" name="action">
              <option value="">Toutes les actions</option>
              {Object.entries(actionLabel).map(([value, label]) => (
                <option value={value} selected={filters.action === value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
              <Label for="f-du">Du</Label>
              <Input id="f-du" name="du" type="date" value={filters.from} />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="f-au">Au (inclus)</Label>
              <Input id="f-au" name="au" type="date" value={filters.to} />
            </div>
          </div>
          <p class="text-sm text-muted-foreground md:col-span-2">Les dates sont interprétées dans le fuseau America/Toronto.</p>
          <div class="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button>Filtrer</Button>
            <a class="text-base font-semibold underline underline-offset-4" href="/audit">
              Réinitialiser
            </a>
          </div>
        </form>
        {page.rows.length ? (
          <div class="flex flex-col gap-3" role="list" aria-label="Événements du journal">
            {page.rows.map((r) => (
              <Card class="gap-2 py-4" role="listitem">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-5">
                  <strong class="text-base">{actionLabel[r.action] ?? r.action}</strong>
                  <Badge variant={denied(r) ? "warning" : "success"}>{denied(r) ? "Refus" : r.action === "read" || r.action === "audit_read" ? "Consultation réussie" : "Réussi"}</Badge>
                  <span class="text-sm text-muted-foreground tabular-nums">{stamp(r.occurred_at)}</span>
                </div>
                <div class="px-5 text-sm break-words">
                  <span class="text-muted-foreground">Acteur : </span>
                  {r.actor_name}
                  {r.actor_active === 0 ? " (compte désactivé)" : ""}
                </div>
                <ul class="px-5 text-sm break-all text-muted-foreground">
                  {references(r).map((p) => (
                    <li>{p}</li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Aucun événement trouvé</EmptyTitle>
              <EmptyDescription>Aucun événement de votre organisme ne correspond à ces filtres.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {page.next && (
          <nav class="mt-6 flex justify-end" aria-label="Pagination du journal">
            <LinkButton variant="outline" href={`/audit?${query}${query ? "&" : ""}curseur=${encodeURIComponent(page.next)}`}>
              Suivants
            </LinkButton>
          </nav>
        )}
        <p class="mt-8 text-sm text-muted-foreground">
          Ce journal est un registre technique d’accès. Il ne remplace pas le registre organisationnel des incidents.
        </p>
      </div>
    </Layout>
  );
}
export { Notice };
