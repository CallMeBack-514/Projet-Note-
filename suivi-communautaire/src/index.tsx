import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { auth, authenticate, type Actor } from "./auth";
import { Problem, FieldProblem, missing } from "./access";
import {
  record,
  resolveCase,
  listing,
  destinations,
  createRecord,
  transfer,
  accessCheck,
  setStatus,
  updateClientDetails,
  parseFilter,
} from "./records";
import {
  auditRead,
  canViewAudit,
  parseAuditFilters,
  recordDenial,
  viewAudit,
  type RouteCode,
} from "./audit";
import { limits } from "./limits";
import { createNote, listNotes, updateFollowUp } from "./notes";
import { ambiguousOffsets } from "./time";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  retireTemplate,
  readDraft,
  applyOperation,
  newDraftField,
  draftFrom,
} from "./document-templates";
import {
  createDocument,
  documentDefinition,
  getDocument,
  listDocuments,
  updateDocument,
} from "./documents";
import {
  Layout,
  Login,
  List,
  NewRecord,
  EditRecord,
  Transfer,
  Notice,
} from "./views";
import { AuditPageView } from "./views-audit";
import { HistoryPageView } from "./views-history";
import { caseHistory } from "./case-history";
import {
  Detail,
  NoteForm,
  DocumentChoice,
  DocumentForm,
  DocumentDetail,
  TemplateList,
  TemplateBuilder,
} from "./views-content";
const app = new Hono<{ Bindings: Env; Variables: { actor: Actor } }>();
app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store, private, max-age=0");
  c.header("Pragma", "no-cache");
  c.header("Referrer-Policy", "strict-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
  );
  await next();
});
// Limites par parcours : 16 Kio pour l'authentification et les opérations existantes, 256 Kio pour
// les notes, documents et modèles. Les dépassements retournent 413 sans écho du contenu.
const contentPath = /^\/(dossiers\/[^/]+\/(notes|documents)(\/|$)|modeles(\/|$))/;
app.use("*", (c, next) =>
  bodyLimit({
    maxSize: contentPath.test(c.req.path) ? limits.contentBody : limits.authBody,
    onError: (c) => c.text("Formulaire trop volumineux.", 413),
  })(c, next),
);
app.use("*", async (c, next) => {
  if (c.req.method === "POST" && !c.req.path.startsWith("/api/auth/")) {
    if (c.req.header("Origin") !== new URL(c.env.APP_ORIGIN).origin)
      return c.text("Origine non autorisée.", 403);
    if (
      !c.req
        .header("Content-Type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return c.text("Format non autorisé.", 415);
  }
  await next();
});
const strings = (raw: Record<string, unknown>) => {
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string") throw new Problem(400, "Formulaire invalide.");
    values[k] = v;
  }
  return values;
};
const pageOf = (value: string | undefined) => {
  const p = Number(value ?? 1);
  return Number.isSafeInteger(p) && p > 0 && p < 100000 ? p : 1;
};
const supervisorOnly = (actor: Actor) => {
  if (actor.role !== "superviseur")
    throw new Problem(403, "Cette page est réservée aux superviseurs.");
};
app.get("/health", (c) => c.json({ status: "ok" }));
app.on(["GET", "POST"], "/api/auth/*", (c) => auth(c.env).handler(c.req.raw));
app.get("/", (c) => c.redirect("/dossiers"));
app.get("/connexion", async (c) => {
  if (await authenticate(c.env, c.req.raw.headers))
    return c.redirect("/dossiers");
  return c.html(<Login />);
});
app.post("/connexion", async (c) => {
  const data = await c.req.parseBody();
  let response: Response;
  try {
    response = await auth(c.env).api.signInEmail({
      body: {
        email: String(data.email || ""),
        password: String(data.password || ""),
      },
      headers: c.req.raw.headers,
      asResponse: true,
    });
  } catch {
    return c.html(
      <Login error="Connexion impossible. Vérifiez votre courriel et votre mot de passe." />,
      401,
    );
  }
  if (!response.ok)
    return c.html(
      <Login error="Connexion impossible. Vérifiez votre courriel et votre mot de passe." />,
      401,
    );
  for (const value of response.headers.getSetCookie())
    c.header("Set-Cookie", value, { append: true });
  return c.redirect("/dossiers", 303);
});
app.post("/deconnexion", async (c) => {
  const response = await auth(c.env).api.signOut({
    headers: c.req.raw.headers,
    asResponse: true,
  });
  for (const value of response.headers.getSetCookie())
    c.header("Set-Cookie", value, { append: true });
  return c.redirect("/connexion", 303);
});
const requireActor = async (c: any, next: () => Promise<void>) => {
  const actor = await authenticate(c.env, c.req.raw.headers);
  if (!actor) return c.redirect("/connexion");
  c.set("actor", actor);
  await next();
};
app.use("/dossiers", requireActor);
app.use("/dossiers/*", requireActor);
app.use("/modeles", requireActor);
app.use("/modeles/*", requireActor);
app.post("/acces", async (c) => {
  const actor = await authenticate(c.env, c.req.raw.headers);
  if (!actor) return c.json({ allowed: [] }, 401);
  const data = await c.req.parseBody({ all: true });
  const ids = data["ids[]"];
  if (
    ids !== undefined &&
    !(Array.isArray(ids) ? ids : [ids]).every(
      (i) => typeof i === "string" && i.length <= 100,
    )
  )
    throw new Problem(400, "Identifiants invalides.");
  return c.json({
    supervisor: actor.role === "superviseur",
    allowed: await accessCheck(
      c.env.DB,
      actor,
      ids === undefined ? [] : ((Array.isArray(ids) ? ids : [ids]) as string[]),
    ),
  });
});
// ---- Journal des accès (permission audit:view) ----
app.get("/audit", requireActor, async (c) => {
  const actor = c.get("actor");
  const q = c.req.query();
  const filters = parseAuditFilters(q);
  const page = await viewAudit(c.env.DB, actor, c.env.AUTH_SECRET, filters, q.curseur || undefined);
  const params = new URLSearchParams();
  for (const [k, v] of [["dossier", filters.case], ["acteur", filters.actor], ["action", filters.action], ["du", filters.from], ["au", filters.to]])
    if (v) params.set(k, v);
  return c.html(<AuditPageView actor={actor} page={page} filters={filters} query={params.toString()} />);
});
// Contrôle périodique : seulement un booléen, aucune donnée du journal ni événement.
app.post("/audit/acces", async (c) => {
  const actor = await authenticate(c.env, c.req.raw.headers);
  if (!actor) return c.json({ allowed: false }, 401);
  const data = await c.req.parseBody();
  const org = typeof data.organisation === "string" ? data.organisation.slice(0, 100) : "";
  return c.json({ allowed: org === actor.organisation_id && (await canViewAudit(c.env.DB, actor, org)) });
});
app.get("/dossiers", async (c) => {
  const actor = c.get("actor");
  const query = (c.req.query("q") ?? "").slice(0, 160);
  const page = pageOf(c.req.query("page"));
  const filter = parseFilter(c.req.query("statut"));
  const result = await listing(c.env.DB, actor, query, page, filter);
  await auditRead(
    c.env.DB,
    actor,
    result.rows.map((r) => r.id),
  );
  return c.html(
    <List
      actor={actor}
      {...result}
      query={query}
      page={page}
      filter={filter}
      transferred={c.req.query("transfert") === "ok"}
    />,
  );
});
app.get("/dossiers/nouveau", async (c) => {
  const actor = c.get("actor");
  // Ancienne route « autre dossier pour cet usager » : conduit au dossier existant, sans rien créer.
  const source = c.req.query("source");
  if (source) {
    const row = await resolveCase(c.env.DB, actor, source);
    return c.redirect("/dossiers/" + row.id, 303);
  }
  return c.html(
    <NewRecord actor={actor} choices={await destinations(c.env.DB, actor)} />,
  );
});
app.post("/dossiers", async (c) => {
  const actor = c.get("actor");
  const values = strings(await c.req.parseBody());
  try {
    const id = await createRecord(c.env.DB, actor, values);
    return c.redirect("/dossiers/" + id, 303);
  } catch (e) {
    if (e instanceof Problem && e.status === 400)
      return c.html(
        <NewRecord
          actor={actor}
          choices={await destinations(c.env.DB, actor)}
          values={values}
          error={e.message}
        />,
        400,
      );
    throw e;
  }
});
app.get("/dossiers/:id/transfert", async (c) => {
  const actor = c.get("actor"),
    row = await record(c.env.DB, actor, c.req.param("id"));
  await auditRead(c.env.DB, actor, [row.id]);
  return c.html(
    <Transfer
      actor={actor}
      row={row}
      choices={await destinations(c.env.DB, actor, row.owner_id)}
    />,
  );
});
app.post("/dossiers/:id/transfert", async (c) => {
  const actor = c.get("actor"),
    id = c.req.param("id"),
    data = await c.req.parseBody();
  try {
    await transfer(
      c.env.DB,
      actor,
      id,
      String(data.owner_id || ""),
      Number(data.version),
    );
    return c.redirect(
      actor.role === "intervenant"
        ? "/dossiers?transfert=ok"
        : "/dossiers/" + id,
      303,
    );
  } catch (e) {
    if (e instanceof Problem && (e.status === 400 || e.status === 409)) {
      const row = await record(c.env.DB, actor, id);
      await auditRead(c.env.DB, actor, [id]);
      return c.html(
        <Transfer
          actor={actor}
          row={row}
          choices={await destinations(c.env.DB, actor, row.owner_id)}
          error={e.message}
        />,
        e.status,
      );
    }
    throw e;
  }
});
app.get("/dossiers/:id/modifier", async (c) => {
  const actor = c.get("actor"),
    row = await record(c.env.DB, actor, c.req.param("id"));
  await auditRead(c.env.DB, actor, [row.id]);
  return c.html(<EditRecord actor={actor} row={row} />);
});
app.post("/dossiers/:id/modifier", async (c) => {
  const actor = c.get("actor"),
    id = c.req.param("id"),
    values = strings(await c.req.parseBody());
  try {
    await updateClientDetails(c.env.DB, actor, id, values);
    return c.redirect("/dossiers/" + id + "?ok=infos", 303);
  } catch (e) {
    if (e instanceof FieldProblem) {
      const row = await record(c.env.DB, actor, id);
      await auditRead(c.env.DB, actor, [id]);
      return c.html(<EditRecord actor={actor} row={row} values={values} errors={e.fields} error={e.message} />, 400);
    }
    throw e;
  }
});
app.post("/dossiers/:id/statut", async (c) => {
  const actor = c.get("actor"),
    id = c.req.param("id"),
    data = strings(await c.req.parseBody());
  await setStatus(c.env.DB, actor, id, data.status ?? "", Number(data.version));
  return c.redirect("/dossiers/" + id + "?ok=statut", 303);
});
// ---- Notes et suivis ----
app.get("/dossiers/:id/notes/nouvelle", async (c) => {
  const actor = c.get("actor"),
    row = await record(c.env.DB, actor, c.req.param("id"));
  await auditRead(c.env.DB, actor, [row.id]);
  return c.html(<NoteForm actor={actor} row={row} />);
});
app.post("/dossiers/:id/notes", async (c) => {
  const actor = c.get("actor"),
    id = c.req.param("id"),
    values = strings(await c.req.parseBody());
  try {
    await createNote(c.env.DB, actor, id, values);
    return c.redirect("/dossiers/" + id + "?ok=note", 303);
  } catch (e) {
    if (e instanceof FieldProblem) {
      // Les valeurs ne sont réaffichées qu'après revérification de l'accès courant.
      const row = await record(c.env.DB, actor, id);
      await auditRead(c.env.DB, actor, [id]);
      const offsets = e.fields.offset
        ? ambiguousOffsets(values.date ?? "", values.time ?? "", values.tz || "America/Toronto")
        : [];
      return c.html(
        <NoteForm
          actor={actor}
          row={row}
          values={values}
          errors={e.fields}
          error={e.message}
          offsets={offsets}
        />,
        400,
      );
    }
    throw e;
  }
});
app.post("/dossiers/:id/notes/:note/suivi", async (c) => {
  const actor = c.get("actor"),
    id = c.req.param("id");
  await updateFollowUp(
    c.env.DB,
    actor,
    id,
    c.req.param("note"),
    strings(await c.req.parseBody()),
  );
  return c.redirect("/dossiers/" + id + "?ok=suivi", 303);
});
// ---- Documents ----
app.get("/dossiers/:id/documents/nouveau", async (c) => {
  const actor = c.get("actor"),
    row = await record(c.env.DB, actor, c.req.param("id"));
  await auditRead(c.env.DB, actor, [row.id]);
  const templates = (await listTemplates(c.env.DB, actor)).filter(
    (t) => t.status === "available",
  );
  return c.html(
    <DocumentChoice
      actor={actor}
      row={row}
      templates={templates.map((t) => ({ id: t.id, title: t.title, version: t.version }))}
    />,
  );
});
const availableTemplate = async (c: any, actor: Actor, id: string, version?: number) => {
  const t = await getTemplate(c.env.DB, actor, id, version);
  if (t.status !== "available")
    throw new Problem(409, "Ce modèle n’est plus disponible. Choisissez un modèle disponible.");
  return t;
};
app.get("/dossiers/:id/documents/nouveau/:template", async (c) => {
  const actor = c.get("actor"),
    row = await record(c.env.DB, actor, c.req.param("id"));
  const version = Number(c.req.query("v"));
  const template = await availableTemplate(c, actor, c.req.param("template"), Number.isInteger(version) && version > 0 ? version : undefined);
  await auditRead(c.env.DB, actor, [row.id]);
  return c.html(
    <DocumentForm
      actor={actor}
      row={row}
      template={{ id: template.id, title: template.title, version: template.version, fields: template.fields }}
    />,
  );
});
app.post("/dossiers/:id/documents", async (c) => {
  const actor = c.get("actor"),
    id = c.req.param("id"),
    values = strings(await c.req.parseBody());
  const version = Number(values.template_version);
  try {
    const docId = await createDocument(c.env.DB, actor, id, values.template_id ?? "", version, values);
    return c.redirect(`/dossiers/${id}/documents/${docId}?ok=creation`, 303);
  } catch (e) {
    if (e instanceof FieldProblem) {
      const row = await record(c.env.DB, actor, id);
      const template = await availableTemplate(c, actor, values.template_id ?? "", version);
      await auditRead(c.env.DB, actor, [id]);
      return c.html(
        <DocumentForm
          actor={actor}
          row={row}
          template={{ id: template.id, title: template.title, version: template.version, fields: template.fields }}
          values={values}
          errors={e.fields}
          error={e.message}
        />,
        400,
      );
    }
    throw e;
  }
});
app.get("/dossiers/:id/documents/:doc", async (c) => {
  const actor = c.get("actor"),
    id = c.req.param("id");
  const row = await record(c.env.DB, actor, id);
  const doc = await getDocument(c.env.DB, actor, id, c.req.param("doc"));
  await auditRead(c.env.DB, actor, [id]);
  const ok = c.req.query("ok");
  return c.html(
    <DocumentDetail
      actor={actor}
      row={row}
      doc={doc}
      notice={
        ok === "creation"
          ? "Le document a été enregistré."
          : ok === "modification"
            ? "Les réponses ont été enregistrées."
            : undefined
      }
    />,
  );
});
app.get("/dossiers/:id/documents/:doc/modifier", async (c) => {
  const actor = c.get("actor"),
    id = c.req.param("id");
  const row = await record(c.env.DB, actor, id);
  const doc = await getDocument(c.env.DB, actor, id, c.req.param("doc"));
  await auditRead(c.env.DB, actor, [id]);
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(doc.answers)) values["a." + k] = String(v);
  return c.html(
    <DocumentForm
      actor={actor}
      row={row}
      template={{ id: doc.template_id, title: doc.template_title, version: doc.template_version, fields: doc.fields }}
      values={values}
      document={{ id: doc.id, version: doc.version }}
    />,
  );
});
app.post("/dossiers/:id/documents/:doc", async (c) => {
  const actor = c.get("actor"),
    id = c.req.param("id"),
    docId = c.req.param("doc"),
    values = strings(await c.req.parseBody());
  try {
    await updateDocument(c.env.DB, actor, id, docId, Number(values.version), values);
    return c.redirect(`/dossiers/${id}/documents/${docId}?ok=modification`, 303);
  } catch (e) {
    if (e instanceof FieldProblem) {
      const row = await record(c.env.DB, actor, id);
      const def = await documentDefinition(c.env.DB, actor, id, docId);
      await auditRead(c.env.DB, actor, [id]);
      return c.html(
        <DocumentForm
          actor={actor}
          row={row}
          template={{ id: def.id, title: def.title, version: def.version, fields: def.fields }}
          values={values}
          errors={e.fields}
          error={e.message}
          document={{ id: docId, version: Number(values.version) || def.document_version }}
        />,
        400,
      );
    }
    throw e;
  }
});
// Chronologie : pages suivantes; lecture du dossier tracée dans le même batch que la sélection.
app.get("/dossiers/:id/historique", async (c) => {
  const actor = c.get("actor");
  const history = await caseHistory(c.env.DB, actor, c.env.AUTH_SECRET, c.req.param("id"), {
    cursor: c.req.query("curseur") || undefined,
    trace: true,
  });
  const row = await record(c.env.DB, actor, history.caseId);
  return c.html(<HistoryPageView actor={actor} row={row} history={history} />);
});
app.get("/dossiers/:id", async (c) => {
  const actor = c.get("actor"),
    row = await resolveCase(c.env.DB, actor, c.req.param("id"));
  if (row.id !== c.req.param("id")) return c.redirect("/dossiers/" + row.id, 303);
  await auditRead(c.env.DB, actor, [row.id]);
  const notePage = pageOf(c.req.query("np")),
    docPage = pageOf(c.req.query("dp"));
  const notes = await listNotes(c.env.DB, actor, row.id, notePage);
  const documents = await listDocuments(c.env.DB, actor, row.id, docPage);
  // La trace de lecture du dossier ci-dessus couvre aussi sa chronologie : pas de seconde trace.
  const history = await caseHistory(c.env.DB, actor, c.env.AUTH_SECRET, row.id, { trace: false });
  const ok = c.req.query("ok");
  return c.html(
    <Detail
      actor={actor}
      row={row}
      notes={notes}
      documents={documents}
      history={history}
      notePage={notePage}
      docPage={docPage}
      notice={
        ok === "note"
          ? "La note a été enregistrée."
          : ok === "suivi"
            ? "Le suivi a été enregistré."
            : ok === "infos"
              ? "Les renseignements de l’usager ont été mis à jour."
              : ok === "statut"
                ? `Le dossier est maintenant ${row.status === "Inactif" ? "inactif" : "actif"}.`
                : undefined
      }
    />,
  );
});
// ---- Modèles de documents (superviseurs) ----
app.get("/modeles", async (c) => {
  const actor = c.get("actor");
  supervisorOnly(actor);
  const ok = c.req.query("ok");
  return c.html(
    <TemplateList
      actor={actor}
      templates={await listTemplates(c.env.DB, actor)}
      notice={ok === "modele" ? "Le modèle a été enregistré." : ok === "retrait" ? "Le modèle a été retiré des nouveaux usages." : undefined}
    />,
  );
});
app.get("/modeles/nouveau", (c) => {
  const actor = c.get("actor");
  supervisorOnly(actor);
  return c.html(<TemplateBuilder actor={actor} fields={[newDraftField()]} />);
});
app.get("/modeles/:id", async (c) => {
  const actor = c.get("actor");
  supervisorOnly(actor);
  const t = await getTemplate(c.env.DB, actor, c.req.param("id"));
  return c.html(
    <TemplateBuilder
      actor={actor}
      title={t.title}
      fields={draftFrom(t.fields)}
      template={{ id: t.id, version: t.current_version, status: t.status }}
    />,
  );
});
app.post("/modeles", async (c) => {
  const actor = c.get("actor");
  supervisorOnly(actor);
  const values = strings(await c.req.parseBody());
  const op = values.op || "save";
  let fields = readDraft(values);
  const templateId = values.template_id || undefined;
  const current = templateId ? await getTemplate(c.env.DB, actor, templateId) : undefined;
  const meta = current
    ? { id: current.id, version: Number(values.version) || current.current_version, status: current.status }
    : undefined;
  if (op !== "save") {
    fields = applyOperation(fields, op);
    return c.html(<TemplateBuilder actor={actor} title={values.title ?? ""} fields={fields} template={meta} />);
  }
  try {
    if (templateId) await updateTemplate(c.env.DB, actor, templateId, Number(values.version), values.title ?? "", fields);
    else await createTemplate(c.env.DB, actor, values.title ?? "", fields);
    return c.redirect("/modeles?ok=modele", 303);
  } catch (e) {
    if (e instanceof FieldProblem)
      return c.html(
        <TemplateBuilder actor={actor} title={values.title ?? ""} fields={fields} template={meta} errors={e.fields} error={e.message} />,
        400,
      );
    throw e;
  }
});
app.post("/modeles/:id/retrait", async (c) => {
  const actor = c.get("actor");
  supervisorOnly(actor);
  const values = strings(await c.req.parseBody());
  await retireTemplate(c.env.DB, actor, c.req.param("id"), Number(values.version));
  return c.redirect("/modeles?ok=retrait", 303);
});
// Catégories fixes de refus; aucune cible, URL ni texte d'erreur n'est conservé.
function routeCode(method: string, path: string): RouteCode | null {
  if (path === "/audit") return "audit_read";
  if (path === "/acces" || path.startsWith("/audit/")) return null;
  const write = method !== "GET";
  if (/^\/modeles(\/|$)/.test(path) || /^\/dossiers\/[^/]+\/(notes|documents)(\/|$)/.test(path))
    return write ? "content_write" : "content_read";
  if (/^\/dossiers(\/|$)/.test(path)) return write ? "case_write" : "case_read";
  return null;
}
app.onError(async (e, c) => {
  const known = e instanceof Problem;
  // Un refus authentifié (403/404) est tracé une seule fois; les 400, 409 et le polling ne le sont pas.
  const actor = c.get("actor");
  const code = known && actor && (e.status === 403 || e.status === 404) ? routeCode(c.req.method, c.req.path) : null;
  if (code && actor) {
    try {
      await recordDenial(c.env.DB, actor, code);
    } catch {
      console.error("request_failed");
      return c.html(
        <Layout title="Opération impossible" actor={actor}>
          <h1>Opération impossible</h1>
          <Notice message="Le service est momentanément indisponible. Réessayez dans quelques instants." error />
          <a href="/dossiers">Revenir aux dossiers</a>
        </Layout>,
        503,
      );
    }
  }
  const message = known
    ? e.message
    : "Le service est momentanément indisponible. Réessayez dans quelques instants.";
  // No request body, search terms or personal fields are logged.
  if (!known) console.error("request_failed");
  return c.html(
    <Layout title="Opération impossible" actor={c.get("actor")}>
      <h1>Opération impossible</h1>
      <Notice message={message} error />
      {e instanceof FieldProblem && (
        <ul>
          {Object.values(e.fields).map((m) => (
            <li>{m}</li>
          ))}
        </ul>
      )}
      <a href="/dossiers">Revenir aux dossiers</a>
    </Layout>,
    known ? e.status : 503,
  );
});
export default app;
