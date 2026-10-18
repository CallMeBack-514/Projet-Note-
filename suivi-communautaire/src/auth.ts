import { betterAuth } from "better-auth";
export function auth(env: Env) {
  return betterAuth({
    database: env.DB,
    secret: env.AUTH_SECRET,
    baseURL: env.APP_ORIGIN,
    trustedOrigins: [env.APP_ORIGIN],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
    },
    session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 8 },
    advanced: { useSecureCookies: env.APP_ORIGIN.startsWith("https:") },
    logger: { disabled: true },
  });
}
export type Actor = {
  id: string;
  organisation_id: string;
  role: "intervenant" | "superviseur";
  name: string;
  organisation_name: string;
  sessionId: string;
};
export async function authenticate(
  env: Env,
  headers: Headers,
): Promise<Actor | null> {
  const s = await auth(env).api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!s) return null;
  const p = await env.DB.prepare(
    `SELECT p.user_id AS id, p.organisation_id, p.role, u.name, o.name AS organisation_name
    FROM profiles p JOIN user u ON u.id=p.user_id JOIN organisations o ON o.id=p.organisation_id
    JOIN session s ON s.userId=p.user_id
    WHERE p.user_id=? AND p.active=1 AND s.id=? AND s.expiresAt>?`,
  )
    .bind(s.user.id, s.session.id, Date.now())
    .first<Omit<Actor, "sessionId">>();
  return p ? { ...p, sessionId: s.session.id } : null;
}
