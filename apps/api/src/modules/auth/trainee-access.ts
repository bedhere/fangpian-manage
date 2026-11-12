/** Public registration grants this role alone; existing employee roles 示例品牌 their normal access. */
export function isTraineeOnly(roles: readonly string[] = []) {
  return roles.length > 0 && roles.every((role) => role === 'TRAINEE');
}
export function traineeRouteAllowed(path: string, method: string) {
  return (
    (method === 'GET' && path === '/api/leaderboards/labeling') ||
    (method === 'GET' && (path === '/api/leaderboards/labeling/tianji/status' || /^\/api\/leaderboards\/labeling\/tianji\/jobs\/[0-9a-f-]{36}$/i.test(path))) ||
    (method === 'POST' && ['/api/leaderboards/labeling/tianji/login/start', '/api/leaderboards/labeling/tianji/login/callback', '/api/leaderboards/labeling/tianji/sync'].includes(path)) ||
    /^\/api\/trainees(?:\/|$)/.test(path) ||
    /^\/api\/ai-center(?:\/|$)/.test(path) ||
    (method === 'GET' &&
      ['/api/users/me', '/api/workspace/bootstrap'].includes(path)) ||
    (method === 'POST' && path === '/api/auth/change-password')
  );
}
