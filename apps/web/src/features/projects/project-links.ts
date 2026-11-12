/** Share only the existing detail route. No access credentials belong in a group link. */
export function projectPath(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || /[\r\n]/.test(id))
    throw new Error("项目编号无效");
  return `/projects/${id}`;
}
export function projectShareUrl(origin: string, id: string) {
  return new URL(projectPath(id), origin).toString();
}
export function safeProjectReturn(
  value: string | null | undefined,
): string | null {
  return typeof value === "string" &&
    /^\/projects\/[a-zA-Z0-9_-]+$/.test(value) &&
    !/[\r\n]/.test(value)
    ? value
    : null;
}
export function projectLoginUrl(path: string) {
  const target = safeProjectReturn(path);
  return target ? `/?next=${encodeURIComponent(target)}` : "/";
}
export function projectReturnFromSearch(search: string) {
  return safeProjectReturn(new URLSearchParams(search).get("next"));
}
/** Login destinations are a closed allowlist; project sharing retains its stricter rule. */
export function safeLoginReturn(value: string | null | undefined): string | null {
  return value === '/external-collab' ? value : safeProjectReturn(value);
}
export function loginReturnFromSearch(search: string) {
  return safeLoginReturn(new URLSearchParams(search).get('next'));
}
export function safeLoginUrl(path: string) {
  const target = safeLoginReturn(path);
  return target ? `/?next=${encodeURIComponent(target)}` : '/';
}
export function loginDestination(search: string, mustChangePassword: boolean) {
  const target = loginReturnFromSearch(search);
  return mustChangePassword
    ? `/change-password${target ? "?next=" + encodeURIComponent(target) : ""}`
    : (target ?? "/dashboard");
}
