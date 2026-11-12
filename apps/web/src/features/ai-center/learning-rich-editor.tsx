'use client';
import { useEffect, useMemo, useState } from 'react';
import { EditorContent, Extension, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import { learningPlainDocument, learningRichDocument, learningRichText, learningWebsite, type LearningRichDocument } from '@value-flow/domain/learning-note';
import styles from './learning-content.module.css';
import { field } from './types';
import { ErrorBox } from './ui';

export function LearningRichEditor({document,text,disabled,onChange}:{document?:LearningRichDocument;text:string;disabled:boolean;onChange:(document:LearningRichDocument,text:string)=>void}) {
  const [error,setError]=useState('');const [linkOpen,setLinkOpen]=useState(false);const [url,setUrl]=useState('');
  const desired=useMemo(()=>{if(document){try{return learningRichDocument(document);}catch{/* Preserve the available plain text for repairing an unsupported saved format. */}}return learningPlainDocument(text);},[document,text]);
  const limits=useMemo(()=>Extension.create({name:'learningContentLimits',addProseMirrorPlugins(){return [new Plugin({filterTransaction(transaction){
    if(!transaction.docChanged)return true;
    try{learningRichDocument(transaction.doc.toJSON());return true;}catch(reason){setError(reason instanceof Error?reason.message:'内容超过富文本限制');return false;}
  }})];}}),[]);
  const editor=useEditor({
    extensions:[StarterKit.configure({heading:{levels:[1,2,3]},link:{openOnClick:false,defaultProtocol:'https',protocols:['http','https'],isAllowedUri:href=>!!learningWebsite(href)}}),limits],
    content:desired,immediatelyRender:false,editable:!disabled,
    editorProps:{attributes:{class:`${styles.content} min-h-[220px] p-4 focus:outline-none`,role:'textbox','aria-label':'学习内容富文本编辑器','aria-multiline':'true'}},
    onUpdate:({editor:current})=>{const doc=learningRichDocument(current.getJSON());setError('');onChange(doc,learningRichText(doc));},
  });
  useEffect(()=>{editor?.setEditable(!disabled,false);},[editor,disabled]);
  useEffect(()=>{
    if(!editor)return;
    let current:string;
    try{current=JSON.stringify(learningRichDocument(editor.getJSON()));}catch{current=JSON.stringify(editor.getJSON());}
    if(current!==JSON.stringify(desired))editor.commands.setContent(desired,{emitUpdate:false});
  },[editor,desired]);
  const active=useEditorState({editor,selector:({editor:current})=>({bold:current?.isActive('bold')??false,italic:current?.isActive('italic')??false,underline:current?.isActive('underline')??false,heading:current?.isActive('heading',{level:2})??false,bullet:current?.isActive('bulletList')??false,ordered:current?.isActive('orderedList')??false,quote:current?.isActive('blockquote')??false})});
  function applyLink(){const href=learningWebsite(url);if(!href){setError('请输入有效HTTP或HTTPS网站');return;}editor?.chain().focus().extendMarkRange('link').setLink({href}).run();setLinkOpen(false);}
  const button='rounded-lg border border-[#ded7c1] bg-white px-3 py-1.5 text-sm font-bold aria-pressed:bg-[#ffe27b] disabled:opacity-40';
  function tool(label:string,pressed:boolean,run:()=>void){return <button key={label} type="button" className={button} disabled={disabled||!editor} aria-pressed={pressed} onMouseDown={e=>e.preventDefault()} onClick={run}>{label}</button>;}
  return <div className="space-y-3"><div className="overflow-hidden rounded-xl border border-[#ded7c1] bg-white">
    <div role="toolbar" aria-label="学习内容格式" className="flex flex-wrap gap-2 border-b border-[#e5decb] bg-[#f8f4e9] p-3">
      {tool('加粗',active?.bold??false,()=>editor?.chain().focus().toggleBold().run())}
      {tool('斜体',active?.italic??false,()=>editor?.chain().focus().toggleItalic().run())}
      {tool('下划线',active?.underline??false,()=>editor?.chain().focus().toggleUnderline().run())}
      {tool('标题',active?.heading??false,()=>editor?.chain().focus().toggleHeading({level:2}).run())}
      {tool('项目列表',active?.bullet??false,()=>editor?.chain().focus().toggleBulletList().run())}
      {tool('编号列表',active?.ordered??false,()=>editor?.chain().focus().toggleOrderedList().run())}
      {tool('引用',active?.quote??false,()=>editor?.chain().focus().toggleBlockquote().run())}
      {tool('链接',linkOpen,()=>{setUrl(String(editor?.getAttributes('link').href??''));setLinkOpen(v=>!v);})}
      {tool('撤销',false,()=>editor?.chain().focus().undo().run())}{tool('重做',false,()=>editor?.chain().focus().redo().run())}
    </div>
    {linkOpen&&<div className="flex flex-wrap items-end gap-2 border-b border-[#e5decb] p-3"><label className="min-w-48 flex-1 text-xs font-bold">链接网站<input className={field} maxLength={2048} disabled={disabled} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();applyLink();}}} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com"/></label><button type="button" className={button} disabled={disabled||!editor} onClick={applyLink}>插入链接</button><button type="button" className={button} disabled={disabled||!editor} onClick={()=>{editor?.chain().focus().extendMarkRange('link').unsetLink().run();setLinkOpen(false);}}>移除链接</button></div>}
    {editor?<EditorContent editor={editor}/>:<p role="status" className="p-4 text-sm text-[#756d59]">正在加载富文本编辑器…</p>}
  </div><ErrorBox message={error}/><p className="text-xs text-[#756d59]">学习内容最多30000字。可粘贴文字、设置格式与链接；相关文件仍可作为附件上传。</p></div>;
}
