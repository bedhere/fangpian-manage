import { describe, expect, it, vi } from 'vitest';
import { deliverTianjiCallback } from './external-collab-callback';
describe('public Tianji popup callback', () => {
  const state = 'a'.repeat(43);
  function fixture(search: string) {
    const postMessage = vi.fn();
    const replaceState = vi.fn();
    return { postMessage, replaceState, host: { location: { search, pathname: '/external-collab/tianji-callback', origin: 'https://fp.test' }, history: { replaceState }, opener: { postMessage } } as unknown as Window };
  }
  it('scrubs the code before sending only code/state to the same-origin opener', () => {
    const f = fixture(`?code=secret-code&state=${state}&unexpected=ignored`);
    expect(deliverTianjiCallback(f.host)).toBe('delivered');
    expect(f.replaceState).toHaveBeenCalledWith(null, '', '/external-collab/tianji-callback');
    expect(f.postMessage).toHaveBeenCalledWith({ source: 'fangpian-tianji-sso', params: { code: 'secret-code', state } }, 'https://fp.test');
    expect(f.replaceState.mock.invocationCallOrder[0]).toBeLessThan(f.postMessage.mock.invocationCallOrder[0]);
  });
  it('rejects invalid states and oversized codes after scrubbing the URL', () => {
    for (const search of ['?code=x&state=short', `?code=${'x'.repeat(2049)}&state=${state}`, `?code=x&state=${state}&state=${state}`]) {
      const f = fixture(search);
      expect(deliverTianjiCallback(f.host)).toBe('invalid');
      expect(f.replaceState).toHaveBeenCalled();
      expect(f.postMessage).not.toHaveBeenCalled();
    }
  });
  it('forwards only allowlisted OAuth errors without descriptions or identity data', () => {
    const f = fixture(`?error=access_denied&error_description=secret&state=${state}`);
    expect(deliverTianjiCallback(f.host)).toBe('delivered');
    expect(f.postMessage.mock.calls[0][0]).toEqual({ source: 'fangpian-tianji-sso', params: { error: 'access_denied', state } });
    expect(deliverTianjiCallback(fixture(`?error=arbitrary&state=${state}`).host)).toBe('invalid');
  });
});
