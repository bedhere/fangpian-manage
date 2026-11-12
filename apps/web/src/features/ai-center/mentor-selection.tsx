import { Button } from '@fangpian/ui';
import { useState } from 'react';
import { field,type Workspace } from './types';
export function mentorSelectionValid(data:Workspace,ownerId:string|null,ai:string,departments:string[]){
 const employees=data.people.filter(p=>p.active&&p.employee&&p.id!==ownerId);
 const validAi=employees.some(p=>p.id===ai&&p.departmentId===data.aiDepartmentId);
 const invalidDepartments=departments.filter(id=>!employees.some(p=>p.id===id));
 const duplicate=!!ai&&departments.includes(ai);
 return {validAi,invalidDepartments,duplicate,complete:validAi&&departments.length>0&&!duplicate&&!invalidDepartments.length};
}
export function MentorSelection({data,ownerId,ai,setAi,departments,setDepartments,busy,required=true}:{data:Workspace;ownerId:string|null;ai:string;setAi:(value:string)=>void;departments:string[];setDepartments:import('react').Dispatch<import('react').SetStateAction<string[]>>;busy:boolean;required?:boolean}){
    const [departmentFilter,setDepartmentFilter]=useState('ALL');
    const [search,setSearch]=useState('');
    const employees=data.people.filter(p=>p.active&&p.employee&&p.id!==ownerId).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
    const aiEmployees=employees.filter(p=>p.departmentId===data.aiDepartmentId);
    const validAi=aiEmployees.some(p=>p.id===ai);
    const invalidDepartments=departments.filter(id=>!employees.some(p=>p.id===id));
    const duplicate=!!ai&&departments.includes(ai);
    
    const departmentOptions=[...new Map(employees.filter(p=>p.departmentId).map(p=>[p.departmentId!,p.departmentName??'未命名部门'])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'zh-CN'));
    const query=search.normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase();
    const filtered=employees.filter(p=>(departmentFilter==='ALL'||(departmentFilter==='UNASSIGNED'?!p.departmentId:p.departmentId===departmentFilter))&&p.name.normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase().includes(query));
    const remove=(id:string)=>setDepartments(values=>values.filter(value=>value!==id));
return <div className="space-y-4">        <label className="block text-sm font-bold">AI导师（1名，仅AI部门）<select required={required} disabled={busy} className={field} value={validAi?ai:''} onChange={e=>setAi(e.target.value)}><option value="">请选择AI导师</option>{aiEmployees.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {!aiEmployees.length&&<p className="text-sm text-[#756d59]">当前没有可选择的AI部门导师。</p>}
        {!!ai&&!validAi&&<div role="status" className="rounded-xl bg-[#fff5cc] p-3 text-sm">已保存的AI导师：{data.people.find(p=>p.id===ai)?.name??'已停用或已删除人员'}。该人员不在有效AI部门候选中，原配置已保留，请重新选择后保存。<Button type="button" variant="secondary" className="mt-2" disabled={busy} onClick={()=>setAi('')}>清除这项无效选择</Button></div>}
        <fieldset className="rounded-xl border border-[#e6dfca] p-4">
          <legend className="px-2 text-sm font-bold">部门导师（至少1名，可多选任意部门）</legend>
          <div className="space-y-3"><p className="text-sm font-bold">已选 {departments.length} 人</p><div className="flex flex-wrap gap-2">{departments.map(id=>{const person=employees.find(p=>p.id===id);return <span key={id} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-[#fff1bc] px-3 py-2 text-sm"><span className="break-words">{person?`${person.name} · ${person.departmentName??'未分配部门'}`:'已停用或已删除导师（需替换）'}</span><button type="button" disabled={busy} className="shrink-0 font-bold disabled:opacity-40" aria-label={`移除${person?.name??'无效导师'}`} onClick={()=>remove(id)}>×</button></span>;})}{!departments.length&&<span className="text-sm text-[#756d59]">尚未选择部门导师</span>}</div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">按部门筛选<select className={field} disabled={busy} value={departmentFilter} onChange={e=>setDepartmentFilter(e.target.value)}><option value="ALL">全部部门</option>{departmentOptions.map(([id,name])=><option key={id} value={id}>{name}</option>)}{employees.some(p=>!p.departmentId)&&<option value="UNASSIGNED">未分配部门</option>}</select></label><label className="text-sm font-bold">搜索人名<input type="search" className={field} disabled={busy} placeholder="输入姓名，快速查找" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
          <p className="text-xs text-[#756d59]">当前显示 {filtered.length} 人，筛选和搜索不会移除已选导师。</p>
          <div className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">{filtered.map(p=><label key={p.id} className="flex items-start gap-2 rounded-xl p-2 text-sm hover:bg-[#faf6e9]"><input className="mt-1" type="checkbox" disabled={busy||(p.id===ai&&!departments.includes(p.id))} checked={departments.includes(p.id)} onChange={e=>setDepartments(values=>e.target.checked?[...new Set([...values,p.id])]:values.filter(id=>id!==p.id))}/><span className="break-words">{p.name} · {p.departmentName??'未分配部门'}{p.id===ai?'（已选为AI导师）':''}</span></label>)}</div>{!filtered.length&&<p className="rounded-xl bg-[#f7f5ee] p-3 text-sm text-[#756d59]">未找到匹配人员，可更换部门或姓名关键词。</p>}
          </div>
        </fieldset>
        {duplicate&&<p role="alert" className="text-sm text-red-800">AI导师与部门导师不能是同一人，请调整已选人员。</p>}
        {!!invalidDepartments.length&&<p role="status" className="text-sm text-red-800">已选导师中有停用人员，请移除并补选；其余已保存配置保留。</p>}
</div>;
}
