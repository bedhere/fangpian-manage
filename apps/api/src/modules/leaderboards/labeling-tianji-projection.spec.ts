import { describe, expect, it, vi } from 'vitest';
import { collectTianjiLabeling, tianjiSubmissionDay, type TianjiPull } from './labeling-tianji-projection.js';

const people = [{ traineeId: 'a', displayName: '甲' }, { traineeId: 'b', displayName: '乙' }];
const batch = (id = 10, name = '甲', date = '2026-11-01', submitted = 2) => ({ employee_id: id, tagger: name, batch_date: date, submitted });
const detail = (id: number, time = '2026-11-10 10:00:00') => ({ employee_id: 10, assign_id: id, submitted: 1, submit_time: time });
function fixture(pull: TianjiPull) { return { from: '2026-11-10', to: '2026-11-10', people, known: [], pull, progress: vi.fn(async () => {}) }; }
describe('Tianji labeling projection', () => {
  it('uses actual Shanghai submission day, scans old batches, deduplicates between batches and skips unmatched names', async () => {
    const pull = vi.fn<TianjiPull>(async (kind, query) => kind === 'completion'
      ? { list: [batch(), batch(10, '甲', '2026-11-02'), batch(30, '未入驻人员')], count: 3 }
      : { list: query.batch_date === '2026-11-01' ? [detail(1), detail(2, '2026-11-09 13:00:00')] : [detail(1), detail(3, '2026-11-09T18:00:00Z')], count: 2 });
    const result = await collectTianjiLabeling(fixture(pull));
    expect(result.counts.get('a')?.get('2026-11-10')).toBe(2);
    expect(result.assignments).toBe(3); expect(result.skipped).toEqual([]);
    expect(pull.mock.calls[0]).toEqual(['completion', { page: 1, pageSize: 200 }]);
    expect(result.bindings).toEqual([{ traineeId: 'a', employeeId: 10, employeeName: '甲' }]);
  });
  it('keeps a verified stable employee ID when a display name changes', async () => {
    const input = fixture(async kind => kind === 'completion' ? { list: [batch(10, '甲的新名称', '2026-11-01', 1)], count: 1 } : { list: [detail(1)], count: 1 });
    const result = await collectTianjiLabeling({ ...input, known: [{ traineeId: 'a', employeeId: 10, employeeName: '甲' }] });
    expect(result.counts.get('a')?.get('2026-11-10')).toBe(1);
  });
  it('accepts the live endpoint timestamp format without a year and still filters by submission day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T12:00:00+08:00'));
    try {
      const result = await collectTianjiLabeling(fixture(async kind => kind === 'completion'
        ? { list: [batch(10, '甲', '2026-11-09', 3)], count: 1 }
        : { list: [detail(1, '11-09 18:06'), detail(2, '11-09 22:50'), detail(3, '11-10 15:09')], count: 3 }));
      expect(result.counts.get('a')?.get('2026-11-10')).toBe(1);
      expect(result.assignments).toBe(3);
    } finally { vi.useRealTimers(); }
  });
  it('reads every page before producing an authoritative result', async () => {
    const result = await collectTianjiLabeling(fixture(async (kind, query) => kind === 'completion' ? { list: [batch(10, '甲', '2026-11-01', 501)], count: 1 }
      : { list: query.page === 1 ? Array.from({ length: 500 }, (_, index) => detail(index + 1)) : [detail(501)], count: 501 }));
    expect(result.counts.get('a')?.get('2026-11-10')).toBe(501);
  });
  it('refuses incomplete pagination and moving totals', async () => {
    await expect(collectTianjiLabeling(fixture(async () => ({ list: [batch()], count: 2 })))).rejects.toThrow('分页数据不完整');
    const moving = fixture(async (kind, query) => kind === 'completion'
      ? { list: [batch()], count: 1 }
      : { list: query.page === 1 ? Array.from({ length: 500 }, (_, i) => detail(i + 1)) : [detail(501)], count: query.page === 1 ? 501 : 502 });
    await expect(collectTianjiLabeling(moving)).rejects.toThrow('数量发生变化');
  });
  it('does not guess duplicate names or replace an existing identity with a new ID', async () => {
    const input = fixture(async () => ({ list: [batch()], count: 1 }));
    await expect(collectTianjiLabeling({ ...input, people: [...people, { traineeId: 'c', displayName: '甲' }] })).rejects.toThrow('尚未与本组织');
    await expect(collectTianjiLabeling({ ...input, known: [{ traineeId: 'a', employeeId: 99, employeeName: '甲' }] })).rejects.toThrow('尚未与本组织');
    await expect(collectTianjiLabeling(fixture(async () => ({ list: [batch(10, '甲'), batch(11, '甲')], count: 2 })))).rejects.toThrow('尚未与本组织');
  });
  it('rejects records for another person, repeated rows and missing submission times', async () => {
    for (const rows of [[{ ...detail(1), employee_id: 11 }], [detail(1), detail(1)], [{ ...detail(1), submit_time: '' }], [{ ...detail(1), submitted: 2 }]]) {
      const input = fixture(async kind => kind === 'completion' ? { list: [batch()], count: 1 } : { list: rows, count: rows.length });
      await expect(collectTianjiLabeling(input)).rejects.toMatchObject({ status: 502 });
    }
  });
  it('pages a fixed roster while submissions continue, ignoring empty timestamps only for unsubmitted rows', async () => {
    const pull = vi.fn<TianjiPull>(async (kind, query) => kind === 'completion'
      ? { list: [batch(10, '甲', '2026-11-01', 1)], count: 1 }
      : { list: query.page === 1 ? Array.from({ length: 500 }, (_, i) => ({ ...detail(i + 1), submitted: 0, submit_time: '' }))
        : [detail(501), { ...detail(502), submitted: '0', submit_time: '' }], count: 502 });
    const result = await collectTianjiLabeling(fixture(pull));
    expect(result.processed).toBe(502);
    expect(result.counts.get('a')?.get('2026-11-10')).toBe(1);
    expect(pull.mock.calls.filter(([kind]) => kind === 'detail').map(([, query]) => query)).toEqual([
      { employee_id: 10, batch_date: '2026-11-01', page: 1, pageSize: 500 },
      { employee_id: 10, batch_date: '2026-11-01', page: 2, pageSize: 500 },
    ]);
  });
  it('includes newly submitted rows even if the initial completion summary was zero', async () => {
    const result = await collectTianjiLabeling(fixture(async kind => kind === 'completion'
      ? { list: [batch(10, '甲', '2026-11-01', 0)], count: 1 }
      : { list: [detail(1)], count: 1 }));
    expect(result.counts.get('a')?.get('2026-11-10')).toBe(1);
  });
  it('does not turn an unavailable upstream into recorded zero', async () => {
    await expect(collectTianjiLabeling(fixture(async () => { throw new Error('missing personal grant'); }))).rejects.toThrow('missing personal grant');
  });
});
describe('Tianji submission dates', () => {
  it('restores a unique year from the dispatch date including New Year and leap days', () => {
    expect(tianjiSubmissionDay('11-10 15:09', '2026-11-09', '2026-11-10')).toBe('2026-11-10');
    expect(tianjiSubmissionDay('01-01 00:01', '2026-12-31', '2027-01-02')).toBe('2027-01-01');
    expect(tianjiSubmissionDay('02-29 23:59:00', '2023-12-31', '2024-03-01')).toBe('2024-02-29');
  });
  it.each([
    ['11-09 18:06', undefined, '2026-11-10'],
    ['11-09 18:06', '2025-11-01', '2026-11-10'],
    ['11-08 18:06', '2026-11-09', '2026-11-10'],
    ['11-11 18:06', '2026-11-09', '2026-11-10'],
    ['02-30 18:06', '2026-01-01', '2026-11-10'],
    ['11-09 25:00', '2026-11-09', '2026-11-10'],
  ])('refuses missing context, ambiguous years and impossible short dates: %s', (value, batchDate, today) => {
    expect(() => tianjiSubmissionDay(value!, batchDate, today)).toThrow();
  });
  it('handles local times, UTC boundary and epoch seconds', () => {
    expect(tianjiSubmissionDay('2026-11-09T18:30:00Z')).toBe('2026-11-10');
    expect(tianjiSubmissionDay('2026-11-10 01:00:00')).toBe('2026-11-10');
    expect(tianjiSubmissionDay(Date.parse('2026-11-09T18:30:00Z') / 1000)).toBe('2026-11-10');
  });
  it.each(['2026-02-30 10:00:00', '2026-11-10 25:00:00', '--', '', null])('rejects invalid date %s', value => {
    expect(() => tianjiSubmissionDay(value)).toThrow();
  });
});
