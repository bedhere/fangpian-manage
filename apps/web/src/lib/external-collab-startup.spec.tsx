import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Runtime import keeps the separate Vite application's TS config out of Next's compilation.
const componentPath = '@external-collab/DashboardRoot';
const { default: DashboardRoot } = await import(/* @vite-ignore */ componentPath);
vi.mock('../../../external-collab/client/src/CommerceBoard', () => ({ default: () => <div>业务看板内容</div> }));
vi.mock('../../../external-collab/client/src/App', () => ({ default: () => <div>原看板已保存业绩</div> }));
vi.mock('../../../external-collab/client/src/TianjiLoginPage', () => ({ default: ({ expectedName }: { expectedName?: string }) => <div>天玑官方身份验证{expectedName ? <span>需授权本人：{expectedName}</span> : null}</div> }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());
describe('external collaboration startup identity gate', () => {
  it('passes the server-verified platform name to the Tianji login screen', async () => {
    fetchMock.mockResolvedValue(Response.json({ authenticated: false, configured: true, businessConfigured: true, platformDisplayName: '示例员工1106' }));
    render(<DashboardRoot />);
    expect(await screen.findByText('需授权本人：示例员工1106')).toBeVisible();
  });
  it('shows a connection setup state and never renders the dashboard when cloud configuration is missing', async () => {
    fetchMock.mockImplementation(async () => Response.json({ authenticated: false, identity: null, configured: false, missingConfiguration: ['天玑授权连接'] }));
    render(<DashboardRoot />);
    expect(await screen.findByRole('heading', { name: '天玑连接待配置' })).toBeVisible();
    expect(screen.queryByText('待配置项：天玑授权连接')).toBeNull();
    expect(screen.getByText('天玑连接尚待管理员完成应用登记。配置完成后重新检查即可。')).toBeVisible();
    expect(screen.queryByText('业务看板内容')).toBeNull();
    expect(screen.queryByText('天玑官方身份验证')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重新检查连接' }));
    expect(await screen.findByRole('heading', { name: '天玑连接待配置' })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('requires Tianji verification even when the platform session already exists', async () => {
    fetchMock.mockResolvedValue(Response.json({ authenticated: false, identity: null, configured: true }));
    render(<DashboardRoot />);
    expect(await screen.findByText('天玑官方身份验证')).toBeVisible();
    expect(screen.queryByText('业务看板内容')).toBeNull();
  });
  it('shows the commerce dashboard only after verified identity', async () => {
    fetchMock.mockResolvedValue(Response.json({ authenticated: true, configured: true, identity: { employeeId: 123, name: '已验证员工' } }));
    render(<DashboardRoot />);
    expect(await screen.findByText('业务看板内容')).toBeVisible();
  });
  it('allows official identity verification while clearly distinguishing an unconfigured business connection', async () => {
    fetchMock.mockResolvedValue(Response.json({ authenticated: true, configured: true, businessConfigured: false, identity: { employeeId: 123, name: '已验证员工' } }));
    render(<DashboardRoot />);
    expect(await screen.findByText('业务数据待连接')).toBeVisible();
    expect(screen.getByText('业务看板内容')).toBeVisible();
    expect(screen.getByText('当前仅可读取已保存的完整快照。同步能力取决于本人及后台账号的实际天玑授权。')).toBeVisible();
    expect(screen.queryByText(/在线导入需先完成云端业务连接配置/)).toBeNull();
  });
  it('keeps network errors recoverable and hides business content', async () => {
    fetchMock.mockRejectedValue(new Error('Network unavailable'));
    render(<DashboardRoot />);
    expect(await screen.findByRole('heading', { name: '暂时无法检查登录状态' }, { timeout: 3000 })).toBeVisible();
    expect(screen.getByRole('button', { name: '重新检查' })).toBeVisible();
    expect(screen.queryByText('业务看板内容')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('recovers from a temporary identity service failure without stranding the user on an error card', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: '天玑身份核验暂时不可用' }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ authenticated: true, configured: true, businessConfigured: true, identity: { employeeId: 123, name: '已验证员工' } }));
    render(<DashboardRoot />);
    expect(await screen.findByText('业务看板内容', {}, { timeout: 3000 })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('heading', { name: '暂时无法检查登录状态' })).toBeNull();
  });
  it('does not retry an expired platform session or expose business data', async () => {
    fetchMock.mockResolvedValue(Response.json({ message: '请登录' }, { status: 401 }));
    render(<DashboardRoot />);
    expect(await screen.findByText('方片登录已失效，请重新登录方片后进入商务。')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('业务看板内容')).toBeNull();
  });
  it('does not retry Tianji rate limits or mistake them for expired authorization', async () => {
    fetchMock.mockResolvedValue(Response.json({ code: 'TIANJI_RATE_LIMITED', message: 'limited' }, { status: 503 }));
    render(<DashboardRoot />);
    expect(await screen.findByText('天玑接口频率受限，已暂停请求，请稍后重新检查。')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('业务看板内容')).toBeNull();
  });
  it('cancels an unfinished session check when the module closes', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const page = render(<DashboardRoot />);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal?.aborted).toBe(false);
    page.unmount();
    expect(signal.aborted).toBe(true);
  });
  it('returns only to Tianji verification when the business identity expires', async () => {
    fetchMock.mockResolvedValue(Response.json({ authenticated: true, configured: true, businessConfigured: true, identity: { employeeId: 123, name: '已验证员工' } }));
    render(<DashboardRoot />);
    expect(await screen.findByText('业务看板内容')).toBeVisible();
    fireEvent(window, new Event('external-collab:tianji-auth-required'));
    expect(await screen.findByText('天玑官方身份验证')).toBeVisible();
    expect(screen.queryByText('业务看板内容')).toBeNull();
    expect(screen.queryByText('请先登录方片账号')).toBeNull();
  });
  it('keeps existing saved dashboard data visible while the first new snapshot is absent', async () => {
    fetchMock.mockImplementation(async (route:string)=>Response.json(route.endsWith('/catalog') ? {periods:[{id:150,kind:'month',start:0,end:9999999999}]} : route.includes('/status?') ? {batchId:null} : {authenticated:true,configured:true,businessConfigured:true,identity:{employeeId:275,employeeName:'示例开发01'}}));
    render(<DashboardRoot />);
    expect(await screen.findByText('原看板已保存业绩')).toBeVisible();
    expect(screen.getByText('正在显示原看板已有数据')).toBeVisible();
    expect(screen.queryByText('业务看板内容')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'查看新版商务看板'}));
    expect(await screen.findByText('业务看板内容')).toBeVisible();
  });
  it('opens the new dashboard normally when a complete snapshot exists', async () => {
    fetchMock.mockImplementation(async (route:string)=>Response.json(route.endsWith('/catalog') ? {periods:[{id:150,kind:'month',start:0,end:9999999999}]} : route.includes('/status?') ? {batchId:'commerce-verified'} : {authenticated:true,configured:true,businessConfigured:true,identity:{employeeId:275,employeeName:'示例开发01'}}));
    render(<DashboardRoot />);
    expect(await screen.findByText('业务看板内容')).toBeVisible();
    expect(screen.queryByText('原看板已保存业绩')).toBeNull();
  });
  it('preserves the old view if new snapshot readiness is temporarily unavailable', async () => {
    fetchMock.mockImplementation(async (route:string)=>route.endsWith('/catalog') ? Response.json({message:'temporary'},{status:503}) : Response.json({authenticated:true,configured:true,businessConfigured:true,identity:{employeeId:275,employeeName:'示例开发01'}}));
    render(<DashboardRoot />);
    expect(await screen.findByText('原看板已保存业绩')).toBeVisible();
    expect(screen.queryByText('业务看板内容')).toBeNull();
  });
});






