import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const componentPath = '@external-collab/TianjiLoginPage';
const { default: TianjiLoginPage } = await import(/* @vite-ignore */ componentPath);
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Tianji popup verification', () => {
  it('keeps retry B active when timed-out start A returns late', async () => {
    vi.useFakeTimers();
    const popupA = { location: { href: '' }, closed: false, close: vi.fn() } as unknown as Window;
    const popupB = { location: { href: '' }, closed: false, close: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValueOnce(popupA).mockReturnValueOnce(popupB);
    let resolveA!: (response: Response) => void;
    const consent = (state: string) => Response.json({ consentUrl: 'https://identity.test/consent', state: state.repeat(43), callbackOrigin: location.origin, messageSource: 'fangpian-tianji-sso' });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveA = resolve; }))
      .mockResolvedValueOnce(consent('b'))
      .mockResolvedValueOnce(Response.json({ message: 'B callback reached' }, { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TianjiLoginPage />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' })); });
    act(() => vi.advanceTimersByTime(120_000));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' })); });
    expect(popupB.location.href).toBe('https://identity.test/consent');
    await act(async () => { resolveA(consent('a')); });
    await act(async () => {
      fireEvent(window, new MessageEvent('message', { source: popupB, origin: location.origin, data: { source: 'fangpian-tianji-sso', params: { code: 'code-b', state: 'b'.repeat(43) } } }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ code: 'code-b', state: 'b'.repeat(43) });
    expect(screen.getByRole('alert')).toHaveTextContent('B callback reached');
  });
  it('ignores a timed-out start rejection while retry B is waiting for consent', async () => {
    vi.useFakeTimers();
    const popup = () => ({ location: { href: '' }, closed: false, close: vi.fn() }) as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValueOnce(popup()).mockReturnValueOnce(popup());
    let rejectA!: (error: Error) => void;
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((_resolve, reject) => { rejectA = reject; }))
      .mockResolvedValueOnce(Response.json({ consentUrl: 'https://identity.test/consent', state: 'b'.repeat(43), callbackOrigin: location.origin, messageSource: 'fangpian-tianji-sso' })));
    render(<TianjiLoginPage />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' })); });
    act(() => vi.advanceTimersByTime(120_000));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' })); });
    await act(async () => { rejectA(new Error('stale A failed')); });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: '正在打开天玑授权…' })).toBeDisabled();
  });
  it('cancels a pending start on unmount and ignores its eventual response', async () => {
    const popup = { location: { href: '' }, closed: false, close: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    let resolveStart!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { resolveStart = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const page = render(<TianjiLoginPage />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' })); });
    page.unmount();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(popup.close).toHaveBeenCalled();
    await act(async () => { resolveStart(Response.json({ consentUrl: 'https://identity.test/consent', state: 'a'.repeat(43), callbackOrigin: location.origin, messageSource: 'fangpian-tianji-sso' })); });
    expect(popup.location.href).toBe('');
  });
  it('ignores a stale response JSON continuation after timeout and retry', async () => {
    vi.useFakeTimers();
    const popupA = { location: { href: '' }, closed: false, close: vi.fn() } as unknown as Window;
    const popupB = { location: { href: '' }, closed: false, close: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValueOnce(popupA).mockReturnValueOnce(popupB);
    let resolveJson!: (body: unknown) => void;
    const consent = (state: string) => ({ consentUrl: 'https://identity.test/consent', state: state.repeat(43), callbackOrigin: location.origin, messageSource: 'fangpian-tianji-sso' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => new Promise((resolve) => { resolveJson = resolve; }) })
      .mockResolvedValueOnce(Response.json(consent('b')))
      .mockResolvedValueOnce(Response.json({ message: 'B JSON callback reached' }, { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TianjiLoginPage />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' })); });
    act(() => vi.advanceTimersByTime(120_000));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' })); });
    await act(async () => { resolveJson(consent('a')); });
    await act(async () => { fireEvent(window, new MessageEvent('message', { source: popupB, origin: location.origin, data: { source: 'fangpian-tianji-sso', params: { code: 'code-b', state: 'b'.repeat(43) } } })); });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('alert')).toHaveTextContent('B JSON callback reached');
    expect(popupA.location.href).toBe('');
  });
  it('recovers from a missing authorization return instead of leaving the button disabled forever', async () => {
    vi.useFakeTimers();
    const popup = { location: { href: '' }, closed: false, close: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ consentUrl: 'https://identity.test/consent', state: 'a'.repeat(43), callbackOrigin: location.origin, messageSource: 'fangpian-tianji-sso' })));
    render(<TianjiLoginPage />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' })); });
    act(() => vi.advanceTimersByTime(120_000));
    expect(screen.getByRole('alert')).toHaveTextContent('授权等待超时');
    expect(screen.getByRole('button', { name: '前往天玑授权并继续' })).toBeEnabled();
    expect(popup.close).toHaveBeenCalled();
  });
  it('shows the verified platform display name so the user can authorize the same person', () => {
    render(<TianjiLoginPage expectedName="示例员工1106" />);
    expect(screen.getByText('当前方片账号：示例员工1106，请使用同一人员的天玑账号授权。')).toBeVisible();
  });
  it('keeps the login page usable when the optional platform display name is unavailable', () => {
    render(<TianjiLoginPage />);
    expect(screen.getByRole('button', { name: '前往天玑授权并继续' })).toBeVisible();
    expect(screen.queryByText(/当前方片账号：/)).toBeNull();
  });
  it('binds the code exchange to the server-issued state and rejects foreign popup messages', async () => {
    const popup = { location: { href: '' }, closed: false, close: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ consentUrl: 'https://identity.test/consent', state: 'a'.repeat(43), callbackOrigin: location.origin, messageSource: 'fangpian-tianji-sso' }))
      .mockResolvedValueOnce(Response.json({ message: '授权码无效' }, { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<TianjiLoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' }));
    await waitFor(() => expect(popup.location.href).toBe('https://identity.test/consent'));
    const data = { source: 'fangpian-tianji-sso', params: { code: 'delegate-code', state: 'a'.repeat(43) } };
    fireEvent(window, new MessageEvent('message', { source: window, origin: location.origin, data }));
    fireEvent(window, new MessageEvent('message', { source: popup, origin: 'https://evil.test', data }));
    fireEvent(window, new MessageEvent('message', { source: popup, origin: location.origin, data: { ...data, params: { ...data.params, state: 'b'.repeat(43) } } }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent(window, new MessageEvent('message', { source: popup, origin: location.origin, data }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ code: 'delegate-code', state: 'a'.repeat(43) });
    expect(await screen.findByRole('alert')).toHaveTextContent('授权码无效');
    expect(screen.queryByText('身份核验成功，正在进入看板…')).toBeNull();
    fireEvent(window, new MessageEvent('message', { source: popup, origin: location.origin, data }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('rejects a consent response with no bound state and closes the popup', async () => {
    const popup = { location: { href: '' }, close: vi.fn(), closed: false } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ consentUrl: 'https://identity.test/consent' })));
    render(<TianjiLoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '前往天玑授权并继续' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法获取天玑授权页面');
    expect(popup.close).toHaveBeenCalled();
    expect(popup.location.href).toBe('');
  });
});





