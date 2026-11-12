export function trustedTeamWorkMessage(event: { origin: string; source: unknown }, frame: Window | null, origin: string) {
  return !!frame && event.origin === origin && event.source === frame;
}
export type TeamWorkRequest = { type: "team-work:request"; id: string; method: string; path: string; body?: unknown };
export function isTeamWorkRequest(value: unknown): value is TeamWorkRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as TeamWorkRequest;
  if (v.type !== "team-work:request" || typeof v.id !== "string" || v.id.length > 100 || !["GET", "POST", "PATCH", "DELETE"].includes(v.method) || typeof v.path !== "string") return false;
  if (/%|\\|#/.test(v.path) || v.path.split("?")[0].split("/").some((s) => s === "." || s === "..")) return false;
  return /^\/api\/team-work\/(tasks|memos|ivy|appraisals|me|org|prefs|profile|settings|groups)(\/[^?]*)?(\?[^#]*)?$/.test(v.path);
}

export function teamAdminUrl(origin: string) {
  const url = new URL(origin);
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) url.port = "3102";
  else { url.hostname = `admin.${url.hostname}`; url.port = ""; }
  return url.toString();
}

