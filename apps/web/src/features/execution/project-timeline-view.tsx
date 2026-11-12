'use client';
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';

import SlideCommit from '../../components/feedback/slide-commit';

import { Card } from '@fangpian/ui';
import { useEffect, useRef, useState } from 'react';
import { dateKey, datePosition, nodeStatusLabels, rangeTicks, sortNodes, timelineRange, type TimelineNode } from './timeline-types';

type Action = (name: string, payload?: unknown) => Promise<void>;
export function ProjectTimelineView({ nodes, progress, canEdit, onAction }: { nodes: TimelineNode[]; progress: number; canEdit: boolean; onAction: Action }) {
  const [editing, setEditing] = useState<TimelineNode | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  function edit(node: TimelineNode | 'new') { setNotice(''); setEditing(node); }
  const sorted = sortNodes(nodes);
  const dated = sorted.filter((node) => node.scheduledAt);
  const range = timelineRange(dated.map((node) => node.scheduledAt!));
  const groups = new Map<string, TimelineNode[]>();
  for (const node of dated) {
    const key = dateKey(node.scheduledAt!);
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  return <Card className="fp-timeline p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="fp-timeline-eyebrow">PROJECT TIMELINE</p><h2 className="mt-1 text-2xl font-black">项目进度时间轴</h2><p className="mt-2 text-sm text-[var(--fp-ink-soft)]">从项目开始到结束，完整呈现每个关键节点。</p></div>{canEdit ? <button className="fp-timeline-primary" onClick={() => edit('new')}><span aria-hidden="true">＋ </span>新增时间节点</button> : <span className="fp-node-status">仅负责人可编辑节点</span>}</div>
    {notice ? <p role="status" className="mt-4 rounded-xl bg-[var(--fp-yellow-soft)] px-4 py-3 text-sm font-bold">✓ {notice}</p> : null}
    <div className="mt-6 flex items-end justify-between"><span className="text-sm font-bold">整体进度</span><strong className="text-3xl font-black">{progress}%</strong></div>
    <div role="progressbar" aria-label="项目整体进度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="fp-progress-track mt-3"><div style={{ width: `${progress}%` }} /></div>
    {dated.length ? <div className="mt-7 overflow-x-auto"><div className="fp-date-rail"><div className="fp-date-rail-line" />{[...groups].map(([date, items]) => <a key={date} href={`#timeline-node-${items[0].id}`} className="fp-date-marker" style={{ left: `${datePosition(date, range)}%` }} title={`${date} · ${items.map((node) => node.title).join('、')}`} aria-label={`${date}：${items.map((node) => node.title).join('、')}`}><span className={items.every((node) => node.status === 'COMPLETED') ? 'is-completed' : ''}>{items.length > 1 ? items.length : '●'}</span></a>)}{rangeTicks(range).map((tick, index) => <time key={index} className={`fp-date-tick fp-date-tick-${index}`} style={{ left: `${tick.position}%` }}>{tick.label}</time>)}</div></div> : <p className="mt-6 rounded-2xl bg-[var(--fp-yellow-soft)] p-4 text-sm">尚未安排节点日期，负责人设置后将在日期轴上展示。</p>}
    <ol className="fp-node-list mt-6">{sorted.map((node) => <li key={node.id} id={`timeline-node-${node.id}`} className={`fp-node-row fp-node-${node.status.toLowerCase()}`}>
      <div className="fp-node-dot" /><div className="fp-node-date">{node.scheduledAt ? <time dateTime={dateKey(node.scheduledAt)}>{dateKey(node.scheduledAt)}</time> : <span>待安排</span>}</div>
      <div className="fp-node-card"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{node.title}</h3>{node.defaultKey ? <span className="text-xs text-[var(--fp-ink-soft)]">默认节点</span> : null}</div><div className="flex items-center gap-3"><span className="fp-node-status">{nodeStatusLabels[node.status]}</span>{canEdit ? <button className="fp-timeline-text-button" aria-label={`编辑${node.title}`} onClick={() => edit(node)}>编辑</button> : null}</div></div>{node.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--fp-ink-soft)]">{node.description}</p> : null}</div>
    </li>)}</ol>
    {editing ? <TimelineNodeEditor node={editing === 'new' ? null : editing} onAction={onAction} onSaved={(removed) => setNotice(removed ? '节点已删除。' : '节点已保存。')} onClose={() => setEditing(null)} /> : null}
  </Card>;
}

function TimelineNodeEditor({ node, onAction, onClose, onSaved }: { node: TimelineNode | null; onAction: Action; onClose: () => void; onSaved: (removed: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(node?.title ?? '');
  const [date, setDate] = useState(node?.scheduledAt ? dateKey(node.scheduledAt) : '');
  const [description, setDescription] = useState(node?.description ?? '');
  const [status, setStatus] = useState<TimelineNode['status']>(node?.status ?? 'PENDING');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    if (element?.showModal) element.showModal(); else element?.setAttribute('open', '');
    return () => { element?.close?.(); trigger?.focus(); };
  }, []);
  async function save(remove = false) {
    if (!remove && title.trim().length < 2) { setError('节点名称至少两个字符'); return false; }
    setPending(true); setError('');
    try {
      await onAction(remove ? 'delete-timeline-node' : 'save-timeline-node', remove ? { nodeId: node!.id } : { nodeId: node?.id ?? null, title: title.trim(), date: date || null, description: description.trim(), status });
      onSaved(remove);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败，请重试'); return false; }
    finally { setPending(false); }
  }
  return <dialog ref={dialog} className="fp-node-dialog" aria-labelledby="node-editor-title" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <FeedbackForm onSubmit={(event) => { event.preventDefault(); return save(); }} className="space-y-4">
      <div className="flex items-center justify-between"><h2 id="node-editor-title" className="text-xl font-black">{node ? '编辑时间节点' : '新增时间节点'}</h2><button type="button" className="fp-timeline-text-button" disabled={pending} onClick={onClose}>关闭</button></div>
      <label className="fp-node-field">节点名称<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={120} readOnly={Boolean(node?.defaultKey)} /></label>
      <label className="fp-node-field">节点日期<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><p className="text-xs text-[var(--fp-ink-soft)]">可暂不安排日期。四个默认节点的日期需按阶段先后排列。</p>
      <label className="fp-node-field">节点状态<select value={status} onChange={(event) => setStatus(event.target.value as TimelineNode['status'])}>{Object.entries(nodeStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="fp-node-field">节点说明<textarea value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {deleting ? <div className="rounded-xl bg-red-50 p-4"><p className="text-sm">确定删除“{node?.title}”？</p><div className="mt-3 flex flex-wrap items-center gap-3"><SlideCommit label="滑动确认删除" doneLabel="已删除" disabled={pending} onConfirm={() => save(true)} /><button type="button" disabled={pending} className="fp-timeline-text-button" onClick={() => setDeleting(false)}>取消删除</button></div></div> : null}
      <div className="flex items-center justify-between gap-3">{node && !node.defaultKey ? <button type="button" disabled={pending} className="fp-timeline-danger" onClick={() => setDeleting(true)}>删除节点</button> : <span className="text-xs text-[var(--fp-ink-soft)]">{node?.defaultKey ? '默认节点保留' : '新增项目关键节点'}</span>}<FeedbackButton successLabel="已保存" disabled={pending || deleting} className="fp-timeline-primary">{pending ? '正在保存…' : '保存节点'}</FeedbackButton></div>
    </FeedbackForm>
  </dialog>;
}
