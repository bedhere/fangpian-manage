import { Card } from '@fangpian/ui';
import Link from 'next/link';

export type RankingType = 'contribution' | 'bonus' | 's' | 'highValue' | 'crossDepartment' | 'aiEfficiency' | 'growth' | 'departmentActivity';
export type RankingRow = { rank: number; id: string; name: string; department: string; capabilityLevel: string; rankingValue: number; contributionScore: number; totalBonus?: number; sCount?: number };
const types: Array<{ id: RankingType; label: string }> = [{ id: 'contribution', label: '综合贡献' }, { id: 'bonus', label: '奖金' }, { id: 's', label: 'S 级项目' }, { id: 'highValue', label: '高价值项目' }, { id: 'crossDepartment', label: '跨部门协作' }, { id: 'aiEfficiency', label: 'AI 效率' }, { id: 'growth', label: '成长' }, { id: 'departmentActivity', label: '部门活跃' }];
export function RankingView({ type, rows, onTypeChange }: { type: RankingType; rows: RankingRow[]; onTypeChange: (type: RankingType) => void }) {
  return <div><div className="flex flex-wrap gap-2">{types.map((item) => <button key={item.id} onClick={() => onTypeChange(item.id)} className={`rounded-full px-4 py-2 text-sm font-black ${type === item.id ? 'bg-[#303030] text-white' : 'bg-[#ffd85f]'}`}>{item.label}</button>)}</div><div className="mt-6 grid gap-3">{rows.map((row) => <Card key={row.id} className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 p-5"><strong className="text-3xl">{row.rank}</strong><Link href={`/profile/${row.id}`} className="font-black">{row.name}<span className="mt-1 block text-xs font-normal text-[#777166]">{row.department} · {row.capabilityLevel}</span></Link><strong className="text-2xl">{row.rankingValue}</strong></Card>)}</div></div>;
}
