'use client';
import { Badge, Button, Card } from '@fangpian/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { field, errorText, monday, request, write, type Mutate, type Workspace } from './types';
import { ErrorBox } from './ui';
import { TasksTab } from './tasks';
import { IvyTab } from './ivy';
import { NotesTab } from './notes';
import { MembersTab } from './members';
import { ApprovalsTab } from './approvals';
import { ReportsTab } from './reports';
import { NotificationLink } from '@/components/app-shell/notification-link';
import { notificationHref } from '@/lib/notification-destinations';
import { MyMentorsTab } from './mentor-requests';
import Link from 'next/link';
type Tab = 'my-mentors' | 'tasks' | 'members' | 'ivy' | 'notes' | 'approvals' | 'reports';
export function AiCenterPage() { const identity = useSessionStore(s => s.identity); const signature = identity ? `${identity.id}:${[...identity.roles].sort().join(',')}:${[...identity.permissions].sort().join(',')}` : 'signed-out'; return identity ? <WorkspacePage key={signature}/> : <main className="mx-auto max-w-6xl p-7"><Card className="p-7">请先登录后进入AI中台。</Card></main>; }
function WorkspacePage() {
    const [data, setData] = useState<Workspace>();
    const [week, setWeek] = useState('');
    const [tab, setTab] = useState<Tab>('tasks');
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [inbox, setInbox] = useState(false);
    const alive = useRef(true);
    const writing = useRef(false);
    useEffect(() => {
        let active = true;
        const requested = new URLSearchParams(window.location.search).get('tab');
        const allowed: Tab[] = ['my-mentors','tasks', 'members', 'ivy', 'notes', 'approvals', 'reports'];
        if (requested && allowed.includes(requested as Tab)) {
            void Promise.resolve().then(() => { if (active) setTab(requested as Tab); });
        }
        return () => { active = false; };
    }, []);

    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { const controller = new AbortController(); let active = true; void request<Workspace>(`/workspace${week ? `?week=${encodeURIComponent(week)}` : ''}`, controller.signal).then(result => { if (active)
        setData(result); }).catch(reason => { if (active)
        setError(errorText(reason)); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; controller.abort(); }; }, [week, revision]);
    const mutate: Mutate = useCallback(async (path, body, method = 'POST') => { if (writing.current)
        return false; writing.current = true; setBusy(true); setError(''); setMessage(''); try {
        const result=await write<{wecomNotice?:{status:string;targetName:string|null}}>(path, body, method);
        if (!alive.current)
            return false;
        setMessage(path==='/ivy'?'日报已保存，已通知导师查看；审核并评级后发送到群':/^\/ivy\/[^/]+\/review$/.test(path)&&result?.wecomNotice?result.wecomNotice.status==='UNCHANGED'?'评级已保存，日报内容未变化，未重复推送':result.wecomNotice.status==='UNAVAILABLE'?'评级已保存，消息入队暂不可用，请核对通知提示':result.wecomNotice.status==='FAILED'?'评级已保存，消息未推送，请核对通知提示':`评级已保存，消息已入队，接收位置：${result.wecomNotice.targetName}`:'操作已保存');
        setLoading(true);
        setRevision(v => v + 1);
        return true;
    }
    catch (reason) {
        if (alive.current)
            setError(errorText(reason));
        return false;
    }
    finally {
        writing.current = false;
        if (alive.current)
            setBusy(false);
    } }, []);
    const tabs: [
        Tab,
        string
    ][] = [...(data?.user.isTrainee?[["my-mentors","\u6211\u7684\u5bfc\u5e08"] as [Tab,string]]:[]),['tasks', '任务看板'], ...(data?.user.isManager ? [['members', '管培生管理'] as [
                Tab,
                string
            ]] : []), ['ivy', '艾维利'], ['notes', '每周学习清单'], ['approvals', '待审批'], ['reports', '周成长']];
    const pending = data ? data.tasks.filter(t => t.canReview && ['PROPOSED', 'DEFERRED', 'SUBMITTED'].includes(t.status)).length + data.ivy.filter(r => r.canReview && r.dateKey < data.serverDate && !r.data.review).length + data.notes.filter(r => r.canReview && r.status === 'SUBMITTED').length + data.links.filter(r => r.canReview && r.status === 'PENDING').length + data.appeals.filter(r => r.canReview && r.status === 'PENDING').length+(data.user.canApproveMentors?data.members.filter(m=>m.ownerId!==data.user.id&&m.data.mentorRequest?.status==='PENDING').length:0) : 0;
    return <main className="min-h-screen min-w-0 bg-[#fcfaf2] px-4 py-7 text-[#302d24] sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-black tracking-[.18em] text-[#8c762c]">AI CENTER · LEARN / DELIVER / GROW</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">AI中台</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#756d59]">让真实工作形成成果，让学习转化为行动。双导师协同，记录每一步成长。</p></div><div className="flex flex-wrap gap-3"><Link href="/leaderboards#tianji-sync" className="inline-flex min-h-11 items-center rounded-full border border-black/10 bg-white px-5 text-sm font-bold">排行榜 · 天玑抓取</Link><Button variant="secondary" disabled={loading || busy} onClick={() => { setLoading(true); setError(''); setRevision(v => v + 1); }}>刷新工作区</Button><Button variant="secondary" onClick={() => setInbox(v => !v)}>站内提醒{data ? ` · ${data.inbox.filter(n => !n.readAt).length}` : ''}</Button></div></header><Card className="flex flex-wrap items-end justify-between gap-4 bg-[#fff5cc] p-5"><div><p className="text-sm font-black">{data?.user.name ?? '当前用户'} · {data?.user.isManager ? '中台主管' : data?.user.isTrainee ? 'AI管培生' : data?.user.isMentor ? '培养导师' : 'AI员工'}</p><p className="mt-2 text-xs text-[#756d59]">{data ? `北京时间 ${data.serverDate}${data.user.isTrainee&&!data.user.isManager&&!data.user.isMentor?'':` · ${data.calendar?.data.confirmed ? '工作日历已确认' : '工作日历未确认，缺交及时效扣分未启用'}`}` : '正在读取授权范围…'}</p></div><label className="block text-sm font-bold">查看周（选择任一天自动定位周一）<input type="date" disabled={busy || loading} className={field} value={week || data?.week || ''} onChange={e => { if (e.target.value) {
        const next = monday(e.target.value);
        if (next !== (week || data?.week)) {
            setLoading(true);
            setError('');
            setWeek(next);
        }
    } }}/></label></Card><nav aria-label="AI中台功能" className="flex flex-wrap gap-2">{tabs.map(([key, title]) => <Button key={key} variant={tab === key ? 'primary' : 'secondary'} aria-pressed={tab === key} disabled={busy} onClick={() => { setTab(key); setError(''); setMessage(''); }}>{title}{key === 'approvals' && pending > 0 ? `（${pending}）` : ''}</Button>)}</nav><ErrorBox message={error}/>{message && <p role="status" className="rounded-xl bg-[#fff0b4] p-4 text-sm font-bold">{message}</p>}{loading && <p role="status" className="rounded-xl bg-white p-5 text-sm">正在读取AI中台工作区…</p>}{data && (!loading || tab === 'members' || tab === 'my-mentors' || tab === 'tasks') && <>{inbox && <Card className="space-y-3 p-5"><h2 className="text-xl font-black">站内提醒</h2>{!data.inbox.length && <p className="text-sm text-[#756d59]">暂无提醒</p>}{data.inbox.map(n => <InboxNotice key={n.id} note={n} busy={busy} mutate={mutate}/>)}</Card>}<div key={`${data.user.id}:${data.week}:${tab}`} className="min-w-0">{tab === 'my-mentors' && data.user.isTrainee && <MyMentorsTab data={data} busy={busy||loading} mutate={mutate}/>} {tab === 'tasks' && <TasksTab data={data} busy={busy||loading} mutate={mutate}/>} {tab === 'members' && data.user.isManager && <MembersTab data={data} busy={busy||loading} mutate={mutate}/>} {tab === 'ivy' && <IvyTab data={data} busy={busy} mutate={mutate}/>} {tab === 'notes' && <NotesTab data={data} busy={busy} mutate={mutate}/>} {tab === 'approvals' && <ApprovalsTab data={data} busy={busy} mutate={mutate}/>} {tab === 'reports' && <ReportsTab data={data}/>}</div></>}</div></main>;
}

function InboxNotice({note,busy,mutate}:{note:Workspace['inbox'][number];busy:boolean;mutate:Mutate}) {
    const href=notificationHref({entityType:'AI_CENTER',entityId:note.entityId??note.recordId??null,title:note.title,body:note.body});
    const content=<><p className="break-words text-sm font-bold">{note.title}</p>{note.body&&<p className="mt-1 break-words text-sm">{note.body}</p>}</>;
    return <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[#f7f4e9] p-4">
        {href?<NotificationLink id={note.id} href={href} className="min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-[#b08b21]">{content}<span className="mt-2 inline-block text-sm font-bold text-[#8c6b12] underline">查看并处理 →</span></NotificationLink>:<div className="min-w-0 flex-1">{content}<p className="mt-2 text-xs text-[#756d59]">此提醒未关联具体记录。</p></div>}
        {note.readAt?<Badge>已读</Badge>:<Button variant="secondary" disabled={busy} onClick={()=>void mutate(`/notifications/${note.id}/read`,{},'PATCH')}>标为已读</Button>}
    </div>;
}
