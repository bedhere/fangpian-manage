// 把工作整理成表格导出。
// 用 CSV (带 UTF-8 BOM, Excel 打开不乱码) —— 表格软件里能直接排序/筛选/再加工,
// 也避免了引入 xlsx 这类体积不小的依赖。

/** 逗号分隔的表格: 值里的引号/逗号/换行按 RFC4180 转义 */
export function toCsv(rows: string[][]): string {
  const cell = (v: string) => {
    const s = v ?? ''
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

/** 触发下载 (BOM + CSV) */
export function downloadCsv(filename: string, rows: string[][]) {
  const text = '\uFEFF' + toCsv(rows)
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 交给浏览器读完再回收
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const EXPORT_HEADERS = [
  '任务',
  '层级',
  '板块',
  '类型',
  '优先级',
  '进度',
  '状态',
  '派发人',
  '执行人',
  '截止日期',
  '完成时间',
  '记录时间',
  '子任务',
  '备注',
]

/** 'YYYY-MM-DD' (本机时区) */
export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

