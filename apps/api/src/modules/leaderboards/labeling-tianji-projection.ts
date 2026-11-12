import { BadGatewayException } from '@nestjs/common';
import { shanghaiToday, workDate } from '../trainees/trainee-policy.js';

export type TianjiPage = { list: Record<string, unknown>[]; count: number };
export type TianjiPull = (kind: 'completion' | 'detail', query: Record<string, string | number>) => Promise<TianjiPage>;
export type LabelingPerson = { traineeId: string; displayName: string };
export type LabelingBinding = { traineeId: string; employeeId: number; employeeName: string };
const invalid = (message = '天玑标注数据格式不完整，本次未更新排行榜') => new BadGatewayException(message);
function positiveId(value: unknown) {
  if (!(typeof value === 'number' || typeof value === 'string' && /^[1-9]\d*$/.test(value))) throw invalid();
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) throw invalid();
  return id;
}
function date(value: unknown) {
  if (typeof value !== 'string') throw invalid();
  try { workDate(value); return value; } catch { throw invalid(); }
}
export function tianjiSubmissionDay(value: unknown, batchDate?: string, today = shanghaiToday()) {
  // The live detail endpoint formats local timestamps as MM-DD HH:mm. Recover
  // a year only when the dispatch date and current date admit one valid day.
  if (typeof value === 'string' && /^\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    if (!batchDate) throw invalid('天玑提交时间缺少年份和有效批次日期，本次未更新排行榜');
    const batch = date(batchDate), end = date(today), candidates: string[] = [];
    if (batch > end) throw invalid();
    for (let year = Number(batch.slice(0, 4)); year <= Number(end.slice(0, 4)); year++) {
      let day: string;
      try { day = tianjiSubmissionDay(`${year}-${value}`); } catch { continue; }
      if (day >= batch && day <= end) candidates.push(day);
    }
    if (candidates.length !== 1) throw invalid('天玑提交时间省略年份，无法唯一确定实际日期；本次保留上次成功数据');
    return candidates[0];
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return date(value);
  let time: Date;
  if (typeof value === 'string' && /^(?:\d{10}|\d{13})$/.test(value)) value = Number(value);
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) time = new Date(value < 1e12 ? value * 1000 : value);
  else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value)) {
    date(value.slice(0, 10));
    if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) throw invalid();
    const iso = value.replace(' ', 'T'); time = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}+08:00`);
  } else throw invalid('已提交记录缺少有效提交时间，本次保留上次成功数据');
  if (!Number.isFinite(time.getTime()) || time.getUTCFullYear() < 2000 || time.getUTCFullYear() > 2100) throw invalid();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
}

async function allPages(pull: TianjiPull, kind: 'completion' | 'detail', query: Record<string, string | number>, progress: (rows: number) => Promise<void>) {
  const rows: Record<string, unknown>[] = []; let expected: number | undefined;
  const pageSize = kind === 'detail' ? 500 : 200;
  for (let page = 1; page <= 1000; page++) {
    const response = await pull(kind, { ...query, page, pageSize });
    if (!Array.isArray(response.list) || !Number.isInteger(response.count) || response.count < 0 || response.count > 200_000 || response.list.length > pageSize
      || response.list.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw invalid();
    if (expected !== undefined && expected !== response.count) throw invalid('抓取期间天玑记录数量发生变化，请重新抓取；本次保留上次成功数据');
    expected = response.count; rows.push(...response.list); await progress(response.list.length);
    if (rows.length === expected) return rows;
    if (rows.length > expected || response.list.length !== pageSize) throw invalid('天玑分页数据不完整，本次未更新排行榜');
  }
  throw invalid('天玑分页数量超过本次安全上限，请联系管理员');
}

export async function collectTianjiLabeling(input: {
  from: string; to: string; people: LabelingPerson[]; known: LabelingBinding[]; pull: TianjiPull;
  progress: (message: string, processed: number) => Promise<void>;
}) {
  const roster = new Map(input.people.map(person => [person.traineeId, person]));
  const names = new Map<string, LabelingPerson[]>();
  for (const person of input.people) names.set(person.displayName.trim(), [...(names.get(person.displayName.trim()) ?? []), person]);
  const bindings = new Map(input.known.filter(binding => roster.has(binding.traineeId)).map(binding => [binding.employeeId, binding]));
  const boundPeople = new Map(input.known.map(binding => [binding.traineeId, binding.employeeId]));
  const matched = new Map<string, LabelingBinding>(); const skipped = new Set<string>();
  const counts = new Map<string, Map<string, number>>();
  const assignments = new Map<string, string>(); const batches = new Set<string>(); let processed = 0;
  const today = shanghaiToday();
  // Completion dates and batch dates are different: include older dispatched batches.
  const completion = await allPages(input.pull, 'completion', {}, async () => input.progress('正在读取可见标注人员和派单批次', processed));
  const sourceNames = new Map<string, Set<number>>();
  for (const row of completion) {
    if (typeof row.tagger !== 'string' || !row.tagger.trim()) throw invalid();
    const name = row.tagger.trim(); const ids = sourceNames.get(name) ?? new Set<number>();
    ids.add(positiveId(row.employee_id)); sourceNames.set(name, ids);
  }
  for (const row of completion) {
    const employeeId = positiveId(row.employee_id); const batch = date(row.batch_date);
    if (typeof row.tagger !== 'string' || !row.tagger.trim()) throw invalid();
    const name = row.tagger.trim();
    let binding = bindings.get(employeeId);
    if (!binding) {
      const people = names.get(name) ?? [];
      if (!people.length) continue;
      if (people.length !== 1 || sourceNames.get(name)?.size !== 1 || boundPeople.has(people[0].traineeId)) { skipped.add(name); continue; }
      binding = { traineeId: people[0].traineeId, employeeId, employeeName: name };
      bindings.set(employeeId, binding); boundPeople.set(binding.traineeId, employeeId);
    }
    matched.set(binding.traineeId, binding);
    if (!counts.has(binding.traineeId)) counts.set(binding.traineeId, new Map());
    const batchKey = `${employeeId}/${batch}`;
    if (batches.has(batchKey)) throw invalid('天玑人员批次出现重复记录，本次未更新排行榜');
    batches.add(batchKey);
    if (batch > input.to) continue;
    const submitted = Number(row.submitted);
    if (!['number', 'string'].includes(typeof row.submitted) || row.submitted === '' || !Number.isInteger(submitted) || submitted < 0) throw invalid();
    // Page the stable dispatch roster rather than filtering submitted=1. People
    // continue annotating while we read; changing submission state must not move
    // rows between pages or change the pagination total.
    const details = await allPages(input.pull, 'detail', { employee_id: employeeId, batch_date: batch }, async length => {
      processed += length;
      if (processed > 200_000) throw invalid('本次可见派工明细超过安全上限，请联系管理员分批处理');
      await input.progress(`正在读取${roster.get(binding!.traineeId)!.displayName}的派工清单并统计已提交记录`, processed);
    });
    const withinBatch = new Set<string>();
    for (const detail of details) {
      if (positiveId(detail.employee_id) !== employeeId || ![0, '0', false, 1, '1', true].includes(detail.submitted as never)) throw invalid();
      const id = typeof detail.assign_id === 'number' || typeof detail.assign_id === 'string' ? String(detail.assign_id) : '';
      if (!/^[1-9]\d{0,19}$/.test(id)) throw invalid();
      const key = `${employeeId}/${id}`;
      if (withinBatch.has(key)) throw invalid('天玑明细分页存在重复派工单，本次未更新排行榜');
      withinBatch.add(key);
      if ([0, '0', false].includes(detail.submitted as never)) continue;
      const day = tianjiSubmissionDay(detail.submit_time, batch, today);
      if (assignments.has(key)) { if (assignments.get(key) !== day) throw invalid(); continue; }
      assignments.set(key, day);
      if (assignments.size > 200_000) throw invalid('本次可见已提交明细超过安全上限，请联系管理员分批处理');
      if (day < input.from || day > input.to) continue;
      const days = counts.get(binding.traineeId)!; days.set(day, (days.get(day) ?? 0) + 1);
    }
  }
  if (!matched.size) throw invalid('天玑可见人员尚未与本组织管培生匹配，请核对本人账号权限和人员姓名');
  return { bindings: [...matched.values()], counts, processed, skipped: [...skipped], assignments: assignments.size };
}
