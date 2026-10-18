import type { Actor } from "./auth";
import type { RecordRow } from "./records";
import type { HistoryPage, HistoryRow } from "./case-history";
import { AccessStatus, BackLink, Layout, PageHeading } from "./views";
import { LinkButton } from "./ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/surface";
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }) + " (America/Toronto)";
const short = (id: string) => id.slice(0, 8).toUpperCase();
function label(r: HistoryRow) {
  if (r.action === "transfer") return "Transfert du dossier";
  if (r.action === "status_change") return "Changement de statut";
  if (r.resource_type === "note") return "Note ajoutée";
  if (r.resource_type === "document") return r.action === "create" ? "Document ajouté" : "Document modifié";
  return "Dossier ouvert";
}
function details(r: HistoryRow, caseId: string) {
  const out: { text: string; href?: string }[] = [];
  if (r.action === "transfer") out.push({ text: `Responsable : ${r.previous_owner_name ?? "Non enregistré"} → ${r.new_owner_name ?? "Non enregistré"}` });
  else if (r.action === "status_change") out.push({ text: `Statut : ${r.previous_status ?? "Non enregistré"} → ${r.new_status ?? "Non enregistré"}` });
  else if (r.resource_type === "note") out.push({ text: r.available ? `Référence de la note : ${r.resource_id ? short(r.resource_id) : "non enregistrée"}` : `Note indisponible (référence ${r.resource_id ? short(r.resource_id) : "non enregistrée"})` });
  else if (r.resource_type === "document") {
    const ref = r.resource_id ? short(r.resource_id) : "non enregistrée";
    out.push(
      r.available && r.resource_id
        ? { text: `Document ${ref}`, href: `/dossiers/${caseId}/documents/${r.resource_id}` }
        : { text: `Document indisponible (référence ${ref})` },
    );
    // Aucune valeur n'est déduite de l'état courant : une version absente est signalée comme telle.
    out.push({ text: r.template_id && r.template_version ? `Modèle ${short(r.template_id)}, version ${r.template_version}` : "Modèle ou version du modèle non enregistrés" });
  } else if (r.new_owner_name) out.push({ text: `Responsable initial : ${r.new_owner_name}` });
  if (r.legacy_source) out.push({ text: `Action sur un ancien dossier repris dans celui-ci (origine ${short(r.legacy_source)})` });
  return out;
}
export function HistorySection({ caseId, history }: { caseId: string; history: HistoryPage }) {
  return (
    <section class="mt-14" aria-labelledby="historique-title" id="historique">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="historique-title" class="font-serif text-3xl tracking-tight">
          Historique
        </h2>
        <LinkButton variant="outline" href={`/dossiers/${caseId}#historique`}>
          Actualiser
        </LinkButton>
      </div>
      {history.rows.length ? (
        <ol class="flex flex-col divide-y-2 divide-sand rounded-2xl border-2 border-sand bg-card" aria-label="Actions du dossier, de la plus récente à la plus ancienne">
          {history.rows.map((r) => (
            <li class="flex flex-col gap-1 px-5 py-4">
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <strong class="text-base">{label(r)}</strong>
                <time class="text-sm text-muted-foreground tabular-nums" datetime={r.occurred_at}>
                  {stamp(r.occurred_at)}
                </time>
              </div>
              <div class="text-sm break-words">
                <span class="text-muted-foreground">Par </span>
                {r.actor_name}
                {r.actor_active === 0 ? " (compte désactivé)" : ""}
              </div>
              {details(r, caseId).map((d) => (
                <div class="text-sm break-all text-muted-foreground">{d.href ? <a class="underline underline-offset-4" href={d.href}>{d.text}</a> : d.text}</div>
              ))}
            </li>
          ))}
        </ol>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Aucune action enregistrée</EmptyTitle>
            <EmptyDescription>Aucune action n’a été enregistrée pour ce dossier. L’historique n’est pas reconstitué à partir de l’état courant.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {history.next && (
        <nav class="mt-5 flex justify-end" aria-label="Pagination de l’historique">
          <LinkButton variant="outline" href={`/dossiers/${caseId}/historique?curseur=${encodeURIComponent(history.next)}`}>
            Actions plus anciennes
          </LinkButton>
        </nav>
      )}
    </section>
  );
}
export function HistoryPageView({ actor, row, history }: { actor: Actor; row: RecordRow; history: HistoryPage }) {
  return (
    <Layout title="Historique du dossier" actor={actor}>
      <BackLink href={"/dossiers/" + row.id}>Retour au dossier</BackLink>
      <AccessStatus />
      <div data-case-id={row.id}>
        <PageHeading title={row.name} description="Historique des actions du dossier" />
        <HistorySection caseId={row.id} history={history} />
      </div>
    </Layout>
  );
}
