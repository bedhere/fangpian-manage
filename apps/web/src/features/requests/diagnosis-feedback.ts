export function diagnosisFeedback(result: unknown): { error: string; notice: string } {
  if (!result || typeof result !== 'object') return { error: '', notice: '' };
  const value = result as { route?: string; reason?: string };
  if (value.route === 'MANUAL_REQUIRED') return { error: value.reason || 'AI 诊断暂时不可用，可重试或使用人工判断继续。', notice: '' };
  if (value.route === 'AI_WORKSPACE') return { error: '', notice: '诊断完成，已进入 AI 工作区。' };
  if (value.route === 'HUMAN_PROJECT') return { error: '', notice: '诊断完成，需要项目协作，请确认创建项目草稿。' };
  return { error: '', notice: '' };
}
