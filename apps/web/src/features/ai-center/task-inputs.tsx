import { field,type Grade,type Priority } from './types';
import { GradeSelect } from './ui';
export type TaskFields = {
    title: string;
    description: string;
    acceptanceCriteria: string;
    priority: Priority;
    dueAt: string;
    selfDifficulty: Grade;
};
export const blankTask = (): TaskFields => ({ title: '', description: '', acceptanceCriteria: '', priority: 'P2', dueAt: '', selfDifficulty: 'B' });
export function TaskInputs({ value, onChange, difficulty = false }: {
    value: TaskFields;
    onChange: (v: TaskFields) => void;
    difficulty?: boolean;
}) { function set<K extends keyof TaskFields>(key: K, v: TaskFields[K]) { onChange({ ...value, [key]: v }); } return <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold sm:col-span-2">任务标题<input required maxLength={200} className={field} value={value.title} onChange={e => set('title', e.target.value)}/></label><label className="block text-sm font-bold sm:col-span-2">简介：服务目标、使用者与预期产出<textarea required maxLength={12000} className={field} value={value.description} onChange={e => set('description', e.target.value)}/></label><label className="block text-sm font-bold sm:col-span-2">验收标准与投入边界<textarea required maxLength={12000} className={field} value={value.acceptanceCriteria} onChange={e => set('acceptanceCriteria', e.target.value)}/></label><label className="block text-sm font-bold">优先级<select className={field} value={value.priority} onChange={e => set('priority', e.target.value as Priority)}>{['P0', 'P1', 'P2', 'P3'].map(p => <option key={p}>{p}</option>)}</select></label><label className="block text-sm font-bold">预计交付日期（设备时区）<input required type="datetime-local" className={field} value={value.dueAt} onChange={e => set('dueAt', e.target.value)}/></label>{difficulty && <GradeSelect label="难度自评（审批前可改）" value={value.selfDifficulty} onChange={v => set('selfDifficulty', v)}/>}</div>; }
