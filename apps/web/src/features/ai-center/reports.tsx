import { Button, Card } from '@fangpian/ui';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { GrowthWorkspace } from '@/features/trainees/growth-workspace';
import type { GrowthPlan, GrowthWorkspaceData } from '@/features/trainees/growth-types';
import { errorText, field, request, write, type Workspace } from './types';
import { Empty, ErrorBox, Section } from './ui';
import { RecordSnapshot } from './record-snapshot';
import { GrowthRatingReviews } from './growth-rating-reviews';
type Component = {
    score: number | null;
    earned?: number;
    expected: number;
    reviewed: number;
    missing: number;
    detail: string;
    groups?: {key:string;label:string;weight:number;score:number|null;expected:number;reviewed:number;missing:number}[];
};
type Report = {
    audience: 'MENTOR';
    week: string;
    traineeId: string;
    traineeName: string;
    components: {
        delivery: Component;
        ivy: Component;
        learning: Component;
    };
    total: number | null;
    suggestedRating: string | null;
    pending: string[];
    facts: {
        tasks: unknown[];
        ivy: unknown[];
        notes: unknown[];
    };
    rulesVersion: string;
};
type TraineeReport = {
    audience:'TRAINEE';week:string;traineeId:string;traineeName:string;
    components:Record<'delivery'|'ivy'|'learning',{expected:number;reviewed:number;missing:number}>;
    finalRating:string|null;
};
type WeekReport=Report|TraineeReport;
export function ReportsTab({ data }: {
    data: Workspace;
}) { const people = data.members.filter(m => m.data.active || m.ownerId === data.user.id); const [person, setPerson] = useState(data.user.isTrainee ? data.user.id : people[0]?.ownerId ?? ''); const [growthDirty, setGrowthDirty] = useState(false); const [growthRefresh, setGrowthRefresh] = useState(0);const [generationBusy,setGenerationBusy]=useState(false); return <Section title={person===data.user.id?"我的周成长":"周成长与量化依据"} description={person===data.user.id?"查看本周应交、已评和缺交情况，等级由导师核对后发布。":"任务交付60% + 艾维利执行与复盘25% + 学习计划质量15%。未知项保持待核定，未确认工作日历不启用缺交或时效扣分。"}><Card className="p-5"><label className="block text-sm font-bold">选择管培生<select className={field} disabled={generationBusy} value={person} onChange={e => { if (!growthDirty || window.confirm('成长计划有未保存内容，确认切换管培生？'))
    setPerson(e.target.value); }}><option value="">请选择</option>{people.map(m => <option key={m.ownerId} value={m.ownerId ?? ''}>{m.ownerName}</option>)}</select></label></Card>{person ? <ReportDetail key={`${person}:${data.week}`} person={person} data={data} generationBlocked={growthDirty} onBusy={setGenerationBusy} onGenerated={() => setGrowthRefresh(x => x + 1)}/> : <Empty>请选择有权查看的管培生</Empty>}<details className="rounded-2xl border border-[#e6dfca] bg-white p-5" open><summary className="cursor-pointer text-xl font-black">{person===data.user.id?"导师评价与成长建议":"成长计划档案、版本与发布"}</summary><p className="mt-3 text-sm leading-6 text-[#756d59]">{person===data.user.id?"查看导师已发布的综合评价和成长建议。":"事实汇总生成后，在此核对文字、评级、来源和历史，再人工发布。既有计划与会议材料整理入口继续保留。"}</p><fieldset disabled={generationBusy} className="min-w-0"><GrowthWorkspace key={growthRefresh} onDirtyChange={setGrowthDirty}/></fieldset></details><GrowthRatingReviews userId={data.user.id} personId={person}/></Section>; }
