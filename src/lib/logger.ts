import { getEnv } from "./env";

const priorities = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof priorities;

// Use fixed event names and opaque IDs, never payloads or credentials.
export function logEvent(level: Level, event: string, requestId?: string) {
  if (priorities[level] < priorities[getEnv().LOG_LEVEL]) return;
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, requestId });
  if (level === "error") console.error(entry);
  else console.log(entry);
}
