import { useState } from 'react';
import { parseTaskTags } from '../domain/tags';
import { api, navigateParent } from '../api/client';
import { dimsOf } from '../domain/types';
import { useApp } from '../store/AppProvider';
export function AdminView(_props: { embedded?: boolean }) {
  const { user, org, refresh, pushToast } = useApp();
  const [dims, setDims] = useState(() => dimsOf(org));
  const groups = org.groups.filter(group => user?.role === 'admin' && (user.managedDepartmentIds === undefined || user.managedDepartmentIds.includes(group.departmentId)));
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [dimId, setDimId] = useState('cat');
  const selectedGroup = groups.find(group => group.id === groupId);
  const currentTags = (selectedGroup?.dimTags?.[dimId] || (dimId === 'cat' ? selectedGroup?.categories : dimId === 'type' ? selectedGroup?.types : []) || []).join('，');
  const [draftTags, setDraftTags] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const globalAdmin = user?.role === 'admin' && user.managedDepartmentIds === undefined;
  async function save(path: string, body: unknown) {
    setBusy(true);
    try { await api.patch(path, body); await refresh(); pushToast({ title: '任务设置已保存', body: '', kind: 'info' }); }
    catch (error) { pushToast({ title: '保存失败', body: error instanceof Error ? error.message : '请重试', kind: 'error' }); }
    finally { setBusy(false); }
  }
  return <section className="setting-block">
    <h3>组织与权限</h3><p>成员、部门和权限由方片管理后台统一维护。</p><button className="btn" onClick={() => navigateParent('admin')}>打开方片管理后台</button>
    {globalAdmin && <section className="setting-block"><h3>任务分类维度</h3><p className="field-note">前两个维度保留用于板块与类型，其余维度可增加或移除。</p>{dims.map((dim, index) => <div className="quick-row" key={dim.id}><input className="input" aria-label={`维度名称 ${index + 1}`} value={dim.name} onChange={event => setDims(previous => previous.map(item => item.id === dim.id ? { ...item, name: event.target.value } : item))} />{index > 1 && <button className="btn sm" onClick={() => setDims(previous => previous.filter(item => item.id !== dim.id))}>移除</button>}</div>)}<button className="btn sm" onClick={() => setDims(previous => [...previous, { id: `dim_${crypto.randomUUID()}`, name: '新维度' }])}>增加维度</button><button className="btn primary" disabled={busy || dims.some(dim => !dim.name.trim())} onClick={() => save('/api/team-work/settings', { dims: dims.map(dim => ({ ...dim, name: dim.name.trim() })) })}>保存维度</button></section>}
    {!!groups.length && <section className="setting-block"><h3>部门任务标签</h3><div className="quick-row"><select className="input" aria-label="标签所属部门" value={groupId} onChange={event => { setGroupId(event.target.value); setDraftTags(null); }}>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select className="input" aria-label="标签分类维度" value={dimId} onChange={event => { setDimId(event.target.value); setDraftTags(null); }}>{dimsOf(org).map(dim => <option key={dim.id} value={dim.id}>{dim.name}</option>)}</select></div><textarea className="input" aria-label="部门任务标签" rows={3} placeholder="用逗号或换行分隔标签" value={draftTags ?? currentTags} onChange={event => setDraftTags(event.target.value)} /><button className="btn primary" disabled={busy || !groupId} onClick={() => save(`/api/team-work/groups/${encodeURIComponent(groupId)}/tags`, { dimId, tags: parseTaskTags(draftTags ?? currentTags) })}>保存标签</button></section>}
  </section>;
}
