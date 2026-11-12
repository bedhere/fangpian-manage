import { Badge, Button, Card } from '@fangpian/ui';
import { useState } from 'react';
import { field, type Calendar, type Member, type Mutate, type Row, type Workspace } from './types';
import { Empty, Section } from './ui';
import { RecordTools } from './record-tools';
import { MentorSelection,mentorSelectionValid } from './mentor-selection';
import { MentorRequestQueue } from './mentor-requests';
export function MembersTab({ data, busy, mutate }: {
    data: Workspace;
    busy: boolean;
    mutate: Mutate;
}) { const [candidate, setCandidate] = useState(''); const candidates = data.people.filter(p => p.active && !data.members.some(m => m.ownerId === p.id)); return <Section title="管培生培养关系" description="AI导师1名、部门导师至少1名。仅选择同组织在职员工，历史评分身份保留；部门关系与原培养档案继续保留。"><MentorRequestQueue data={data} busy={busy} mutate={mutate}/><Card className="p-5"><form className="space-y-4" onSubmit={e => { e.preventDefault(); void mutate('/members', { userId: candidate }).then(ok => { if (ok)
    setCandidate(''); }); }}><h3 className="text-lg font-black">纳入管培生培养</h3><p className="text-sm leading-6 text-[#756d59]">选择已有的有效用户纳入AI部门培养，再配置双导师。原账号与历史记录保留。</p><label className="block text-sm font-bold">选择用户<select required className={field} value={candidate} onChange={e => setCandidate(e.target.value)}><option value="">请选择已有用户</option>{candidates.map(p => <option key={p.id} value={p.id}>{p.name} · {p.departmentName ?? '未分配部门'}</option>)}</select></label><Button disabled={busy || !candidate}>纳入管培生</Button></form></Card><div className="space-y-4">{data.members.map(m => <MemberEditor key={`${m.id}:${m.version}`} row={m} data={data} busy={busy} mutate={mutate}/>)}{!data.members.length && <Empty>暂无可配置的培养成员</Empty>}</div><CalendarEditor key={data.calendar?.version ?? 0} row={data.calendar} busy={busy} mutate={mutate}/></Section>; }
function MemberEditor({ row, data, busy, mutate }: {
    row: Row<Member>; data: Workspace; busy: boolean; mutate: Mutate;
}) {
    const [ai,setAi]=useState(row.data.aiMentorId??'');
    const [departments,setDepartments]=useState(row.data.departmentMentorIds);
    const [active,setActive]=useState(row.data.active);
    const {validAi,invalidDepartments,duplicate,complete}=mentorSelectionValid(data,row.ownerId,ai,departments);
    return <Card className="space-y-4 p-5">
      <div className="flex flex-wrap justify-between gap-3"><h3 className="text-xl font-black">{row.ownerName}</h3><Badge>{!complete?'待完善双导师':active?'培养中':'已停用'}</Badge></div>
      <p className="text-sm text-[#756d59]">培养生效 {row.data.sinceDate} · 原导师 {data.people.find(p=>p.id===row.data.legacyMentorId)?.name??(row.data.legacyMentorId?'历史导师':'尚未设置')} · v{row.version}</p>
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();void mutate(`/members/${row.ownerId}`,{version:row.version,aiMentorId:ai||null,departmentMentorIds:departments,active},'PATCH');}}>
        <MentorSelection data={data} ownerId={row.ownerId} ai={ai} setAi={setAi} departments={departments} setDepartments={setDepartments} busy={busy} required={active}/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={active} onChange={e=>setActive(e.target.checked)}/>启用AI中台培养</label>
        <Button disabled={busy||(!!ai&&!validAi)||duplicate||!!invalidDepartments.length||(active&&!complete)}>保存培养关系</Button>
      </form>
      <ExceptionForm ownerId={row.ownerId??''} week={data.week} busy={busy} mutate={mutate}/><RecordTools row={row} busy={busy} mutate={mutate}/>
    </Card>;
}
function ExceptionForm({ ownerId, week, busy, mutate }: {
    ownerId: string;
    week: string;
    busy: boolean;
    mutate: Mutate;
}) { const [dates, setDates] = useState(''); const [quota, setQuota] = useState(''); const [reason, setReason] = useState(''); return <details className="rounded-xl border border-[#e6dfca] p-4"><summary className="cursor-pointer text-sm font-black">本周休假 / 豁免确认 · {week}</summary><form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void mutate(`/members/${ownerId}/exception`, { week, dates: dates.split(/[\s,，]+/).filter(Boolean), ...(quota !== '' ? { noteQuota: Number(quota) } : {}), reason }, 'PUT'); }}><label className="block text-sm font-bold">豁免日期（YYYY-MM-DD，逗号或换行分隔）<textarea className={field} value={dates} onChange={e => setDates(e.target.value)}/></label><label className="block text-sm font-bold">本周学习笔记要求<select className={field} value={quota} onChange={e => setQuota(e.target.value)}><option value="">按正常规则</option><option value="0">0篇</option><option value="1">1篇</option><option value="2">2篇</option></select></label><label className="block text-sm font-bold">具体原因（必填，保留审核人及审计）<textarea required className={field} value={reason} onChange={e => setReason(e.target.value)}/></label><Button disabled={busy || !reason.trim()}>确认本周豁免</Button></form></details>; }
function CalendarEditor({ row, busy, mutate }: {
    row: Row<Calendar> | null;
    busy: boolean;
    mutate: Mutate;
}) { const [value, setValue] = useState<Omit<Calendar, 'effectiveFrom'>>(row ? { confirmed: row.data.confirmed, weekdays: row.data.weekdays, workStart: row.data.workStart, workEnd: row.data.workEnd, breakStart: row.data.breakStart, breakEnd: row.data.breakEnd } : { confirmed: false, weekdays: [1, 2, 3, 4, 5], workStart: '09:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00' }); function update<K extends keyof typeof value>(key: K, v: typeof value[K]) { setValue(s => ({ ...s, [key]: v })); } return <Card className="space-y-4 p-5"><h3 className="text-xl font-black">工作日历与评分启用</h3><p className="text-sm leading-6 text-[#756d59]">未确认时只展示覆盖率，不启用缺交或迟延扣分。首次确认从服务器当天生效，后续修改最早从次日生效，不追溯处罚。{row?.data.effectiveFrom && ` 当前生效：${row.data.effectiveFrom}。`}</p><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (window.confirm('确认此工作日历仅向后生效？已发生的历史记录不会追溯处罚。'))
    void mutate('/calendar', { version: row?.version ?? 0, ...value }, 'PUT'); }}><fieldset className="flex flex-wrap gap-4"><legend className="mb-3 text-sm font-bold">工作日</legend>{['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((label, day) => <label className="flex items-center gap-2 text-sm" key={day}><input type="checkbox" checked={value.weekdays.includes(day)} onChange={e => update('weekdays', e.target.checked ? [...value.weekdays, day] : value.weekdays.filter(d => d !== day))}/>{label}</label>)}</fieldset><div className="grid gap-4 sm:grid-cols-2">{([['workStart', '上班时间'], ['workEnd', '下班时间'], ['breakStart', '休息开始'], ['breakEnd', '休息结束']] as const).map(([key, label]) => <label key={key} className="text-sm font-bold">{label}<input type="time" required className={field} value={value[key]} onChange={e => update(key, e.target.value)}/></label>)}</div><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={value.confirmed} onChange={e => update('confirmed', e.target.checked)}/><span>确认工作日历，并按已公布规则启用缺交与时效统计</span></label><Button disabled={busy || !value.weekdays.length}>保存日历配置</Button></form></Card>; }
