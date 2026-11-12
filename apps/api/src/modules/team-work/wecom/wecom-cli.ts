import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseWecomTarget } from './wecom-target.js';
import {
  autoMapping,
  type WecomRecord,
  type WecomField,
  type WecomSnapshot,
} from './wecom-model.js';

const execute = promisify(execFile);
type Runner = (args: string[]) => Promise<string>;
interface Config {
  url: string;
  organizationId: string;
  name: string;
}
/** The only process boundary. Every external value remains a single argv value; no shell. */
export class WecomCli {
  private readonly config: Config;
  private readonly runner: Runner;
  constructor(runner?: Runner, config?: Config) {
    this.config = config ?? {
      url: process.env.WECOM_TARGET_URL ?? '',
      organizationId: process.env.WECOM_ORGANIZATION_ID ?? '',
      name: process.env.WECOM_DOCUMENT_NAME ?? '',
    };
    this.runner =
      runner ??
      (async (args) => {
        try {
          const result = await execute(
            process.env.WECOM_CLI_BIN ?? '/usr/local/bin/wecom-cli',
            args,
            {
              timeout: 20000,
              maxBuffer: 16 * 1024 * 1024,
              encoding: 'utf8',
              env: {
                ...process.env,
                WECOM_CLI_CONFIG_DIR:
                  process.env.WECOM_CLI_CONFIG_DIR ??
                  '/home/node/.config/wecom-cli',
              },
            },
          );
          return result.stdout;
        } catch {
          throw new Error(
            '示例品牌连接超时或不可用，请核对授权后重试；写回失败时请先刷新预览确认结果',
          );
        }
      });
  }
  check(organizationId: string) {
    if (!this.config.url || !this.config.name || !this.config.organizationId)
      throw new Error('当前组织尚未配置示例品牌连接');
    if (organizationId !== this.config.organizationId)
      throw new Error('当前组织未连接这份示例品牌文档');
    return parseWecomTarget(this.config.url);
  }
  async status(organizationId: string) {
    const target = this.check(organizationId);
    const status = (await this.runner(['auth', 'show', '--status'])).trim();
    return {
      authorized: status === 'authorized',
      documentName: this.config.name,
      url: `https://doc.weixin.qq.com/smartsheet/${target.docid}?tab=${target.sheetId}${target.viewId ? '&viewId=' + target.viewId : ''}`,
    };
  }
  private async call(args: string[], input: unknown): Promise<any> {
    const raw = await this.runner([
      'smartsheet',
      ...args,
      '--json',
      JSON.stringify(input),
    ]);
    let result: any;
    try {
      result = JSON.parse(raw);
    } catch {
      throw new Error('示例品牌返回格式无效，请稍后重试');
    }
    if (result.errcode !== 0)
      throw new Error(
        `示例品牌请求失败（${Number.isFinite(result.errcode) ? result.errcode : '未知'}），请核对授权和文档权限`,
      );
    return result;
  }
  async read(organizationId: string): Promise<WecomSnapshot> {
    const t = this.check(organizationId),
      meta = await this.call(['sheets', 'list'], { docid: t.docid });
    if (meta.name !== this.config.name)
      throw new Error('文档标题与已确认目标不一致，请核对连接');
    const sheet = meta.sheets?.find(
      (s: any) => s.sheet_id === t.sheetId && s.type !== 'dashboard',
    );
    if (!sheet) throw new Error('链接中的工作表不存在或无法访问');
    const [fields, records] = await Promise.all([
      this.call(['fields', 'list'], {
        docid: t.docid,
        sheet_id: t.sheetId,
        type: 'fields',
        limit: 1000,
      }),
      this.records(organizationId),
    ]);
    if (!Array.isArray(fields.fields) || fields.has_more)
      throw new Error('字段列表不完整，请缩小工作表规模');
    return {
      docid: t.docid,
      sheetId: t.sheetId,
      documentName: meta.name,
      sheetTitle: sheet.title,
      readonly: sheet.is_readonly === true,
      fields: fields.fields as WecomField[],
      records,
      mapping: autoMapping(fields.fields),
    };
  }
  private async records(organizationId: string): Promise<WecomRecord[]> {
    const t = this.check(organizationId),
      out: WecomRecord[] = [],
      seen = new Set<string>();
    let cursor: string | undefined,
      start = 0;
    for (let page = 0; page < 10; page++) {
      const r = await this.call(['records', 'list'], {
        docid: t.docid,
        sheet_id: t.sheetId,
        ...(t.viewId ? { view_id: t.viewId } : {}),
        type: 'records',
        key_type: 'field_id',
        limit: 500,
        ...(cursor ? { cursor } : { start }),
      });
      if (!Array.isArray(r.records)) throw new Error('在线记录列表无效');
      out.push(
        ...r.records.map((row: any) => {
          if (
            typeof row.record_id !== 'string' ||
            !row.record_id ||
            (row.values != null &&
              (typeof row.values !== 'object' || Array.isArray(row.values)))
          )
            throw new Error('在线记录内容格式无效');
          return { record_id: row.record_id, values: row.values ?? {} };
        }),
      );
      const more =
        r.has_more === true ||
        (r.has_more !== false &&
          (!!r.next_cursor ||
            (typeof r.total === 'number' && out.length < r.total)));
      if (!more) return out;
      const next = r.next_cursor || String(r.next ?? out.length);
      if (seen.has(next) || !r.records.length)
        throw new Error('在线表格分页未前进，已停止读取，未导入部分数据');
      seen.add(next);
      cursor = r.next_cursor || undefined;
      start = r.next ?? out.length;
    }
    throw new Error('在线表格分页超过5000行，请拆分视图后重试');
  }
  async write(
    organizationId: string,
    records: Array<{ record_id: string; values: Record<string, unknown> }>,
  ) {
    const t = this.check(organizationId);
    if (!records.length || records.length > 100)
      throw new Error('每次写回请选择1至100条记录');
    return this.call(['records', 'update'], {
      docid: t.docid,
      sheet_id: t.sheetId,
      type: 'update',
      key_type: 'field_id',
      records,
    });
  }
}
