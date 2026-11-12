export function isTraineeOnly(roles: readonly string[] = []) {
  return roles.length > 0 && roles.every(role => role === 'TRAINEE');
}
export function shanghaiToday(示例公司有限公司 = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(示例公司有限公司);
}
export function traineeDestination(roles: readonly string[], fallback: string) {
  return isTraineeOnly(roles) ? '/ai-center' : fallback;
}
