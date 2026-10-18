import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import type { Actor } from "./auth";
import type { RecordRow } from "./records";
export function Layout({
  title,
  actor,
  children,
}: {
  title: string;
  actor?: Actor;
  children: Child;
}) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title} · Suivi communautaire</title>
          <link rel="stylesheet" href="/styles.css" />
          <script src="/app.js" defer />
        </head>
        <body>
          <a class="skip" href="#contenu">
            Aller au contenu
          </a>
          {actor ? (
            <div class="shell">
              <aside class="sidebar">
                <a class="brand" href="/dossiers">
                  <span class="brand-mark" aria-hidden="true">
                    <svg viewBox="0 0 32 32" width="32" height="32">
                      <path
                        d="M5 9h14v14H5zM13 5h14v14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                    </svg>
                  </span>
                  <span>
                    Suivi
                    <br />{" "}
                    communautaire
                  </span>
                </a>
                <div class="organisation">{actor.organisation_name}</div>
                <nav aria-label="Navigation principale">
                  <a class="nav-current" aria-current="page" href="/dossiers">
                    Dossiers
                  </a>
                </nav>
                <p class="sidebar-note">
                  Un espace commun.
                  <br />
                  Un suivi à la fois.
                </p>
                <div class="account">
                  <strong>{actor.name}</strong>
                  <span>
                    {actor.role === "superviseur"
                      ? "Superviseur"
                      : "Intervenant"}
                  </span>
                  <form method="post" action="/deconnexion">
                    <button class="logout">Se déconnecter</button>
                  </form>
                </div>
              </aside>
              <main id="contenu">{children}</main>
            </div>
          ) : (
            <main id="contenu" class="login-layout">
              <div class="login-intro">
                <span class="brand">Suivi communautaire</span>
                <h1>
                  Retrouver le fil
                  <br />
                  de chaque suivi.
                </h1>
                <p>
                  Votre espace de travail pour les dossiers et le relais entre
                  intervenants.
                </p>
              </div>
              <div class="login-form">{children}</div>
            </main>
          )}
        </body>
      </html>
    </>
  );
}
export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <div
      class={error ? "notice error" : "notice"}
      role={error ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
export function Login({ error }: { error?: string }) {
  return (
    <Layout title="Connexion">
      <h2>Connexion</h2>
      <p class="muted">Utilisez le compte fourni par votre organisme.</p>
      {error && <Notice message={error} error />}
      <form method="post" action="/connexion" class="form-stack">
        <label>
          Adresse courriel
          <input
            name="email"
            type="email"
            autocomplete="username"
            required
            maxlength={254}
          />
        </label>
        <label>
          Mot de passe
          <input
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        <button class="button primary">Se connecter</button>
      </form>
      <p class="help">
        Besoin d’un accès ? Contactez la personne responsable de votre
        organisme.
      </p>
    </Layout>
  );
}
export function AccessStatus() {
  return (
    <div id="access-status" class="notice" role="status" hidden>
      <span id="access-message" />
      <a href="/dossiers">Revenir aux dossiers</a>
    </div>
  );
}
export function List({
  actor,
  rows,
  total,
  query,
  page,
  transferred,
}: {
  actor: Actor;
  rows: RecordRow[];
  total: number;
  query: string;
  page: number;
  transferred: boolean;
}) {
  return (
    <Layout title="Dossiers" actor={actor}>
      <header class="page-heading">
        <div>
          <h1>
            {actor.role === "superviseur"
              ? "Dossiers de l’organisme"
              : "Mes dossiers"}
          </h1>
          <p>
            {actor.role === "superviseur"
              ? "Retrouvez les suivis de toutes les équipes."
              : "Retrouvez les suivis qui vous sont confiés."}
          </p>
        </div>
        <a class="button primary" href="/dossiers/nouveau">
          Nouveau dossier
        </a>
      </header>
      {transferred && (
        <Notice message="Le dossier a été transféré. Le nouvel intervenant en est maintenant responsable." />
      )}
      <AccessStatus />
      <section class="list-section" aria-label="Liste des dossiers">
        <form class="search" action="/dossiers" method="get">
          <label for="q">Rechercher un usager ou un numéro de dossier</label>
          <div class="search-controls">
            <input
              id="q"
              name="q"
              type="search"
              value={query}
              maxlength={160}
              placeholder="Nom ou numéro de dossier"
            />
            <button class="button secondary">Rechercher</button>
            {query && <a href="/dossiers">Effacer</a>}
          </div>
        </form>
        <div class="list-meta" data-private-count>
          {total} dossier{total !== 1 ? "s" : ""}
          {query ? " correspondant à votre recherche" : ""}
        </div>
        {rows.length ? (
          <div class="records">
            <div class="record-labels" aria-hidden="true">
              <span>Usager / dossier</span>
              <span>Service</span>
              <span>Responsable</span>
              <span>État</span>
            </div>
            {rows.map((row) => (
              <article class="record-row" data-case-id={row.id}>
                <div>
                  <a class="record-name" href={"/dossiers/" + row.id}>
                    {row.name}
                  </a>
                  <span class="reference">
                    {row.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div class="service">
                  <span class="mobile-label">Service</span>
                  {row.service}
                </div>
                <div>
                  <span class="mobile-label">Responsable</span>
                  {row.owner_name}
                </div>
                <span class="badge">Ouvert</span>
              </article>
            ))}
          </div>
        ) : (
          <div class="empty">
            <h2>{query ? "Aucun dossier trouvé" : "Votre liste est prête"}</h2>
            <p>
              {query
                ? "Essayez un autre nom ou numéro parmi vos dossiers accessibles."
                : "Créez un premier dossier pour commencer le suivi d’un usager."}
            </p>
            {!query && <a href="/dossiers/nouveau">Créer un dossier</a>}
          </div>
        )}
        {total > 25 && (
          <nav class="pagination" aria-label="Pagination">
            {page > 1 && (
              <a
                class="button secondary"
                href={
                  "/dossiers?q=" +
                  encodeURIComponent(query) +
                  "&page=" +
                  (page - 1)
                }
              >
                Page précédente
              </a>
            )}
            <span>
              Page {page} sur {Math.ceil(total / 25)}
            </span>
            {page * 25 < total && (
              <a
                class="button secondary"
                href={
                  "/dossiers?q=" +
                  encodeURIComponent(query) +
                  "&page=" +
                  (page + 1)
                }
              >
                Page suivante
              </a>
            )}
          </nav>
        )}
      </section>
    </Layout>
  );
}
export function Detail({ actor, row }: { actor: Actor; row: RecordRow }) {
  return (
    <Layout title="Fiche du dossier" actor={actor}>
      <a class="back" href="/dossiers">
        Retour aux dossiers
      </a>
      <AccessStatus />
      <div data-case-id={row.id}>
        <header class="page-heading">
          <div>
            <h1>{row.name}</h1>
            <p>Dossier {row.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <span class="badge">Ouvert</span>
        </header>
        <div class="detail-grid">
          <section>
            <h2>Renseignements de l’usager</h2>
            <dl>
              <div>
                <dt>Courriel</dt>
                <dd>{row.email || "Non renseigné"}</dd>
              </div>
              <div>
                <dt>Téléphone</dt>
                <dd>{row.phone || "Non renseigné"}</dd>
              </div>
            </dl>
            <a href={"/dossiers/nouveau?source=" + row.id}>
              Créer un autre dossier pour cet usager
            </a>
          </section>
          <section class="assignment">
            <h2>Suivi et attribution</h2>
            <dl>
              <div>
                <dt>Service</dt>
                <dd>{row.service}</dd>
              </div>
              <div>
                <dt>Responsable</dt>
                <dd>{row.owner_name}</dd>
              </div>
              <div>
                <dt>Ouvert le</dt>
                <dd>
                  {new Date(row.opened_at).toLocaleDateString("fr-CA", {
                    timeZone: "America/Toronto",
                  })}
                </dd>
              </div>
            </dl>
            <a
              class="button secondary"
              href={"/dossiers/" + row.id + "/transfert"}
            >
              Transférer le dossier
            </a>
          </section>
        </div>
      </div>
    </Layout>
  );
}
export function NewRecord({
  actor,
  choices,
  source,
  error,
  values = {},
}: {
  actor: Actor;
  choices: { id: string; name: string }[];
  source?: RecordRow;
  error?: string;
  values?: Record<string, string>;
}) {
  return (
    <Layout title="Nouveau dossier" actor={actor}>
      <a class="back" href="/dossiers">
        Retour aux dossiers
      </a>
      <AccessStatus />
      <div {...(source ? { "data-case-id": source.id } : {})}>
        <header class="page-heading">
          <div>
            <h1>Nouveau dossier</h1>
            <p>
              {source
                ? "Un nouveau suivi pour " + source.name + "."
                : "Les renseignements essentiels pour commencer un suivi."}
            </p>
          </div>
        </header>
        {error && <Notice message={error} error />}
        <form method="post" action="/dossiers" class="record-form">
          <p class="help">
            Les champs marqués d’un astérisque (*) sont obligatoires.
          </p>
          {source ? (
            <>
              <input type="hidden" name="client_id" value={source.client_id} />
              <input type="hidden" name="source" value={source.id} />
              <section>
                <h2>Usager</h2>
                <p>{source.name}</p>
                <p class="help">
                  Ce dossier utilisera ses renseignements existants.
                </p>
              </section>
            </>
          ) : (
            <section>
              <h2>Usager</h2>
              <label>
                Nom complet *
                <input
                  name="name"
                  required
                  maxlength={160}
                  autocomplete="off"
                  value={values.name || ""}
                />
              </label>
              <div class="field-pair">
                <label>
                  Courriel
                  <input
                    name="email"
                    type="email"
                    maxlength={254}
                    value={values.email || ""}
                  />
                </label>
                <label>
                  Téléphone
                  <input
                    name="phone"
                    type="tel"
                    maxlength={60}
                    value={values.phone || ""}
                  />
                </label>
              </div>
            </section>
          )}
          <section>
            <h2>Suivi</h2>
            <label>
              Service *
              <input
                name="service"
                required
                maxlength={160}
                placeholder="Ex. : Accompagnement au logement"
                value={values.service || ""}
              />
            </label>
            {actor.role === "superviseur" ? (
              <label>
                Intervenant responsable *
                <select name="owner_id" required>
                  <option value="">Choisir un intervenant</option>
                  {choices.map((p) => (
                    <option value={p.id} selected={values.owner_id === p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p class="help">
                Ce dossier vous sera attribué : <strong>{actor.name}</strong>.
              </p>
            )}
          </section>
          <div class="form-actions">
            <button class="button primary">Créer le dossier</button>
            <a href="/dossiers">Annuler</a>
          </div>
        </form>
      </div>
    </Layout>
  );
}
export function Transfer({
  actor,
  row,
  choices,
  error,
}: {
  actor: Actor;
  row: RecordRow;
  choices: { id: string; name: string }[];
  error?: string;
}) {
  return (
    <Layout title="Transférer le dossier" actor={actor}>
      <a class="back" href={"/dossiers/" + row.id}>
        Retour au dossier
      </a>
      <AccessStatus />
      <div data-case-id={row.id}>
        <header class="page-heading">
          <div>
            <h1>Transférer le dossier</h1>
            <p>
              {row.name} · {row.service}
            </p>
          </div>
        </header>
        {error && <Notice message={error} error />}
        <form
          method="post"
          action={"/dossiers/" + row.id + "/transfert"}
          class="record-form"
        >
          <input type="hidden" name="version" value={row.version} />
          <div class="handoff">
            <div>
              <span class="field-label">Responsable actuel</span>
              <strong>{row.owner_name}</strong>
            </div>
            <div>
              <label>
                Nouvel intervenant responsable *
                <select name="owner_id" required>
                  <option value="">Choisir un intervenant</option>
                  {choices.map((p) => (
                    <option value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <p class="transfer-note">
            Dès la confirmation, l’ancien intervenant perd l’accès à ce dossier.
            Le nouvel intervenant et les superviseurs de l’organisme pourront le
            consulter.
          </p>
          {!choices.length && (
            <Notice message="Aucun autre intervenant actif n’est disponible. Contactez votre superviseur." />
          )}
          <div class="form-actions">
            <button class="button primary" disabled={!choices.length}>
              Confirmer le transfert
            </button>
            <a href={"/dossiers/" + row.id}>Annuler</a>
          </div>
        </form>
      </div>
    </Layout>
  );
}
