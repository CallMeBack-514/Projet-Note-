import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { auth, authenticate, type Actor } from "./auth";
import {
  Problem,
  missing,
  record,
  listing,
  auditRead,
  destinations,
  createRecord,
  transfer,
  accessCheck,
} from "./records";
import {
  Layout,
  Login,
  List,
  Detail,
  NewRecord,
  Transfer,
  Notice,
} from "./views";
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
app.use(
  "*",
  bodyLimit({
    maxSize: 16 * 1024,
    onError: (c) => c.text("Formulaire trop volumineux.", 413),
  }),
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
app.use("/dossiers/*", async (c, next) => {
  const actor = await authenticate(c.env, c.req.raw.headers);
  if (!actor) return c.redirect("/connexion");
  c.set("actor", actor);
  await next();
});
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
    allowed: await accessCheck(
      c.env.DB,
      actor,
      ids === undefined ? [] : ((Array.isArray(ids) ? ids : [ids]) as string[]),
    ),
  });
});
app.get("/dossiers", async (c) => {
  const actor = c.get("actor");
  const query = (c.req.query("q") ?? "").slice(0, 160);
  const p = Number(c.req.query("page") ?? 1);
  const page = Number.isSafeInteger(p) && p > 0 && p < 100000 ? p : 1;
  const result = await listing(c.env.DB, actor, query, page);
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
      transferred={c.req.query("transfert") === "ok"}
    />,
  );
});
app.get("/dossiers/nouveau", async (c) => {
  const actor = c.get("actor");
  const source = c.req.query("source")
    ? await record(c.env.DB, actor, c.req.query("source")!)
    : undefined;
  if (source) await auditRead(c.env.DB, actor, [source.id]);
  return c.html(
    <NewRecord
      actor={actor}
      source={source}
      choices={await destinations(c.env.DB, actor)}
    />,
  );
});
app.post("/dossiers", async (c) => {
  const actor = c.get("actor");
  const raw = await c.req.parseBody();
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string") throw new Problem(400, "Formulaire invalide.");
    values[k] = v;
  }
  // A source is checked again at submission; a forged client_id cannot open a global person picker.
  const source = values.source
    ? await record(c.env.DB, actor, values.source)
    : undefined;
  if (values.client_id && (!source || source.client_id !== values.client_id))
    throw missing();
  try {
    const id = await createRecord(c.env.DB, actor, values);
    return c.redirect("/dossiers/" + id, 303);
  } catch (e) {
    if (e instanceof Problem && e.status === 400) {
      if (source) await auditRead(c.env.DB, actor, [source.id]);
      return c.html(
        <NewRecord
          actor={actor}
          choices={await destinations(c.env.DB, actor)}
          source={source}
          values={values}
          error={e.message}
        />,
        400,
      );
    }
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
app.get("/dossiers/:id", async (c) => {
  const actor = c.get("actor"),
    row = await record(c.env.DB, actor, c.req.param("id"));
  await auditRead(c.env.DB, actor, [row.id]);
  return c.html(<Detail actor={actor} row={row} />);
});
app.onError((e, c) => {
  const known = e instanceof Problem;
  const message = known
    ? e.message
    : "Le service est momentanément indisponible. Réessayez dans quelques instants.";
  // No request body, search terms or personal fields are logged.
  if (!known) console.error("request_failed");
  return c.html(
    <Layout title="Opération impossible" actor={c.get("actor")}>
      <h1>Opération impossible</h1>
      <Notice message={message} error />
      <a href="/dossiers">Revenir aux dossiers</a>
    </Layout>,
    known ? e.status : 503,
  );
});
export default app;
