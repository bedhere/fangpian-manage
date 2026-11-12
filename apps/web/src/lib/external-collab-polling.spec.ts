import { afterEach, expect, it, vi } from 'vitest';
const apiPath = '@external-collab/api/index';
const { previewTargetSplitWorkbookLinkImport } = await import(/* @vite-ignore */ apiPath);
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('keeps a minute-long import job within the platform request budget and still returns progress/results', async () => {
  vi.useFakeTimers();
  let polls = 0;
  const fetch = vi.fn(async (url: string) => {
    if (!url.startsWith('api/jobs/')) return Response.json({ jobId: 'job_long_import' });
    polls++;
    return Response.json(polls <= 40 ? { status: 'running', progress: `已处理 ${polls}` } : { status: 'done', progress: '完成', data: { imported: 42 } });
  });
  vi.stubGlobal('fetch', fetch);
  const progress = vi.fn();
  const result = previewTargetSplitWorkbookLinkImport('https://workbook.test/doc', '本人', 150, progress);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(1499);
  expect(polls).toBe(0);
  await vi.advanceTimersByTimeAsync(58_501);
  expect(polls).toBe(40);
  expect(fetch).toHaveBeenCalledTimes(41);
  await vi.advanceTimersByTimeAsync(1500);
  await expect(result).resolves.toEqual({ imported: 42 });
  expect(progress).toHaveBeenLastCalledWith('完成');
});
