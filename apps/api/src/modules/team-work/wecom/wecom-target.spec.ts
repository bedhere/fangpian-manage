import { describe, expect, it } from 'vitest';
import {
  parseWecomTarget,
  wecomCellText,
  wecomProgress,
} from './wecom-target.js';

describe('WeCom smart-sheet target and cells', () => {
  it('keeps the supplied worksheet and view while deduplicating the same source across share links', () => {
    const first = parseWecomTarget(
      'https://doc.weixin.qq.com/smartsheet/s3_Example?scode=share1&tab=q979lj&viewId=view1',
    );
    const second = parseWecomTarget(
      'https://doc.weixin.qq.com/smartsheet/s3_Example?scode=share2&tab=q979lj&viewId=view2',
    );
    expect(first).toMatchObject({
      docid: 's3_Example',
      sheetId: 'q979lj',
      viewId: 'view1',
    });
    expect(first.identity).toBe(second.identity);
    expect(
      parseWecomTarget(
        'https://doc.weixin.qq.com/smartsheet/s3_Example?tab=other',
      ).identity,
    ).not.toBe(first.identity);
  });
  it.each([
    'http://doc.weixin.qq.com/smartsheet/s3_Example?tab=a',
    'https://doc.weixin.qq.com.evil.example/smartsheet/s3_Example?tab=a',
    'https://attacker@doc.weixin.qq.com/smartsheet/s3_Example?tab=a',
    'https://doc.weixin.qq.com:444/smartsheet/s3_Example?tab=a',
    'https://doc.weixin.qq.com/sheet/s3_Example?tab=a',
    'https://doc.weixin.qq.com/smartsheet/s3_Example',
    'https://doc.weixin.qq.com/smartsheet/s3_Example?tab=a&tab=b',
  ])('rejects ambiguous or non-WeCom targets: %s', (url) =>
    expect(() => parseWecomTarget(url)).toThrow(),
  );
  it('reads plain and structured text/person/selection cells without fabricating object names', () => {
    expect(wecomCellText([{ text: '任务名称' }])).toBe('任务名称');
    expect(
      wecomCellText([
        { userName: '示例员工0101', userId: 'member' },
        { name: '协助人' },
      ]),
    ).toBe('示例员工0101、协助人');
    expect(wecomCellText([{ text: 'P0', id: 'option' }])).toBe('P0');
    expect(wecomCellText({ record_id: 'record' })).toBe('');
  });
  it('distinguishes blank values, zero, progress and percentage field scales', () => {
    expect(wecomProgress(null, 'progress')).toBeUndefined();
    expect(wecomProgress('', 'percentage')).toBeUndefined();
    expect(wecomProgress(0, 'percentage')).toBe(0);
    expect(wecomProgress(0.85, 'percentage')).toBe(85);
    expect(wecomProgress(0.85, 'progress')).toBe(0.85);
    expect(wecomProgress('85%', 'percentage')).toBe(85);
    expect(() => wecomProgress('进行中', 'progress')).toThrow();
    expect(() => wecomProgress(1.1, 'percentage')).toThrow();
    expect(() => wecomProgress(-5, 'progress')).toThrow();
  });
});
