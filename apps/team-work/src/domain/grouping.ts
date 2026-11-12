import { dimNames, type Org, type Task } from './types'

/** 任务列表 / 甘特图共用的分组方式 */
export type GroupBy = 'none' | 'owner' | 'group' | 'cat' | 'type' | 'cattype'

/** 一个分组板块: 单层分组只有一个 label, 「板块 + 类型」时多一层 subs */
export type Section = {
  key: string
  label: string
  tasks: Task[]
  subs?: Array<{ key: string; label: string; tasks: Task[] }>
}

/** 按当前分组方式把顶级任务分桶 (列表视图和甘特视图共用同一套口径) */
export function buildSections(roots: Task[], groupBy: GroupBy, org: Org): Section[] {
  const dn = dimNames(org)
  if (groupBy === 'none') return [{ key: 'all', label: '', tasks: roots }]
  if (roots.length === 0) return []

  const bucket = (list: Task[], keyOf: (t: Task) => string) => {
    const map = new Map<string, Task[]>()
    for (const t of list) {
      const k = keyOf(t)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(t)
    }
    return map
  }

  // ── 两级: 先按板块, 板块内再按类型 ──────────────────────────────────
  if (groupBy === 'cattype') {
    const outer = bucket(roots, (t) => t.category || '__none__')
    return Array.from(outer.entries()).map(([catKey, list]) => {
      const inner = bucket(list, (t) => t.type || '__none__')
      return {
        key: catKey,
        label: catKey === '__none__' ? `未分${dn.cat}` : catKey,
        tasks: list,
        subs: Array.from(inner.entries()).map(([typeKey, sub]) => ({
          key: `${catKey}::${typeKey}`,
          label: typeKey === '__none__' ? `未设${dn.type}` : typeKey,
          tasks: sub,
        })),
      }
    })
  }

  // ── 单层 ────────────────────────────────────────────────────────
  const keyOf = (t: Task): string => {
    if (groupBy === 'owner') return t.ownerId || '__none__'
    if (groupBy === 'group') {
      return org.users.find((u) => u.id === t.ownerId)?.groupIds?.[0] || t.groupId || '__none__'
    }
    if (groupBy === 'cat') return t.category || '__none__'
    return t.type || '__none__'
  }
  const labelOf = (key: string): string => {
    if (key === '__none__') {
      return groupBy === 'cat' ? `未分${dn.cat}` : groupBy === 'type' ? `未设${dn.type}` : '未指派'
    }
    // 板块 / 类型的 key 本身就是标签文字
    if (groupBy === 'cat' || groupBy === 'type') return key
    if (groupBy === 'owner') return org.users.find((u) => u.id === key)?.name || '未知成员'
    return org.groups.find((g) => g.id === key)?.name || '未分组'
  }
  return Array.from(bucket(roots, keyOf).entries()).map(([key, list]) => ({ key, label: labelOf(key), tasks: list }))
}
