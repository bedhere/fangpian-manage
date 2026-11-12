import Image from 'next/image';
import { createPortal } from 'react-dom';
import { Button } from '@fangpian/ui';
import { useEffect, useRef, useState } from 'react';
import { dateText, errorText, request, write, field, type Row, type Mutate } from './types';
import { useSessionStore } from '@/stores/session-store';
import { ErrorBox } from './ui';
import { RecordSnapshot } from './record-snapshot';
type FileMeta = {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    status: string;
    createdAt: string;
};
export function RecordTools({ row, busy, mutate, onUploadingChange, uploadTarget, attachmentsTarget }: {
    row: Row<unknown>;
    busy: boolean;
    mutate: Mutate;
    onUploadingChange?: (value: boolean) => void;
    uploadTarget?: HTMLElement | null;
    attachmentsTarget?: HTMLElement | null;
}) {
    const identityId = useSessionStore(s => s.identity?.id);
    const [open, setOpen] = useState(false);
    const [filesOpen, setFilesOpen] = useState(false);
    const [filesLoading, setFilesLoading] = useState(false);
    const showFiles = attachmentsTarget ? filesOpen : open;
    const [preview,setPreview]=useState<{url:string;file:FileMeta}>();
    const [files, setFiles] = useState<FileMeta[]>([]);
    const [history, setHistory] = useState<unknown[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [reason, setReason] = useState('');
    const [revision, setRevision] = useState(0);
    const xhrRef = useRef<XMLHttpRequest | null>(null);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; xhrRef.current?.abort(); }; }, []);
    useEffect(() => {
        if (!showFiles) return;
        const abort = new AbortController(); let active = true;
        void request<FileMeta[]>(`/records/${row.id}/files`, abort.signal)
            .then(result => { if (active) setFiles(result); })
            .catch(e => { if (active) setError(errorText(e)); })
            .finally(() => { if (active) setFilesLoading(false); });
        return () => { active = false; abort.abort(); };
    }, [showFiles, row.id, row.version, revision]);
    useEffect(() => {
        if (!open) return;
        const abort = new AbortController(); let active = true;
        void request<unknown[]>(`/records/${row.id}/history`, abort.signal)
            .then(result => { if (active) setHistory(result); })
            .catch(e => { if (active) setError(errorText(e)); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; abort.abort(); };
    }, [open, row.id, row.version]);
    async function upload(file: File) { setError(''); if (file.size > 500 * 1024 * 1024) {
        setError('单个附件不能超过500MB');
        return;
    } setProgress(0); onUploadingChange?.(true); try {
        const grant = await write<{
            file: FileMeta;
            uploadUrl: string;
        }>(`/records/${row.id}/files`, { filename: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, version: row.version });
        if (!alive.current)
            return;
        await new Promise<void>((resolve, reject) => { const xhr = new XMLHttpRequest(); xhrRef.current = xhr; xhr.open('PUT', grant.uploadUrl); xhr.withCredentials = false; xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream'); xhr.upload.onprogress = e => { if (alive.current && e.lengthComputable)
            setProgress(Math.round(e.loaded / e.total * 100)); }; xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`文件上传失败（${xhr.status}），请手动重试`)); xhr.onerror = () => reject(new Error('文件上传中断，请手动重试')); xhr.onabort = () => reject(new Error('上传已取消')); xhr.send(file); });
        if (!alive.current)
            return;
        await write(`/files/${grant.file.id}/complete`, {});
        if (alive.current) {
            if (showFiles) setFilesLoading(true);
            setRevision(v => v + 1);
        }
    }
    catch (e) {
        if (alive.current)
            setError(errorText(e));
    }
    finally {
        if (alive.current) {
            setProgress(null);
            onUploadingChange?.(false);
        }
        xhrRef.current = null;
    } }
    async function download(file: FileMeta, inline=false) { setError(''); try {
        const result = await request<{
            url: string;
            filename: string;
        }>(`/files/${file.id}/download`);
        if (!alive.current)
            return;
        if(inline){setPreview({url:result.url,file});return;}
        const anchor = document.createElement('a');
        anchor.href = result.url;
        anchor.download = result.filename;
        anchor.rel = 'noopener noreferrer';
        anchor.target = '_blank';
        anchor.click();
    }
    catch (e) {
        if (alive.current)
            setError(errorText(e));
    } }
    const attachable = row.canEdit && ['TASK', 'NOTE'].includes(row.kind) && ['DRAFT', 'OPEN', 'ACTIVE', 'RETURNED'].includes(row.status);
    const uploadControls = <>{attachable && <label className="mt-4 block text-sm font-bold">上传附件（单文件≤500MB；上传完成后再提交验收）<input className={field} type="file" disabled={progress !== null || busy} onChange={e => { const file = e.target.files?.[0]; if (file)
        void upload(file); e.target.value = ''; }}/></label>}{progress !== null && <div role="status"><progress className="w-full" value={progress} max={100}/><p className="text-sm">上传 {progress}%</p><Button type="button" variant="secondary" onClick={() => xhrRef.current?.abort()}>取消上传</Button></div>}</>;
    const filePanel = <div className="space-y-3">{filesLoading && <p role="status" className="text-sm">正在读取附件…</p>}<h4 className="font-black">附件</h4>{files.length === 0 && !filesLoading && <p className="mt-2 text-sm text-[#756d59]">暂无附件</p>}{files.map(f => <div key={f.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="break-all">{f.filename} · {(f.size / 1024 / 1024).toFixed(2)}MB · {f.status}</span><div className="flex flex-wrap gap-2">{(/^(image|audio|video)\//.test(f.mimeType)||f.mimeType==='application/pdf')&&<Button type="button" variant="secondary" disabled={f.status!=='READY'} onClick={()=>void download(f,true)}>预览</Button>}<Button type="button" variant="secondary" disabled={f.status !== 'READY'} onClick={() => void download(f)}>下载原文件</Button></div></div>)}{preview&&<div className="space-y-3 rounded-xl border border-[#e6dfca] p-4"><div className="flex flex-wrap justify-between gap-2"><p className="break-all text-sm font-bold">{preview.file.filename}</p><Button type="button" variant="secondary" onClick={()=>setPreview(undefined)}>关闭预览</Button></div>{preview.file.mimeType.startsWith('image/')?<Image unoptimized src={preview.url} alt={preview.file.filename} width={1200} height={900} className="max-h-[70vh] w-full object-contain"/>:preview.file.mimeType.startsWith('audio/')?<audio controls className="w-full" src={preview.url}/>:preview.file.mimeType.startsWith('video/')?<video controls className="max-h-[70vh] w-full" src={preview.url}/>:<iframe sandbox="" referrerPolicy="no-referrer" title={preview.file.filename} className="h-[65vh] w-full" src={preview.url}/>}<p className="text-xs text-[#756d59]">如浏览器不支持此格式或链接已过期，请重新预览或下载原文件。</p></div>}</div>;
    const deliveryFiles = attachmentsTarget ? createPortal(<section className="mt-3 space-y-3" aria-label="交付附件">
        <Button type="button" variant="secondary" onClick={() => {
            if (!filesOpen) { setFilesLoading(true); setError(''); }
            setFilesOpen(value => !value);
        }}>{filesOpen ? '收起附件' : '查看附件'}</Button>
        {!uploadTarget && <ErrorBox message={error}/>}
        {filesOpen && filePanel}
        {!uploadTarget && uploadControls}
    </section>, attachmentsTarget) : null;
    const deliveryUpload = uploadTarget ? createPortal(<div className="space-y-3"><ErrorBox message={error}/>{uploadControls}{revision > 0 && progress === null && !error && <p role="status" className="text-sm text-[#23785c]">附件上传完成，可继续添加附件或提交导师验收。</p>}</div>, uploadTarget) : null;
    return <>{deliveryUpload}{deliveryFiles}<div className="mt-5 border-t border-[#e9e3d2] pt-4"><Button variant="secondary" type="button" onClick={() => { if (!open) {
        setLoading(true);
        if (!attachmentsTarget) setFilesLoading(true);
        setError('');
    } setOpen(v => !v); }}>{attachmentsTarget ? (open ? '收起评分历史与复核' : '评分历史与复核') : (open ? '收起附件与版本' : '附件、评分历史与复核')}</Button>{open && <div className="mt-4 space-y-4">{!uploadTarget && !attachmentsTarget && <ErrorBox message={error}/>}{loading && <p role="status">正在读取评分历史…</p>}{!attachmentsTarget && filePanel}{!uploadTarget && !attachmentsTarget && uploadControls}<details><summary className="cursor-pointer font-black">历史版本（{history.length}）</summary>{history.map((h, i) => <RecordSnapshot key={i} value={h}/>)}<p className="mt-2 text-xs text-[#756d59]">当前版本 v{row.version} · 最后更新 {dateText(row.updatedAt)}</p></details>{row.ownerId === identityId && ['TASK', 'IVY', 'NOTE'].includes(row.kind) && <form onSubmit={e => { e.preventDefault(); void mutate(`/records/${row.id}/appeal`, { version: row.version, reason }).then(ok => { if (ok)
        setReason(''); }); }}><label className="block text-sm font-bold">申请复核的具体依据<textarea required className={field} value={reason} onChange={e => setReason(e.target.value)}/></label><Button className="mt-3" disabled={busy || !reason.trim()}>提交复核申请</Button></form>}</div>}</div></>;
}