function ReportDetail({ person, data, onGenerated,generationBlocked,onBusy }: {
    person: string;
    data: Workspace;
    onGenerated: () => void;
    generationBlocked:boolean;
    onBusy:(value:boolean)=>void;
}) {
    const [report, setReport] = useState<WeekReport>();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [existing, setExisting] = useState<GrowthPlan | null>();
    const [generation, setGeneration] = useState('');
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { const abort = new AbortController(); let active = true; void request<WeekReport>(`/reports/${person}?week=${encodeURIComponent(data.week)}`, abort.signal).then(result => { if (active)
        setReport(result); }).catch(e => { if (active)
        setError(errorText(e)); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; abort.abort(); }; }, [person, data.week]);
    async function prepare() { if(generationBlocked){setError('请先保存或关闭下方成长计划编辑，再生成事实草稿');return;} setError(''); setBusy(true);onBusy(true); try {
        const growth = await apiClient.request<GrowthWorkspaceData>('/api/trainees/growth', {}, false);
        if (alive.current)
            setExisting(growth.plans.find(p => p.traineeId === person && p.periodStart === data.week) ?? null);
    }
    catch (e) {
        if (alive.current)
            setError(errorText(e));
    }
    finally {
        if (alive.current)
            setBusy(false);onBusy(false);
    } }
    async function generate() {if(generationBlocked){setError('请先保存或关闭下方成长计划编辑，再生成事实草稿');return;} if (existing === undefined)
        return; setBusy(true);onBusy(true); setError(''); try {
        await write(`/reports/${person}/growth`, { week: data.week, replace: !!existing, ...(existing ? { expectedVersion: existing.version } : {}) });
        if (alive.current) {
            setGeneration('事实汇总已生成成长计划草稿，请在下方核对后发布。');
            setExisting(undefined);
            onGenerated();
        }
    }
    catch (e) {
        if (alive.current) {
            setError(`${errorText(e)}。若计划已更新，请重新检查已有版本后再生成。`);
            setExisting(undefined);
        }
    }
    finally {
        if (alive.current)
            setBusy(false);onBusy(false);
    } }
    if(report?.audience==='TRAINEE')return <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-3">{([['delivery','任务交付'],['ivy','艾维利执行与复盘'],['learning','每周学习清单']] as const).map(([key,label])=>{const c=report.components[key];return <Card key={key} className="min-w-0 p-5"><h3 className="font-black">{label}</h3><dl className="mt-5 grid grid-cols-3 gap-3">{([['expected','应交'],['reviewed','已评'],['missing','缺交']] as const).map(([metric,title])=><div key={metric}><dt className="text-sm text-[#756d59]">{title}</dt><dd className="mt-2 text-3xl font-black">{c[metric]}</dd></div>)}</dl></Card>;})}</div><Card className="space-y-3 bg-[#fff7d4] p-5"><h3 className="text-lg font-black">{report.traineeName} · {report.week}</h3><p className="text-sm font-bold">本周等级</p><p className="text-3xl font-black">{report.finalRating??'待导师发布'}</p><p className="text-sm text-[#756d59]">{report.finalRating?'已由导师核对并发布。':'导师核对本周表现后，将在这里发布等级。'}</p></Card></div>;
    const canGenerate = person!==data.user.id&&(data.user.isManager || data.members.some(m => m.ownerId === person && m.canReview));
    return <div className="space-y-4"><ErrorBox message={error}/>{loading && <p role="status">正在读取本周成长记录…</p>}{report && <><div className="grid gap-4 lg:grid-cols-3">{([['delivery', '任务交付 D · 60%'], ['ivy', '执行与复盘 I · 25%'], ['learning', '学习计划质量 L · 15%']] as const).map(([key, label]) => { const c = report.components[key]; return <Card className="min-w-0 p-5" key={key}><h3 className="font-black">{label}</h3><p className="mt-4 text-3xl font-black">{c.score === null ? '待核定 / 不适用' : c.score.toFixed(2)}</p><p className="mt-3 text-sm">应交 {c.expected} · 已评 {c.reviewed} · 缺交 {c.missing}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#756d59]">{c.detail}</p></Card>; })}</div><DeliveryGroups groups={report.components.delivery.groups}/><Card className="space-y-3 bg-[#fff7d4] p-5"><h3 className="text-xl font-black">{report.traineeName} · {report.week}</h3><p className="text-2xl font-black">总分：{report.total === null ? '数据尚未完整核定' : report.total.toFixed(2)}</p><p className="text-sm">建议评级：{report.suggestedRating ?? '待人工结合事实确认'} · 规则 {report.rulesVersion}</p><p className="text-sm leading-6">{report.rulesVersion==='2026-11-03-v2'?'D = 平时与艾维利任务组 × 50% + 学习清单交付组 × 30% + 抢领任务组 × 20%；空组0分，权重固定，待评仍待核定。':'D = Σ(确认难度权重 × 已验收任务分) / Σ权重；'}I = 应交日报分之和 / 应交日数；L = 正式笔记质量分之和 / max(要求篇数, 实交篇数)。进度、任务数量和P0标记不直接加分。</p>{report.pending.length > 0 && <div><h4 className="font-bold">待核定与缺项</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{report.pending.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}</Card><details className="rounded-2xl border border-[#e6dfca] bg-white p-5"><summary className="cursor-pointer font-black">查看来源事实与记录版本</summary>{(['tasks', 'ivy', 'notes'] as const).map(kind => <div key={kind} className="mt-4"><h4 className="font-bold">{kind === 'tasks' ? '任务' : kind === 'ivy' ? '艾维利' : '学习笔记'}（{report.facts[kind].length}）</h4>{report.facts[kind].map((fact, i) => <RecordSnapshot key={i} value={fact}/>)}</div>)}</details>{canGenerate && <Card className="space-y-4 p-5"><h3 className="text-lg font-black">生成成长计划事实草稿</h3>{generationBlocked&&<p role="status" className="text-sm font-bold">请先保存或关闭下方成长计划编辑，再生成事实草稿，避免丢失未保存内容。</p>}<p className="text-sm leading-6 text-[#756d59]">使用当前事实与缺项，不补造人工评分。生成前先检查同一管培生同一周已有计划，替换需要明确确认。</p><Button disabled={busy||generationBlocked} onClick={() => void prepare()}>检查已有计划与版本</Button>{existing !== undefined && <div className="space-y-3 rounded-xl bg-[#fff6d8] p-4"><p className="text-sm font-bold">{existing ? `本周已有${existing.status === 'PUBLISHED' ? '已发布' : '草稿'}计划，版本 v${existing.version ?? '未知'}。生成将创建新的草稿版本，请重新核对后发布。` : '本周尚无已有计划，将新建事实汇总草稿。'}</p>{existing?.status === 'PUBLISHED' && <p className="text-sm text-red-800">此操作将替换已有发布内容为待核对草稿，不会自动发布。</p>}<Button disabled={busy || generationBlocked || (!!existing && existing.version === undefined)} onClick={() => { if (window.confirm(existing ? '确认以当前事实重新生成并替换此版本？' : '确认新建本周事实汇总草稿？'))
        void generate(); }}>{existing ? '确认替换指定版本并生成' : '确认新建事实草稿'}</Button><Button variant="secondary" disabled={busy} onClick={() => setExisting(undefined)}>取消</Button></div>}{generation && <p role="status" className="text-sm font-bold">{generation}</p>}</Card>}</>}</div>;
}

function DeliveryGroups({groups}:{groups:Component['groups']}) {
    if(!groups)return null;
    return <Card className="space-y-4 p-5"><h3 className="font-black">任务交付 D · 分组核对</h3><p className="text-sm leading-6 text-[#756d59]">下列权重在任务交付60%内部计算。每组按已确认难度加权；空组记0，不折算其他组。已提交待评保持待核定。学习清单这里只计算行动任务的交付，计划质量另计15%。</p><div className="grid gap-3 lg:grid-cols-3">{groups.map(g=><div key={g.key} className="rounded-xl border border-[#e6dfca] p-4"><h4 className="font-bold">{g.label} · {(g.weight*100).toFixed(0)}%</h4><p className="mt-3 text-2xl font-black">{g.score===null?'待核定':g.score.toFixed(2)}</p><p className="mt-2 text-sm">应交 {g.expected} · 已评 {g.reviewed} · 缺交 {g.missing}</p><p className="mt-2 text-sm text-[#756d59]">{g.expected===0?'本周无该类应交任务，按固定权重记0分':g.score===null?'等待验收、复核或事实核定':`计入D：${(g.score*g.weight).toFixed(2)}分`}</p></div>)}</div></Card>;
}
