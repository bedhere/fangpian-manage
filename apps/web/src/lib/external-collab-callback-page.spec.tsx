import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CallbackPage from '@/app/external-collab/tianji-callback/page';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); history.replaceState(null, '', '/'); });
it('delivers once under Strict Mode and removes the sensitive authorization query', () => {
  const postMessage = vi.fn();
  vi.stubGlobal('opener', { postMessage });
  vi.spyOn(window, 'close').mockImplementation(() => undefined);
  history.replaceState(null, '', `/external-collab/tianji-callback?code=oauth-code&state=${'a'.repeat(43)}`);
  render(<StrictMode><CallbackPage /></StrictMode>);
  expect(location.search).toBe('');
  expect(postMessage).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('授权结果已返回');
});
