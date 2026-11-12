import type { Org } from './types'

/** 认不出关键词时用的兜底标签 */
export const FALLBACK_TAG = '其他'

/**
 * 按任务名自动认「板块 / 类型」。
 * 规则很克制: 只在名字里真的出现标签关键词时才填, 认不出来就留空 (绝不瞎猜)。
 *   1) 名字里**原样包含**某个标签 → 直接命中 (标签越长越优先)
 *   2) 退一步: 标签里有一段 (≥2 个字) 连着出现在名字里 → 也算命中
 *      (例如标签「物料设计」遇到标题「方片·物料-宿舍门牌」→ 命中「物料」)
 * 板块和类型各自独立匹配, 可以只命中一个。
 */

/** 标签去重 (一示例公司有限公司可以在多个组里, 各组的标签会重复) */
function tagsOf(org: Org, kind: 'categories' | 'types'): string[] {
  const set = new Set<string>()
  for (const g of org.groups) for (const t of g[kind] || []) set.add(String(t).trim())
  return Array.from(set).filter(Boolean)
}

/** 两个字符串的最长公共连续子串长度 (都很短, 直接朴素跑) */
function longestCommonRun(a: string, b: string): number {
  let best = 0
  const prev = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    for (let j = b.length; j >= 1; j--) {
      prev[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : 0
      if (prev[j] > best) best = prev[j]
    }
  }
  return best
}

/**
 * 按任务名自动认**每个分类维度**的标签 (维度是动态的, 有几维就认几维)。
 * 认不出来就给兜底「其他」(调用方可以只在需要时用)。
 */
export function detectDims(title: string, org: Org, dims: Array<{ id: string }>): Record<string, string> {
  const name = (title || '').replace(/\s+/g, '')
  const out: Record<string, string> = {}
  if (!name) return out
  for (const dim of dims) out[dim.id] = pickTag(name, tagsForDim(org, dim.id)) || FALLBACK_TAG
  return out
}

/** 某维度下所有小组的标签 (去重) */
function tagsForDim(org: Org, dimId: string): string[] {
  const set = new Set<string>()
  for (const g of org.groups) {
    const fromMap = (g as any).dimTags?.[dimId]
    const list: string[] = Array.isArray(fromMap)
      ? fromMap
      : dimId === 'cat'
        ? g.categories || []
        : dimId === 'type'
          ? g.types || []
          : []
    for (const t of list) set.add(String(t).trim())
  }
  return Array.from(set).filter(Boolean)
}

/** 老接口: 只认内置的两个维度 (小窗还在用) */
export function detectTags(title: string, org: Org): { category: string; type: string } {
  const hit = detectDims(title, org, [{ id: 'cat' }, { id: 'type' }])
  return { category: hit.cat || '', type: hit.type || '' }
}

function pickTag(name: string, tags: string[]): string {
  let best: { tag: string; score: number; exact: boolean; pos: number } | null = null
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, '')
    const exact = name.includes(tag)
    const score = exact ? tag.length : longestCommonRun(name, tag)
    if (!exact && score < 2) continue
    const pos = exact ? name.indexOf(tag) : name.indexOf('') // 部分命中给个靠后的位置
    const better =
      !best ||
      // 原样包含优先于「部分命中」
      (exact && !best.exact) ||
      (exact === best.exact &&
        // 同类里取命中最长的; 一样长就取在名字里出现更早的
        (score > best.score || (score === best.score && pos < best.pos)))
    if (better) best = { tag: raw, score, exact, pos }
  }
  return best ? best.tag : ''
}
