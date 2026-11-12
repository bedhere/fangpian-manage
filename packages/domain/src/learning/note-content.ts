export type LearningRichMark={type:'bold'|'italic'|'underline'|'strike'|'code'|'link';attrs?:{href:string}};
export type LearningRichNode={type:string;text?:string;attrs?:{level?:number;start?:number;language?:null};marks?:LearningRichMark[];content?:LearningRichNode[]};
export type LearningRichDocument=LearningRichNode&{type:'doc'};

/** User navigation only; never fetches a resource. Only HTTP(S), without embedded credentials. */
export function learningWebsite(value:string):string|null {
  const raw=value.trim();if(!raw||raw.length>2048||/[\s\u0000-\u001f\u007f\\]/u.test(raw))return null;
  const candidate=/^https?:\/\//i.test(raw)?raw:/^[^/:?#]+(?:\.[^/:?#]+)+(?:[/:?#]|$)/u.test(raw)?'https://'+raw:'';
  if(!candidate)return null;
  try{const u=new URL(candidate);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!!u.hostname&&u.href.length<=2048?u.href:null;}catch{return null;}
}

/** Rebuild a bounded allowlisted document. Unknown nodes/attributes never become HTML. */
export function learningRichDocument(value:unknown):LearningRichDocument {
  if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>220000)throw new Error('富文本内容过大或格式无效');
  let count=0,textLength=0;
  function node(input:unknown,depth:number,parent:string):LearningRichNode {
    if(++count>4000||depth>16||!input||typeof input!=='object'||Array.isArray(input))throw new Error('富文本层级或节点数量超出限制');
    const n=input as Record<string,unknown>;const type=n.type;
    if(typeof type!=='string'||!['doc','paragraph','heading','text','hardBreak','bulletList','orderedList','listItem','blockquote','codeBlock','horizontalRule'].includes(type))throw new Error('富文本包含不支持的内容');
    const inline=['paragraph','heading','codeBlock'].includes(parent);
    if(type==='doc'&&parent!==''||type!=='doc'&&parent===''||['text','hardBreak'].includes(type)&&!inline||type==='listItem'&&!['bulletList','orderedList'].includes(parent)||['bulletList','orderedList'].includes(parent)&&type!=='listItem'||inline&&!['text','hardBreak'].includes(type))throw new Error('富文本结构无效');
    if(type==='text'){
      if(typeof n.text!=='string'||!n.text||n.content!==undefined)throw new Error('富文本文字格式无效');
      textLength+=n.text.length;if(textLength>30000)throw new Error('学习内容不能超过30000字');
      const marks:LearningRichMark[]=[];
      if(n.marks!==undefined){if(!Array.isArray(n.marks)||n.marks.length>6)throw new Error('富文本样式无效');
        for(const raw of n.marks){
          if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('富文本样式无效');
          const m=raw as Record<string,unknown>;if(!['bold','italic','underline','strike','code','link'].includes(String(m.type)))throw new Error('不支持的文字样式');
          if(m.type==='link'){const attrs=m.attrs as {href?:unknown}|undefined;const href=typeof attrs?.href==='string'?learningWebsite(attrs.href):null;if(!href)throw new Error('请使用有效HTTP或HTTPS链接');marks.push({type:'link',attrs:{href}});}
          else marks.push({type:m.type as LearningRichMark['type']});
        }
      }
      return {type,text:n.text,...(marks.length?{marks}:{})};
    }
    if(type==='hardBreak'||type==='horizontalRule'){if(n.content!==undefined||n.text!==undefined)throw new Error('富文本结构无效');return {type};}
    if(n.text!==undefined||n.content!==undefined&&!Array.isArray(n.content))throw new Error('富文本结构无效');
    const content=(n.content as unknown[]|undefined??[]).map(child=>node(child,depth+1,type));
    if(['doc','bulletList','orderedList','listItem'].includes(type)&&content.length===0)throw new Error('富文本结构不完整');
    const attrs=n.attrs&&typeof n.attrs==='object'?n.attrs as Record<string,unknown>:{};
    if(type==='heading'){const level=attrs.level;if(![1,2,3].includes(Number(level)))throw new Error('标题级别仅支持1至3');return {type,attrs:{level:Number(level)},...(content.length?{content}:{})};}
    if(type==='orderedList'){const start=attrs.start??1;if(!Number.isInteger(start)||Number(start)<1||Number(start)>100000)throw new Error('列表起始编号无效');return {type,attrs:{start:Number(start)},content};}
    return {type,...(type==='codeBlock'?{attrs:{language:null}}:{}),...(content.length?{content}:{})};
  }
  const doc=node(value,0,'') as LearningRichDocument;
  if(learningRichText(doc).length>30000)throw new Error('学习内容不能超过30000字');
  return doc;
}
export function learningRichText(node:LearningRichNode):string {
  if(node.type==='text')return node.text??'';
  if(node.type==='hardBreak')return '\n';
  return (node.content??[]).map(learningRichText).join(['paragraph','heading','codeBlock'].includes(node.type)?'':'\n');
}
export function learningPlainDocument(text:string):LearningRichDocument {
  return {type:'doc',content:text.replace(/\r\n?/g,'\n').split('\n').map(line=>({type:'paragraph',...(line?{content:[{type:'text',text:line}]}:{})}))};
}
