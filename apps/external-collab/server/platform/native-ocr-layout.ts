interface GrayImage { width: number; height: number; pixels: Buffer }
interface TableLayout { columns: number[]; rows: number[] }
interface PreparedTable extends GrayImage { scale: number; layout: TableLayout }
const MAX_PIXELS = 16_000_000
/** Native model boxes stay in original image coordinates; no cell values are inferred. */
export function rapidToTsv(output:string):{tsv:string;text:string} {
  const parsed=JSON.parse(output)
  if(!Array.isArray(parsed?.results)||parsed.results.length>8192)throw new Error('Invalid OCR output')
  const words:{left:number;top:number;width:number;height:number;text:string;confidence:number}[]=[]
  for(const result of parsed.results) {
    if(!Array.isArray(result)||result.length!==3)continue
    const [box,value,score]=result
    if(!Array.isArray(box)||box.length!==4||typeof value!=='string'||typeof score!=='number'||!Number.isFinite(score)||score<0||score>1)continue
    if(box.some(point=>!Array.isArray(point)||point.length!==2||point.some(n=>typeof n!=='number'||!Number.isFinite(n))))continue
    const xs=box.map(point=>point[0]),ys=box.map(point=>point[1])
    const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top
    const text=value.replace(/[\t\r\n]/g,' ').trim()
    if(!text||text.length>16_384||width<=0||height<=0||left<0||top<0||left+width>10000||top+height>10000)continue
    words.push({left,top,width,height,text,confidence:score*100})
  }
  words.sort((a,b)=>a.top-b.top||a.left-b.left)
  const lines:typeof words[]=[]
  for(const word of words) {
    const line=lines.find(line=>Math.abs(line[0].top+line[0].height/2-word.top-word.height/2)<=Math.min(line[0].height,word.height)/2)
    if(line)line.push(word);else lines.push([word])
  }
  const text=lines.map(line=>line.sort((a,b)=>a.left-b.left).map(word=>word.text).join(' ')).join('\n')
  const tsv=words.map((word,i)=>`5\t1\t1\t1\t1\t${i+1}\t${word.left}\t${word.top}\t${word.width}\t${word.height}\t${word.confidence}\t${word.text}`).join('\n')
  return {tsv,text}
}
/** ImageMagick emits one bounded, 8-bit P5 frame; never scan binary pixels as tokens. */
export function readPgm(bytes: Buffer, expectedWidth: number, expectedHeight: number): GrayImage {
  let offset=0
  const token=()=>{
    while(offset<bytes.length) {
      if(bytes[offset]===35) { while(offset<bytes.length&&bytes[offset]!==10)offset++; continue }
      if(bytes[offset]<=32) { offset++; continue }
      break
    }
    const start=offset; while(offset<bytes.length&&bytes[offset]>32&&bytes[offset]!==35)offset++
    return bytes.toString('ascii',start,offset)
  }
  if(token()!=='P5')throw new Error('Invalid grayscale image')
  const width=Number(token()),height=Number(token()),maximum=Number(token())
  if(width!==expectedWidth||height!==expectedHeight||width*height>MAX_PIXELS||maximum!==255||bytes[offset]>32)throw new Error('Invalid grayscale dimensions')
  // A single whitespace delimiter ends the header. A pixel may itself be LF or space.
  if(bytes[offset]===13&&bytes[offset+1]===10)offset+=2; else offset++
  if(bytes.length-offset!==width*height)throw new Error('Invalid grayscale pixels')
  return {width,height,pixels:bytes.subarray(offset)}
}
function bands(indices: number[]): number[][] {
  const groups:number[][]=[]
  for(const n of indices) { const group=groups[groups.length-1]; if(group&&n===group[group.length-1]+1)group.push(n); else groups.push([n]) }
  return groups
}
function boundaries(groups:number[][],length:number):number[] {
  const lines=groups.map(group=>Math.round((group[0]+group[group.length-1])/2))
  if(lines.length<3)return []
  const gaps=lines.slice(1).map((line,i)=>line-lines[i]).sort((a,b)=>a-b)
  const typical=gaps[Math.floor(gaps.length/2)]
  // Screenshots commonly omit their right/bottom outside rule. Only extend one cell.
  if(lines[0]>=typical*.45&&lines[0]<=typical*1.8)lines.unshift(0)
  const gap=length-1-lines[lines.length-1]
  if(gap>=typical*.45&&gap<=typical*1.8)lines.push(length-1)
  return lines
}
/** Detect actual long rules, retaining physical geometry instead of guessing columns from spaces. */
export function prepareTableImage(image: GrayImage): PreparedTable | null {
  const {width,height,pixels}=image
  if(width*height>MAX_PIXELS||pixels.length!==width*height)throw new Error('Invalid grayscale dimensions')
  const vertical=new Uint32Array(width),horizontal=new Uint32Array(height)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[y*width+x]<80){vertical[x]++;horizontal[y]++}
  const xRules=bands(Array.from(vertical,(count,x)=>count>=height*.60?x:-1).filter(x=>x>=0))
  const yRules=bands(Array.from(horizontal,(count,y)=>count>=width*.60?y:-1).filter(y=>y>=0))
  const columns=boundaries(xRules,width),rows=boundaries(yRules,height)
  if(columns.length<3||rows.length<3||columns.length>65||rows.length>101)return null
  if(columns.slice(1).some((x,i)=>x-columns[i]<8)||rows.slice(1).some((y,i)=>y-rows[i]<5))return null
  const scale=Math.max(1,Math.min(4,Math.floor(Math.sqrt(MAX_PIXELS/(width*height))),Math.floor(10000/Math.max(width,height))))
  const outputWidth=width*scale,outputHeight=height*scale,ink=Buffer.alloc(width*height,255)
  const removeX=new Set(xRules.flat()),removeY=new Set(yRules.flat())
  for(let r=0;r<rows.length-1;r++)for(let c=0;c<columns.length-1;c++) {
    const histogram=new Uint32Array(256); let count=0
    for(let y=rows[r]+1;y<rows[r+1];y++)for(let x=columns[c]+1;x<columns[c+1];x++) {histogram[pixels[y*width+x]]++;count++}
    let background=0,cumulative=0
    while(background<255&&(cumulative+=histogram[background])<count*.90)background++
    const threshold=background*.87
    for(let y=rows[r]+1;y<rows[r+1];y++)for(let x=columns[c]+1;x<columns[c+1];x++) {
      if(removeX.has(x)||removeY.has(y)||pixels[y*width+x]>=threshold)continue
      ink[y*width+x]=0
    }
  }
  const output=scale===1?ink:Buffer.alloc(outputWidth*outputHeight)
  // Interpolate edges rather than enlarging small bitmap strokes into hard square blocks.
  if(scale>1)for(let y=0;y<outputHeight;y++) {
    const sy=y/scale,y0=Math.floor(sy),y1=Math.min(height-1,y0+1),fy=sy-y0
    for(let x=0;x<outputWidth;x++) {
      const sx=x/scale,x0=Math.floor(sx),x1=Math.min(width-1,x0+1),fx=sx-x0
      const a=ink[y0*width+x0]*(1-fx)+ink[y0*width+x1]*fx
      const b=ink[y1*width+x0]*(1-fx)+ink[y1*width+x1]*fx
      output[y*outputWidth+x]=Math.round(a*(1-fy)+b*fy)
    }
  }
  return {width:outputWidth,height:outputHeight,pixels:output,scale,layout:{columns,rows}}
}
/** Map TSV words by their centers, keeping empty cells rather than shifting following values left. */
export function tableFromTsv(tsv:string,prepared:PreparedTable):string {
  const {columns,rows}=prepared.layout,scale=prepared.scale
  const cells=Array.from({length:rows.length-1},()=>Array.from({length:columns.length-1},()=>[] as {left:number;top:number;text:string}[]))
  const cellIndex=(lines:number[],center:number)=>lines.findIndex((line,i)=>i<lines.length-1&&center>=line&&center<lines[i+1])
  for(const line of tsv.split(/\r?\n/)) {
    const fields=line.split('\t'); if(fields[0]!=='5'||fields.length<12)continue
    const [left,top,width,height,confidence]=fields.slice(6,11).map(Number),text=fields.slice(11).join('\t').trim()
    if(!text||![left,top,width,height,confidence].every(Number.isFinite)||width<=0||height<=0||confidence<0)continue
    const c=cellIndex(columns,(left+width/2)/scale),r=cellIndex(rows,(top+height/2)/scale)
    if(r>=0&&c>=0)cells[r][c].push({left,top,text})
  }
  const rendered=cells.map(row=>row.map(words=>words.sort((a,b)=>a.left-b.left||a.top-b.top).map(word=>word.text).join('').replace(/\|/g,'\\|')))
  if(rendered.filter(row=>row.some(Boolean)).length<2)return ''
  const row=(values:string[])=>'| '+values.join(' | ')+' |'
  return [row(rendered[0]),row(columns.slice(1).map(()=>'---')),...rendered.slice(1).map(row)].join('\n')
}
