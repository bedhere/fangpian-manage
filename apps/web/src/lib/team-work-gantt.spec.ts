import { describe, expect, it } from 'vitest';
import { taskSpans } from '../../../team-work/src/domain/gantt';
describe('imported gantt dates', () => {
  it('uses the real start date and rolls the entire child range into its parent', () => {
    const spans = taskSpans([
      { id: 'root', parentId: null, dueAt: null },
      { id: 'a', parentId: 'root', startAt: '2026-09-20', dueAt: '2026-10-11' },
      { id: 'b', parentId: 'root', startAt: '2026-10-01', dueAt: '2026-10-25' },
    ]);
    const day = (v: string) => { const [y,m,d] = v.split('-').map(Number); return new Date(y,m-1,d).getTime(); };
    expect(spans.get('a')).toEqual({start:day('2026-09-20'),end:day('2026-10-11')});
    expect(spans.get('root')).toEqual({start:day('2026-09-20'),end:day('2026-10-25')});
    expect(taskSpans([{id:'legacy',parentId:null,dueAt:'2026-10-11'}]).get('legacy')).toEqual({start:day('2026-10-11'),end:day('2026-10-11')});
  });
});
