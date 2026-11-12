import type { ReactNode } from 'react';
import { learningRichDocument, learningWebsite, type LearningRichDocument, type LearningRichNode } from '@value-flow/domain/learning-note';
import styles from './learning-content.module.css';

export function NoteWebsites({values}:{values:string[]}) {
  return <div className="flex flex-wrap gap-2">{values.filter(v=>v.trim()).map((value,i)=>{const href=learningWebsite(value);return href?<a key={i} href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title={href} className="max-w-full break-all rounded-full border border-[#e6d69b] bg-[#fff5ce] px-3 py-1.5 text-sm font-bold text-[#806015] underline underline-offset-2">{value} ↗</a>:<span key={i} className="max-w-full break-all rounded-full bg-[#f1eee6] px-3 py-1.5 text-sm">{value}（网址待补全）</span>;})}</div>;
}
function render(node:LearningRichNode,key:string):ReactNode {
  if(node.type==='text'){
    let result:ReactNode=node.text??'';
    for(const [i,mark] of (node.marks??[]).entries()){
      const k=key+':m'+i;
      if(mark.type==='bold')result=<strong key={k}>{result}</strong>;
      else if(mark.type==='italic')result=<em key={k}>{result}</em>;
      else if(mark.type==='underline')result=<u key={k}>{result}</u>;
      else if(mark.type==='strike')result=<s key={k}>{result}</s>;
      else if(mark.type==='code')result=<code key={k}>{result}</code>;
      else if(mark.type==='link'){const href=learningWebsite(mark.attrs?.href??'');if(href)result=<a key={k} href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{result}</a>;}
    }
    return <span key={key}>{result}</span>;
  }
  const children=node.content?.map((child,i)=>render(child,key+':'+i));
  switch(node.type){
    case 'doc':return <div key={key}>{children}</div>;
    case 'paragraph':return <p key={key}>{children?.length?children:<br/>}</p>;
    case 'heading':return node.attrs?.level===1?<h1 key={key}>{children}</h1>:node.attrs?.level===2?<h2 key={key}>{children}</h2>:<h3 key={key}>{children}</h3>;
    case 'bulletList':return <ul key={key}>{children}</ul>;
    case 'orderedList':return <ol key={key} start={node.attrs?.start??1}>{children}</ol>;
    case 'listItem':return <li key={key}>{children}</li>;
    case 'blockquote':return <blockquote key={key}>{children}</blockquote>;
    case 'codeBlock':return <pre key={key}><code>{children}</code></pre>;
    case 'hardBreak':return <br key={key}/>;
    case 'horizontalRule':return <hr key={key}/>;
    default:return null;
  }
}
export function LearningContent({document,text}:{document?:LearningRichDocument;text:string}) {
  let safe:LearningRichDocument|undefined;
  if(document){try{safe=learningRichDocument(document);}catch{/* 示例品牌 the legacy plain text available if a stored document cannot be displayed. */}}
  if(safe)return <div className={styles.content}>{render(safe,'doc')}</div>;
  return <p className="whitespace-pre-wrap break-words text-sm leading-7">{text}</p>;
}
