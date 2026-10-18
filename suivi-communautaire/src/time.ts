import { FieldProblem } from "./access";
// Résolution d'une date et heure civiles dans un fuseau IANA, sans correction silencieuse.
export const defaultZone = "America/Toronto";
export function validZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
// Décalage UTC (en minutes) du fuseau à un instant donné.
export function offsetAt(zone: string, instant: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const wall = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((wall - Math.floor(instant / 1000) * 1000) / 60000);
}
export function formatOffset(minutes: number) {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
export type Resolved = { instant: string; offset: number };
// Retourne l'instant UTC ou lève une erreur de champ : heure inexistante, répétée sans choix, ou
// décalage incohérent avec le fuseau.
export function resolveLocal(
  date: string,
  time: string,
  zone: string,
  offset?: string,
): Resolved {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) throw new FieldProblem({ date: "Indiquez une date et une heure valides." });
  const [y, mo, da] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [h, mi] = [Number(t[1]), Number(t[2])];
  const naive = Date.UTC(y, mo - 1, da, h, mi);
  const check = new Date(naive);
  if (
    y < 1990 ||
    h > 23 ||
    mi > 59 ||
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== da
  )
    throw new FieldProblem({ date: "Indiquez une date et une heure valides." });
  if (!validZone(zone)) throw new FieldProblem({ tz: "Choisissez un fuseau horaire valide." });
  const candidates = new Set<number>();
  for (const probe of [naive - 36e5 * 26, naive + 36e5 * 26]) {
    const o = offsetAt(zone, probe);
    if (offsetAt(zone, naive - o * 60000) === o) candidates.add(o);
  }
  const options = [...candidates].sort((a, b) => b - a);
  if (!options.length)
    throw new FieldProblem({
      time: "Cette heure n’existe pas dans le fuseau choisi (changement d’heure). Choisissez une autre heure.",
    });
  let chosen: number;
  if (options.length === 1) {
    chosen = options[0];
    if (offset && offset !== "auto" && Number(offset) !== chosen)
      throw new FieldProblem({ offset: "Le décalage choisi ne correspond pas à ce fuseau et à cette heure." });
  } else {
    if (!offset || offset === "auto" || !options.includes(Number(offset)))
      throw new FieldProblem(
        { offset: "Cette heure se répète lors du changement d’heure. Précisez le décalage voulu." },
        "Cette heure est ambiguë.",
      );
    chosen = Number(offset);
  }
  return { instant: new Date(naive - chosen * 60000).toISOString(), offset: chosen };
}
// Décalages possibles (pour proposer le choix lorsque l'heure est répétée).
export function ambiguousOffsets(date: string, time: string, zone: string) {
  try {
    const naive = Date.parse(`${date}T${time}:00Z`);
    const out = new Set<number>();
    for (const probe of [naive - 36e5 * 26, naive + 36e5 * 26]) {
      const o = offsetAt(zone, probe);
      if (offsetAt(zone, naive - o * 60000) === o) out.add(o);
    }
    return out.size > 1 ? [...out].sort((a, b) => b - a) : [];
  } catch {
    return [];
  }
}
// Affichage dans le fuseau d'origine de la note.
export function formatInstant(instant: string, zone: string) {
  try {
    return new Intl.DateTimeFormat("fr-CA", {
      timeZone: zone,
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(instant));
  } catch {
    return instant;
  }
}
