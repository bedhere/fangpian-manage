/** 示例品牌 arbitrary user URLs away from the connector's transport and command arguments. */
export function parseWecomTarget(input: string) {
  if (
    typeof input !== 'string' ||
    input.length > 2400 ||
    /[\\\r\n]/.test(input)
  )
    throw new Error('请粘贴有效的示例品牌智能表格链接');
  const url = new URL(input.trim());
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'doc.weixin.qq.com' ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error('仅支持示例品牌智能表格的HTTPS链接');
  }
  const match = /^\/smartsheet\/(s3_[a-zA-Z0-9_-]+)\/?$/.exec(url.pathname);
  if (!match) throw new Error('请提供示例品牌智能表格链接');
  for (const key of ['tab', 'viewId', 'scode'])
    if (url.searchParams.getAll(key).length > 1)
      throw new Error('链接包含重复参数，请从示例品牌重新复制');
  const sheetId = url.searchParams.get('tab') || '';
  const viewId = url.searchParams.get('viewId') || undefined;
  if (
    !/^[a-zA-Z0-9_-]{1,128}$/.test(sheetId) ||
    (viewId && !/^[a-zA-Z0-9_-]{1,128}$/.test(viewId))
  )
    throw new Error('链接缺少有效的工作表编号');
  const canonical = new URL(`https://doc.weixin.qq.com/smartsheet/${match[1]}`);
  const scode = url.searchParams.get('scode');
  if (scode) {
    if (scode.length > 256) throw new Error('分享参数无效');
    canonical.searchParams.set('scode', scode);
  }
  canonical.searchParams.set('tab', sheetId);
  if (viewId) canonical.searchParams.set('viewId', viewId);
  return {
    docid: match[1],
    sheetId,
    viewId,
    url: canonical.toString(),
    identity: `${match[1]}::${sheetId}`,
  };
}

/** Only known visible text fields become labels; opaque IDs are never names. */
export function wecomCellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number')
    return String(value).trim();
  if (Array.isArray(value))
    return value.map(wecomCellText).filter(Boolean).join('、');
  if (typeof value === 'object') {
    const cell = value as Record<string, unknown>;
    const text = cell.text ?? cell.userName ?? cell.name;
    return typeof text === 'string' ? text.trim() : '';
  }
  return '';
}

/** The field's scale must come from its real schema, never the numeric value alone. */
export function wecomProgress(
  value: unknown,
  fieldType: 'progress' | 'percentage',
): number | undefined {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && !value.trim())
  )
    return undefined;
  if (typeof value !== 'number' && typeof value !== 'string')
    throw new Error('进度字段不是数值');
  const text = String(value).trim();
  const percentText = text.endsWith('%');
  const raw = Number(percentText ? text.slice(0, -1) : text);
  const progress = fieldType === 'percentage' && !percentText ? raw * 100 : raw;
  if (!Number.isFinite(progress) || progress < 0 || progress > 100)
    throw new Error('进度须为0至100，百分数字段须为0至1');
  return Math.round(progress * 1e8) / 1e8;
}
