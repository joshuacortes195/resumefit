// what a real database id looks like. anything else can never match a row, and postgres throws on it
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// true when the text is shaped like one of our ids, so pages can answer not found instead of crashing
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
