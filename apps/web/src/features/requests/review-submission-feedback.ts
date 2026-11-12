export const reviewSubmissionKey = 'fangpian:project-review-submitted';
export function finishProjectConfirmation(project: { status: string }, navigate: (path: string) => void) {
  if (!['HUMAN_REQUIRED', 'DEPARTMENT_REVIEW', 'TECH_REVIEW'].includes(project.status)) throw new Error('项目尚未进入审核，请刷新页面确认状态。');
  sessionStorage.setItem(reviewSubmissionKey, 'submitted');
  navigate('/dashboard');
}
