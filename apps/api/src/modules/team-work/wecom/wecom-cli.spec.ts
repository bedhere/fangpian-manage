import { describe, expect, it } from 'vitest';
import { WecomCli } from './wecom-cli.js';
const url =
  'https://doc.weixin.qq.com/smartsheet/s3_test?tab=sheet&viewId=view';
describe('official CLI boundary', () => {
  it('normalizes rows whose empty values object is omitted by the live API', async () => {
    const cli = new WecomCli(
      async (args) =>
        JSON.stringify(
          args[1] === 'sheets'
            ? {
                errcode: 0,
                name: '正确',
                sheets: [{ sheet_id: 'sheet', title: '卡点清单' }],
              }
            : args[1] === 'fields'
              ? { errcode: 0, fields: [] }
              : { errcode: 0, total: 1, records: [{ record_id: 'empty' }] },
        ),
      { url, organizationId: 'org', name: '正确' },
    );
    expect((await cli.read('org')).records).toEqual([
      { record_id: 'empty', values: {} },
    ]);
  });
  it('reads the verified document and correct tab, follows pagination and passes JSON without shell evaluation', async () => {
    const calls: any[] = [];
    const cli = new WecomCli(
      async (args) => {
        calls.push(args);
        const data = JSON.parse(args.at(-1)!);
        if (args[1] === 'sheets')
          return JSON.stringify({
            errcode: 0,
            name: '副本-吉米的项目进度甘特图',
            sheets: [
              { sheet_id: 'sheet', title: '卡点清单', is_readonly: false },
            ],
          });
        if (args[1] === 'fields')
          return JSON.stringify({
            errcode: 0,
            fields: [
              { field_id: 'title', field_title: '任务', field_type: 'text' },
            ],
          });
        return JSON.stringify({
          errcode: 0,
          records: [
            {
              record_id: data.cursor ? 'r2' : 'r1',
              values: { title: '$(evil)' },
            },
          ],
          has_more: !data.cursor,
          next_cursor: data.cursor ? '' : 'page2',
        });
      },
      { url, organizationId: 'org', name: '副本-吉米的项目进度甘特图' },
    );
    const result = await cli.read('org');
    expect(result.records.map((r) => r.record_id)).toEqual(['r1', 'r2']);
    expect(
      calls.filter((c) => c[1] === 'records').map((c) => JSON.parse(c.at(-1))),
    ).toMatchObject([
      { sheet_id: 'sheet', view_id: 'view', key_type: 'field_id' },
      { cursor: 'page2' },
    ]);
    await expect(cli.read('other')).rejects.toThrow(/组织/);
  });
  it('rejects renamed/wrong documents, repeated cursors and incomplete pagination rather than importing partial data', async () => {
    const cli = new WecomCli(
      async (args) =>
        JSON.stringify(
          args[1] === 'sheets'
            ? { errcode: 0, name: '错误文档', sheets: [{ sheet_id: 'sheet' }] }
            : {},
        ),
      { url, organizationId: 'org', name: '副本-吉米的项目进度甘特图' },
    );
    await expect(cli.read('org')).rejects.toThrow(/文档标题/);
    const stuck = new WecomCli(
      async (args) =>
        JSON.stringify(
          args[1] === 'sheets'
            ? { errcode: 0, name: '正确', sheets: [{ sheet_id: 'sheet' }] }
            : args[1] === 'fields'
              ? { errcode: 0, fields: [] }
              : {
                  errcode: 0,
                  records: [],
                  has_more: true,
                  next_cursor: 'same',
                },
        ),
      { url, organizationId: 'org', name: '正确' },
    );
    await expect(stuck.read('org')).rejects.toThrow(/分页/);
  });
  it('never returns CLI identity/secret details in application errors', async () => {
    const cli = new WecomCli(
      async () =>
        JSON.stringify({ errcode: 403, errmsg: 'secret-token-with-context' }),
      { url, organizationId: 'org', name: '正确' },
    );
    await expect(cli.read('org')).rejects.toThrow(
      '示例品牌请求失败（403），请核对授权和文档权限',
    );
  });
});
