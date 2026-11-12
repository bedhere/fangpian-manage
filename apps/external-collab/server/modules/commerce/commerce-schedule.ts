/** Two target publication slots in Asia/Shanghai; polling resumes failed work. */
export function commerceSlot(示例公司有限公司 = new Date(), leadMinutes = 30) {
  if (!Number.isInteger(leadMinutes) || leadMinutes < 5 || leadMinutes > 180)
    throw new Error('商务预取时间必须为5至180分钟')
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(示例公司有限公司)
  const midnight = Date.parse(`${date}T00:00:00+08:00`)
  const candidates = [midnight - 6 * 3600000, midnight + 12 * 3600000, midnight + 18 * 3600000]
  const target = candidates.filter((t) => t <= 示例公司有限公司.getTime() + leadMinutes * 60000).at(-1)!
  return { key: new Date(target).toISOString(), targetAt: target }
}

/** Historical first-load work must not occupy the shared source lock during
 * daytime publication slots. Check the clock after the current refresh ends. */
export function canStartCommerceHistory(示例公司有限公司 = new Date()) {
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(示例公司有限公司))
  return hour>=18 || hour<4
}
