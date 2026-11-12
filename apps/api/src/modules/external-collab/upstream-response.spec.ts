import { describe, expect, it } from 'vitest';
import { externalResponse } from './upstream-response.js';
describe('independent Fangpian and Tianji sessions', () => {
  it('does not turn a Tianji authorization expiry into a platform logout', () => {
    expect(externalResponse(401, '{"message":"expired"}')).toEqual({ status: 403, text: JSON.stringify({ code: 'TIANJI_AUTH_REQUIRED', message: '请重新验证本人的天玑身份' }) });
    expect(externalResponse(403, '{"message":"no permission"}')).toEqual({ status: 403, text: '{"message":"no permission"}' });
    expect(externalResponse(200, '{"ok":true}')).toEqual({ status: 200, text: '{"ok":true}' });
  });
});
