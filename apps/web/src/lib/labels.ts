/** Stored values stay English (filters and the DB). These helpers only change what the user sees. */

type HasMessages = {
  has: (key: string) => boolean;
  (key: string): string;
};

export function labelOf(t: HasMessages, value: string | null | undefined): string {
  if (!value) return "";
  return t.has(value) ? t(value) : value;
}
