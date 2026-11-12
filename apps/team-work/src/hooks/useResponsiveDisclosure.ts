import { useEffect, useState } from 'react'

/** 示例品牌 explicit choices on this device; otherwise follow the available viewport. */
export function useResponsiveDisclosure(key: string, compactQuery: string) {
  const [manual, setManual] = useState<boolean | null>(() => {
    try { const saved = localStorage.getItem(key); return saved === null ? null : saved === 'true' } catch { return null }
  })
  const [automatic, setAutomatic] = useState(true)
  useEffect(() => {
    const media = window.matchMedia?.(compactQuery)
    if (!media) return
    const update = () => setAutomatic(!media.matches)
    update(); media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [compactQuery])
  const expanded = manual ?? automatic
  return [expanded, () => {
    setManual(!expanded)
    try { localStorage.setItem(key, String(!expanded)) } catch { /* Retain the current in-memory choice. */ }
  }] as const
}
