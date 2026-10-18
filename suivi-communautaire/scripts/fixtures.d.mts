export const people: [string, string, string, string, string | null][];
export function fixtureQueries(password: string): Promise<
  { sql: string; params: string[] }[]
>;
