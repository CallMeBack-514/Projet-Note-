import type { Child } from "hono/jsx";
import type { Actor } from "./auth";
import type { RecordRow } from "./records";
import {
  AccessStatus,
  BackLink,
  CancelLink,
  DefItem,
  DefList,
  FormActions,
  FormCard,
  Layout,
  Notice,
  PageHeading,
  PaginationNav,
  TextField,
  rowCard,
} from "./views";
import type { NoteRow } from "./notes";
import type { HistoryPage } from "./case-history";
import { HistorySection } from "./views-history";
import type { DocumentRow, DocumentSummary } from "./documents";
import { answerKey } from "./documents";
import { fieldTypes, type DraftField, type Field as TemplateField, type TemplateRow } from "./document-templates";
import { formatInstant, defaultZone } from "./time";
import { limits } from "./limits";
import { Button, LinkButton } from "./ui/button";
import { Checkbox, Field, FieldDescription, FieldError, FieldLegend, FieldSet, Input, Label, NativeSelect, Textarea } from "./ui/form";
import { Icon } from "./ui/icons";
import { Badge, Card, CardContent, CardHeader, CardTitle, Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/surface";
// Date de naissance AAAA-MM-JJ : affichée telle quelle, sans conversion de fuseau horaire.
const birthDay = (date: string) => new Date(date + "T00:00:00Z").toLocaleDateString("fr-CA", { timeZone: "UTC", dateStyle: "long" });
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" });
const zones = [
  "America/Toronto",
  "America/Montreal",
  "America/Halifax",
  "America/St_Johns",
  "America/Winnipeg",
  "America/Edmonton",
  "America/Vancouver",
  "UTC",
];
type Errors = Record<string, string>;
const recordLink = "record-name text-lg font-semibold break-words underline-offset-4 hover:underline";
const metaText = "text-sm text-muted-foreground";
function Pager({ base, param, page, total, extra = "" }: { base: string; param: string; page: number; total: number; extra?: string }) {
  if (total <= limits.pageSize) return null;
  const href = (p: number) => `${base}?${param}=${p}${extra}`;
  return (
    <PaginationNav
      page={page}
      pages={Math.ceil(total / limits.pageSize)}
      prev={page > 1 ? href(page - 1) : undefined}
      next={page * limits.pageSize < total ? href(page + 1) : undefined}
    />
  );
}
function SectionHeading({ id, title, children }: { id: string; title: string; children?: Child }) {
  return (
    <header class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} class="text-4xl tracking-[-0.03em]">
        {title}
      </h2>
      {children}
    </header>
  );
}
function NoteItem({ n, caseId }: { n: NoteRow; caseId: string }) {
  return (
    <Card class="gap-4" data-note id={"note-" + n.id}>
      <CardHeader>
        <h3 class="text-xl font-semibold">{n.nature}</h3>
        <p class={metaText}>
          Interaction : {formatInstant(n.occurred_at, n.time_zone)} ({n.time_zone}) · Saisie par {n.author_name} le {stamp(n.recorded_at)}
        </p>
        {n.participants && <p class={metaText}>Personnes présentes : {n.participants}</p>}
      </CardHeader>
      <CardContent class="flex flex-col gap-5">
        <p class="max-w-prose text-base leading-relaxed whitespace-pre-wrap break-words">{n.body}</p>
        {n.fu_id && (
          <form class="rounded-xl border-2 border-sand bg-background p-4" method="post" action={`/dossiers/${caseId}/notes/${n.id}/suivi`}>
            <input type="hidden" name="version" value={n.fu_version ?? 1} />
            <FieldSet class="gap-4">
              <legend class="mb-3 flex flex-wrap items-center gap-2 font-semibold">
                Suite à donner ·{" "}
                <Badge variant={n.fu_state === "done" ? "success" : "warning"}>{n.fu_state === "done" ? "Terminée" : "À faire"}</Badge>
              </legend>
              <Field>
                <Label for={"fd-" + n.id}>Tâche</Label>
                <Input id={"fd-" + n.id} name="description" value={n.fu_description ?? ""} maxlength={limits.followUp} required autocomplete="off" />
              </Field>
              <div class="grid gap-4 md:grid-cols-2">
                <Field>
                  <Label for={"fe-" + n.id}>Échéance</Label>
                  <Input id={"fe-" + n.id} name="due" type="date" value={n.fu_due ?? ""} />
                </Field>
                <Field>
                  <Label for={"fs-" + n.id}>État</Label>
                  <NativeSelect id={"fs-" + n.id} name="state">
                    <option value="todo" selected={n.fu_state === "todo"}>
                      À faire
                    </option>
                    <option value="done" selected={n.fu_state === "done"}>
                      Terminée
                    </option>
                  </NativeSelect>
                </Field>
              </div>
              {n.fu_state === "done" && n.fu_closed_at && (
                <p class={metaText}>
                  Terminée le {stamp(n.fu_closed_at)} par {n.fu_closed_by_name}.
                </p>
              )}
              <div>
                <Button variant="outline">Enregistrer le suivi</Button>
              </div>
            </FieldSet>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
function EmptyBlock({ title, children }: { title: string; children: Child }) {
  return (
    <Empty class="p-6 md:p-8">
      <EmptyHeader>
        <EmptyTitle class="text-2xl">{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function Detail({
  actor,
  row,
  notes,
  documents,
  history,
  notePage,
  docPage,
  notice,
}: {
  actor: Actor;
  row: RecordRow;
  notes: { rows: NoteRow[]; total: number };
  documents: { rows: DocumentSummary[]; total: number };
  history?: HistoryPage;
  notePage: number;
  docPage: number;
  notice?: string;
}) {
  const base = "/dossiers/" + row.id;
  return (
    <Layout title="Fiche du dossier" actor={actor}>
      <BackLink href="/dossiers">Retour aux dossiers</BackLink>
      <AccessStatus />
      <div data-case-id={row.id}>
        <PageHeading title={row.name} description={<span class="tabular-nums">Dossier {row.id.slice(0, 8).toUpperCase()}</span>}>
          <Badge variant={row.status === "Inactif" ? "secondary" : "success"} class="px-4 py-1 text-sm">
            {row.status}
          </Badge>
        </PageHeading>
        {notice && <Notice message={notice} />}
        <div class="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader class="flex items-start justify-between gap-3">
              <CardTitle>Renseignements de l’usager</CardTitle>
              <LinkButton variant="outline" size="sm" href={base + "/modifier"}>
                <Icon name="pencil" />
                Modifier
              </LinkButton>
            </CardHeader>
            <CardContent>
              <DefList>
                <DefItem term="Courriel">{row.email || "Non renseigné"}</DefItem>
                <DefItem term="Téléphone">{row.phone || "Non renseigné"}</DefItem>
                <DefItem term="Adresse">{row.address || "Non renseignée"}</DefItem>
                <DefItem term="Date de naissance">{row.date_of_birth ? birthDay(row.date_of_birth) : "Non renseignée"}</DefItem>
              </DefList>
            </CardContent>
          </Card>
          <Card class="bg-lavender/40">
            <CardHeader>
              <CardTitle>Suivi et attribution</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-1 flex-col justify-between gap-6">
              <DefList>
                <DefItem term="Responsable">{row.owner_name}</DefItem>
                <DefItem term="Ouvert le">{day(row.opened_at)}</DefItem>
              </DefList>
              <div class="flex flex-wrap items-center gap-3">
                <LinkButton variant="outline" href={base + "/transfert"}>
                  <Icon name="arrow-right-left" />
                  Transférer le dossier
                </LinkButton>
                <form method="post" action={base + "/statut"}>
                  <input type="hidden" name="version" value={row.version} />
                  <input type="hidden" name="status" value={row.status === "Actif" ? "Inactif" : "Actif"} />
                  <Button variant="outline">{row.status === "Actif" ? "Rendre inactif" : "Réactiver"}</Button>
                </form>
              </div>
              {row.status === "Inactif" && (
                <p class="text-sm text-muted-foreground">
                  Ce dossier est inactif : son contenu, son responsable et les accès sont inchangés.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <section class="mt-14" aria-labelledby="notes-title">
          <SectionHeading id="notes-title" title="Notes">
            <LinkButton href={base + "/notes/nouvelle"}>
              <Icon name="plus" />
              Ajouter une note
            </LinkButton>
          </SectionHeading>
          {notes.rows.length ? (
            <div class="flex flex-col gap-4">
              {notes.rows.map((n) => (
                <NoteItem n={n} caseId={row.id} />
              ))}
            </div>
          ) : (
            <EmptyBlock title="Aucune note pour l’instant">Consignez la prochaine interaction pour garder le fil du suivi.</EmptyBlock>
          )}
          <p class={"mt-4 " + metaText}>Une note enregistrée ne peut pas être modifiée : ajoutez une nouvelle note pour la compléter ou la corriger.</p>
          <Pager base={base} param="np" page={notePage} total={notes.total} extra={docPage > 1 ? "&dp=" + docPage : ""} />
        </section>
        <section class="mt-14" aria-labelledby="docs-title">
          <SectionHeading id="docs-title" title="Documents">
            <LinkButton variant="outline" href={base + "/documents/nouveau"}>
              <Icon name="file-text" />
              Ajouter un document
            </LinkButton>
          </SectionHeading>
          {documents.rows.length ? (
            <div class="flex flex-col gap-3">
              {documents.rows.map((d) => (
                <article class={rowCard + " grid gap-2 md:grid-cols-3 md:items-center md:gap-5"}>
                  <div class="min-w-0">
                    <a class={recordLink} href={`${base}/documents/${d.id}`}>
                      {d.template_title}
                    </a>
                    <span class="block text-xs tracking-wider text-muted-foreground">Version {d.template_version} du modèle</span>
                  </div>
                  <div class="text-sm">
                    <span class="mr-2 text-muted-foreground md:block">Créé par</span>
                    {d.created_by_name} · {stamp(d.created_at)}
                  </div>
                  <div class="text-sm">
                    <span class="mr-2 text-muted-foreground md:block">Dernière modification</span>
                    {stamp(d.updated_at)}
                    {d.version > 1 ? " par " + d.updated_by_name : ""}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyBlock title="Aucun document">Les documents remplis à partir des modèles de votre organisme apparaîtront ici.</EmptyBlock>
          )}
          <Pager base={base} param="dp" page={docPage} total={documents.total} extra={notePage > 1 ? "&np=" + notePage : ""} />
        </section>
        {history && <HistorySection caseId={row.id} history={history} />}
      </div>
    </Layout>
  );
}
export type NoteFormProps = {
  actor: Actor;
  row: RecordRow;
  values?: Record<string, string>;
  errors?: Errors;
  error?: string;
  offsets?: number[];
};
export function NoteForm({ actor, row, values = {}, errors = {}, error, offsets = [] }: NoteFormProps) {
  const offsetLabel = (m: number) => `UTC${m < 0 ? "−" : "+"}${String(Math.floor(Math.abs(m) / 60)).padStart(2, "0")}:${String(Math.abs(m) % 60).padStart(2, "0")}`;
  return (
    <Layout title="Ajouter une note" actor={actor}>
      <BackLink href={"/dossiers/" + row.id}>Retour au dossier</BackLink>
      <AccessStatus />
      <div data-case-id={row.id}>
        <PageHeading title="Ajouter une note" description={row.name} />
        {error && <Notice message={error} error />}
        <FormCard method="post" action={`/dossiers/${row.id}/notes`} novalidate>
          <p class={metaText}>Les champs marqués d’un astérisque (*) sont obligatoires. Une note enregistrée ne peut plus être modifiée.</p>
          <FieldSet>
            <FieldLegend>Interaction</FieldLegend>
            <TextField name="nature" label="Nature de l’interaction" required maxlength={limits.nature} value={values.nature} errors={errors} help="Ex. : rencontre, appel téléphonique, accompagnement." />
            <div class="grid gap-6 md:grid-cols-2">
              <TextField name="date" label="Date de l’interaction" type="date" required value={values.date} errors={errors} />
              <TextField name="time" label="Heure" type="time" required value={values.time} errors={errors} />
            </div>
            <TextField name="tz" label="Fuseau horaire" required list="zones" maxlength={64} value={values.tz || defaultZone} errors={errors} help="Proposé selon votre navigateur; modifiable." />
            <datalist id="zones">
              {zones.map((z) => (
                <option value={z} />
              ))}
            </datalist>
            {(offsets.length > 1 || errors.offset) && (
              <Field data-invalid={errors.offset ? "true" : undefined}>
                <Label for="f-offset">Décalage horaire *</Label>
                <NativeSelect id="f-offset" name="offset" aria-invalid={errors.offset ? "true" : undefined} aria-describedby="e-offset">
                  <option value="auto">Choisir le décalage</option>
                  {offsets.map((o) => (
                    <option value={o} selected={values.offset === String(o)}>
                      {offsetLabel(o)}
                    </option>
                  ))}
                </NativeSelect>
                {errors.offset && <FieldError id="e-offset">{errors.offset}</FieldError>}
              </Field>
            )}
            <TextField name="participants" label="Personnes présentes" maxlength={limits.participants} value={values.participants} errors={errors} help="Noms ou descriptions libres, séparés par des virgules. Aucun accès n’est créé pour ces personnes." />
          </FieldSet>
          <FieldSet>
            <FieldLegend>Note</FieldLegend>
            <TextField name="body" label="Texte de la note" required textarea={8} maxlength={limits.note} value={values.body} errors={errors} />
          </FieldSet>
          <FieldSet>
            <FieldLegend>Suite à donner (facultatif)</FieldLegend>
            <TextField name="follow_description" label="Tâche" maxlength={limits.followUp} value={values.follow_description} errors={errors} help="Aucun rappel automatique n’est envoyé." />
            <TextField name="follow_due" label="Échéance" type="date" value={values.follow_due} errors={errors} />
          </FieldSet>
          <FormActions>
            <Button size="lg">Enregistrer la note</Button>
            <CancelLink href={"/dossiers/" + row.id} />
          </FormActions>
        </FormCard>
      </div>
    </Layout>
  );
}
export function DocumentChoice({ actor, row, templates }: { actor: Actor; row: RecordRow; templates: { id: string; title: string; version: number }[] }) {
  return (
    <Layout title="Ajouter un document" actor={actor}>
      <BackLink href={"/dossiers/" + row.id}>Retour au dossier</BackLink>
      <AccessStatus />
      <div data-case-id={row.id}>
        <PageHeading title="Ajouter un document" description={row.name} />
        {templates.length ? (
          <div class="flex flex-col gap-3">
            {templates.map((t) => (
              <article class={rowCard + " flex items-center justify-between gap-4"}>
                <a class={recordLink} href={`/dossiers/${row.id}/documents/nouveau/${t.id}?v=${t.version}`}>
                  {t.title}
                </a>
                <Icon name="chevron-right" class="size-5" />
              </article>
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Aucun modèle disponible</EmptyTitle>
              <EmptyDescription>Un superviseur doit créer un modèle de document avant que vous puissiez en remplir un.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </Layout>
  );
}
function AnswerInput({ f, value, errors }: { f: TemplateField; value?: string; errors: Errors }) {
  const name = answerKey(f.id);
  const err = errors[name];
  const common = {
    id: "f-" + f.id,
    name,
    required: f.required,
    autocomplete: "off",
    "aria-invalid": err ? "true" : undefined,
    "aria-describedby": [err ? "e-" + f.id : "", f.help ? "h-" + f.id : ""].filter(Boolean).join(" ") || undefined,
  };
  return (
    <Field data-invalid={err ? "true" : undefined}>
      <Label for={"f-" + f.id}>
        {f.label}
        {f.required ? " *" : " (facultatif)"}
      </Label>
      {f.help && <FieldDescription id={"h-" + f.id}>{f.help}</FieldDescription>}
      {f.type === "textarea" ? (
        <Textarea {...common} rows={6} maxlength={limits.longAnswer}>
          {value ?? ""}
        </Textarea>
      ) : f.type === "choice" ? (
        <NativeSelect {...common}>
          <option value="">Choisir</option>
          {f.options?.map((o) => (
            <option value={o.id} selected={value === o.id}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Input {...common} type={f.type === "date" ? "date" : "text"} inputmode={f.type === "number" ? "decimal" : undefined} maxlength={f.type === "text" ? limits.shortAnswer : undefined} value={value ?? ""} />
      )}
      {err && <FieldError id={"e-" + f.id}>{err}</FieldError>}
    </Field>
  );
}
export function DocumentForm({
  actor,
  row,
  template,
  values = {},
  errors = {},
  error,
  document,
}: {
  actor: Actor;
  row: RecordRow;
  template: { id: string; title: string; version: number; fields: TemplateField[] };
  values?: Record<string, string>;
  errors?: Errors;
  error?: string;
  document?: { id: string; version: number };
}) {
  const action = document ? `/dossiers/${row.id}/documents/${document.id}` : `/dossiers/${row.id}/documents`;
  const back = document ? `/dossiers/${row.id}/documents/${document.id}` : "/dossiers/" + row.id;
  return (
    <Layout title={document ? "Modifier le document" : "Ajouter un document"} actor={actor}>
      <BackLink href={back}>Retour</BackLink>
      <AccessStatus />
      <div data-case-id={row.id}>
        <PageHeading title={template.title} description={`${row.name} · version ${template.version} du modèle`} />
        {error && <Notice message={error} error />}
        <FormCard method="post" action={action} novalidate>
          {document ? (
            <input type="hidden" name="version" value={document.version} />
          ) : (
            <>
              <input type="hidden" name="template_id" value={template.id} />
              <input type="hidden" name="template_version" value={template.version} />
            </>
          )}
          <p class={metaText}>Les champs marqués d’un astérisque (*) sont obligatoires. Aucun score ni conclusion n’est calculé à partir des réponses.</p>
          <FieldSet>
            {template.fields.map((f) => (
              <AnswerInput f={f} value={values[answerKey(f.id)]} errors={errors} />
            ))}
          </FieldSet>
          <FormActions>
            <Button size="lg">Enregistrer le document</Button>
            <CancelLink href={back} />
          </FormActions>
        </FormCard>
      </div>
    </Layout>
  );
}
export function DocumentDetail({ actor, row, doc, notice }: { actor: Actor; row: RecordRow; doc: DocumentRow; notice?: string }) {
  const shown = (f: TemplateField) => {
    const v = doc.answers[f.id];
    if (v === undefined || v === "") return "Non renseigné";
    if (f.type === "choice") return f.options?.find((o) => o.id === v)?.label ?? "Choix indisponible";
    return String(v);
  };
  return (
    <Layout title={doc.template_title} actor={actor}>
      <BackLink href={"/dossiers/" + row.id}>Retour au dossier</BackLink>
      <AccessStatus />
      <div data-case-id={row.id}>
        <PageHeading
          title={doc.template_title}
          description={`${row.name} · version ${doc.template_version} du modèle${doc.template_status === "retired" ? " (modèle retiré des nouveaux usages)" : ""}`}
        >
          <LinkButton variant="outline" href={`/dossiers/${row.id}/documents/${doc.id}/modifier`}>
            Modifier les réponses
          </LinkButton>
        </PageHeading>
        {notice && <Notice message={notice} />}
        <Card class="max-w-3xl">
          <CardContent class="flex flex-col gap-6">
            <DefList>
              {doc.fields.map((f) => (
                <div>
                  <dt class="text-sm font-medium text-muted-foreground">{f.label}</dt>
                  <dd class="text-lg leading-relaxed whitespace-pre-wrap break-words">{shown(f)}</dd>
                </div>
              ))}
            </DefList>
            <p class={metaText}>
              Créé par {doc.created_by_name} le {stamp(doc.created_at)}.
              {doc.version > 1 ? ` Dernière modification par ${doc.updated_by_name} le ${stamp(doc.updated_at)}.` : ""}
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
// ---- Modèles (superviseurs) ----
export function TemplateList({ actor, templates, notice }: { actor: Actor; templates: Omit<TemplateRow, "fields">[]; notice?: string }) {
  return (
    <Layout title="Modèles de documents" actor={actor} section="modeles">
      <div data-requires-supervisor>
        <AccessStatus />
        <PageHeading
          title="Modèles de documents"
          description="Définissez les formulaires que les intervenants peuvent remplir dans un dossier. Le contenu est défini par votre organisme."
        >
          <LinkButton size="lg" href="/modeles/nouveau">
            <Icon name="plus" />
            Nouveau modèle
          </LinkButton>
        </PageHeading>
        {notice && <Notice message={notice} />}
        {templates.length ? (
          <div class="flex flex-col gap-3">
            {templates.map((t) => (
              <article class={rowCard + " flex flex-wrap items-center justify-between gap-3"}>
                <div class="min-w-0">
                  <a class={recordLink} href={"/modeles/" + t.id}>
                    {t.title}
                  </a>
                  <span class="block text-xs tracking-wider text-muted-foreground">Version {t.current_version}</span>
                </div>
                <Badge variant={t.status === "available" ? "success" : "secondary"}>{t.status === "available" ? "Disponible" : "Retiré"}</Badge>
              </article>
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Aucun modèle</EmptyTitle>
              <EmptyDescription>Créez un premier modèle, par exemple « Demande de financement ».</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </Layout>
  );
}
export function TemplateBuilder({
  actor,
  title = "",
  fields,
  template,
  errors = {},
  error,
}: {
  actor: Actor;
  title?: string;
  fields: DraftField[];
  template?: { id: string; version: number; status: "available" | "retired" };
  errors?: Errors;
  error?: string;
}) {
  const retired = template?.status === "retired";
  return (
    <Layout title={template ? "Modifier le modèle" : "Nouveau modèle"} actor={actor} section="modeles">
      <div data-requires-supervisor>
        <BackLink href="/modeles">Retour aux modèles</BackLink>
        <AccessStatus />
        <PageHeading
          title={template ? "Modifier le modèle" : "Nouveau modèle"}
          description={
            template
              ? `Version actuelle : ${template.version}. Enregistrer crée une nouvelle version; les documents existants gardent la leur.`
              : "Un titre et une liste ordonnée de champs."
          }
        />
        {error && <Notice message={error} error />}
        {retired && <Notice message="Ce modèle est retiré des nouveaux usages et ne peut plus évoluer." />}
        <FormCard method="post" action="/modeles" novalidate>
          <button class="sr-only" name="op" value="save" tabindex={-1} aria-hidden="true">
            Enregistrer
          </button>
          {template && (
            <>
              <input type="hidden" name="template_id" value={template.id} />
              <input type="hidden" name="version" value={template.version} />
            </>
          )}
          <TextField name="title" label="Titre du modèle" required maxlength={limits.title} value={title} errors={errors} />
          {errors.fields && <FieldError id="e-fields">{errors.fields}</FieldError>}
          <FieldSet>
            <FieldLegend>Champs</FieldLegend>
            <ol class="flex flex-col gap-4">
              {fields.map((f, i) => {
                const n = (k: string) => `f.${i}.${k}`;
                return (
                  <li class="flex flex-col gap-5 rounded-xl border-2 border-sand bg-background p-4 md:p-5">
                    <h3 class="text-lg font-semibold">Champ {i + 1}</h3>
                    <input type="hidden" name={n("id")} value={f.id} />
                    <TextField name={n("label")} label="Libellé" required maxlength={limits.label} value={f.label} errors={errors} />
                    <div class="grid items-end gap-5 md:grid-cols-2">
                      <Field>
                        <Label for={"f-" + n("type")}>Type</Label>
                        <NativeSelect id={"f-" + n("type")} name={n("type")}>
                          {fieldTypes.map((t) => (
                            <option value={t.value} selected={f.type === t.value}>
                              {t.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Label for={"f-" + n("required")} class="min-h-12 cursor-pointer">
                        <Checkbox id={"f-" + n("required")} name={n("required")} value="1" checked={f.required} /> Réponse obligatoire
                      </Label>
                    </div>
                    <TextField name={n("help")} label="Instruction (facultatif)" maxlength={limits.instruction} value={f.help} errors={errors} />
                    {f.type === "choice" && <TextField name={n("options")} label="Choix proposés" textarea={4} value={f.options} errors={errors} help="Un choix par ligne." />}
                    <div class="flex flex-wrap gap-2" role="group" aria-label={`Actions pour le champ ${i + 1}`}>
                      <Button variant="outline" size="sm" name="op" value={`up:${i}`} disabled={i === 0}>
                        <Icon name="arrow-up" />
                        Monter
                      </Button>
                      <Button variant="outline" size="sm" name="op" value={`down:${i}`} disabled={i === fields.length - 1}>
                        <Icon name="arrow-down" />
                        Descendre
                      </Button>
                      <Button variant="ghost" size="sm" name="op" value={`remove:${i}`}>
                        <Icon name="x" />
                        Retirer
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div class="flex flex-col items-start gap-3">
              <Button variant="outline" name="op" value="add" disabled={fields.length >= limits.fields}>
                <Icon name="plus" />
                Ajouter un champ
              </Button>
              <p class={metaText}>Au plus {limits.fields} champs. Les choix et libellés s’affichent tels quels, sans formatage.</p>
            </div>
          </FieldSet>
          <FormActions>
            <Button size="lg" name="op" value="save" disabled={retired}>
              Enregistrer le modèle
            </Button>
            <CancelLink href="/modeles" />
          </FormActions>
        </FormCard>
        {template && !retired && (
          <FormCard method="post" action={`/modeles/${template.id}/retrait`} class="mt-8 border-destructive/40">
            <input type="hidden" name="version" value={template.version} />
            <div class="flex flex-col gap-2">
              <h2 class="text-3xl tracking-[-0.03em]">Retirer ce modèle</h2>
              <p class="text-base text-muted-foreground">Le modèle n’apparaîtra plus pour les nouveaux documents. Les documents existants restent consultables et modifiables.</p>
            </div>
            <div>
              <Button variant="outline">Retirer le modèle</Button>
            </div>
          </FormCard>
        )}
      </div>
    </Layout>
  );
}
export type { Child };
