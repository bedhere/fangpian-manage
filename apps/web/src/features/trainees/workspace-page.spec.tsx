import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TraineeWorkspacePage } from './workspace-page';
import { apiClient } from '@/lib/api';
import { useSessionStore } from '@/stores/session-store';
vi.mock('@/lib/api', () => ({ apiClient: { request: vi.fn() } }));
const request = vi.mocked(apiClient.request);
const person = { userId: 'u1', displayName: '张三', username: 'zhangsan999', mentorId: 'm1', mentorName: '王老师', mentorManagerName: '李经理', isSelf: true, canReview: false, counts: { total: 1, pending: 0, approved: 0, rejected: 1 } };
const submission = { id: 's1', traineeId: 'u1', traineeName: '张三', mentorId: 'm1', mentorName: '王老师', departmentId: 'd1', departmentName: '销售部', workDate: '2026-10-29', title: '优化客户线索', problem: '重复录入客户资料', solution: '自动同步', expectedValue: '节省时间', status: 'REJECTED', version: 2, canEdit: true, canReview: false, createdAt: '', updatedAt: '', reviewComment: '请补充细节', reviewerName: '王老师', reviewedAt: '2026-10-29T01:00:00Z', history: [{ id: 'h1', decision: 'REJECTED', comment: '请补充细节', reviewerName: '王老师', reviewedAt: '2026-10-29T01:00:00Z', version: 2 }] };
const workspace = { from: '2026-10-29', to: '2026-10-29', canSubmit: true, canManageMentors: false, selfProfile: person, trainees: [person], submissions: [submission], departments: [{ id: 'd1', name: '销售部' }], mentors: [{ id: 'm1', displayName: '王老师', departmentName: '销售部' }] };
beforeEach(() => { request.mockReset(); request.mockResolvedValue(workspace); useSessionStore.setState({ identity: { id: 'u1', displayName: '张三', roles: ['TRAINEE'], permissions: [] } }); });
describe('管培生按人按日工作区', () => {
  it('shows authorized people, day, department and counts and sends filters to the server', async () => {
    render(<TraineeWorkspacePage />); await screen.findByRole('button', { name: '查看需求：优化客户线索' });
    expect(screen.getByLabelText('张三的需求统计')).toHaveTextContent('需求总数1待审0已通过0未通过1');
    expect(screen.getByText('导师：王老师')).toBeInTheDocument();
    expect(screen.getByText('导师直属上级：李经理')).toBeInTheDocument();
    expect(screen.getByText('2026-10-29 · 销售部')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('审核状态'), { target: { value: 'SUBMITTED' } });
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(expect.stringContaining('status=SUBMITTED'), expect.anything()));
  });
  it('edits a returned submission then submits the new version and keeps history', async () => {
    render(<TraineeWorkspacePage />); fireEvent.click(await screen.findByRole('button', { name: '查看需求：优化客户线索' }));
    expect(screen.getByText('审核历史')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '修改需求' }));
    fireEvent.change(screen.getByLabelText('解决方案'), { target: { value: '通过接口自动同步并校验' } });
    request.mockResolvedValueOnce({ ...submission, solution: '通过接口自动同步并校验', status: 'DRAFT', version: 3 });
    request.mockResolvedValueOnce({ ...submission, status: 'SUBMITTED', version: 4, canEdit: false });
    fireEvent.click(screen.getByRole('button', { name: '保存并提交审核' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/trainees/submissions/s1/submit', expect.objectContaining({ body: JSON.stringify({ version: 3 }) })));
    expect(request).toHaveBeenCalledWith('/api/trainees/submissions/s1', expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"version":2') }));
  });
  it('preserves a successful draft save when submit conflicts and shows retry guidance', async () => {
    render(<TraineeWorkspacePage />); fireEvent.click(await screen.findByRole('button', { name: '查看需求：优化客户线索' }));
    fireEvent.click(screen.getByRole('button', { name: '修改需求' }));
    request.mockResolvedValueOnce({ ...submission, status: 'DRAFT', version: 3 });
    request.mockRejectedValueOnce(Object.assign(new Error('版本已变化'), { status: 409 }));
    fireEvent.click(screen.getByRole('button', { name: '保存并提交审核' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('修改已保存为草稿');
    expect(screen.getByRole('alert')).toHaveTextContent('刷新');
  });
  it('offers review only from canReview and requires rejection comments', async () => {
    request.mockResolvedValue({ ...workspace, canSubmit: false, selfProfile: null, submissions: [{ ...submission, status: 'SUBMITTED', canEdit: false, canReview: true }] });
    render(<TraineeWorkspacePage />); fireEvent.click(await screen.findByRole('button', { name: '查看需求：优化客户线索' }));
    fireEvent.click(screen.getByRole('button', { name: '不通过' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('请填写不通过原因');
    fireEvent.change(screen.getByLabelText('审核意见'), { target: { value: '补充验证指标' } });
    request.mockResolvedValueOnce({ ...submission, version: 3, canReview: false });
    fireEvent.click(screen.getByRole('button', { name: '不通过' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/trainees/submissions/s1/review', expect.objectContaining({ body: JSON.stringify({ version: 2, decision: 'REJECTED', comment: '补充验证指标' }) })));
  });
  it('keeps leaders read-only when canReview and canEdit are false', async () => {
    request.mockResolvedValue({ ...workspace, canSubmit: false, selfProfile: null, submissions: [{ ...submission, canEdit: false, canReview: false }] });
    render(<TraineeWorkspacePage />); fireEvent.click(await screen.findByRole('button', { name: '查看需求：优化客户线索' }));
    expect(screen.queryByRole('button', { name: /^通过$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '修改需求' })).not.toBeInTheDocument();
  });
  it('creates a submission without mentor and marks pending assignment', async () => {
    request.mockResolvedValue({ ...workspace, selfProfile: { ...person, mentorId: null, mentorName: null }, trainees: [{ ...person, mentorId: null, mentorName: null }], submissions: [] });
    render(<TraineeWorkspacePage />); fireEvent.click(await screen.findByRole('button', { name: '填写需求' }));
    expect(screen.getByText(/未分配导师，可提交/)).toBeInTheDocument();
    for (const [label, value] of [['标题', '新需求'], ['业务部门', 'd1'], ['发现的问题', '问题'], ['解决方案', '方案']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    request.mockResolvedValueOnce({ ...submission, title: '新需求', status: 'SUBMITTED', version: 1 });
    fireEvent.click(screen.getByRole('button', { name: '提交导师审核' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/trainees/submissions', expect.objectContaining({ body: expect.stringContaining('"submit":true') })));
  });
  it('lets only the server manager capability assign a mentor', async () => {
    request.mockResolvedValue({ ...workspace, canManageMentors: true });
    render(<TraineeWorkspacePage />); const select = await screen.findByLabelText('张三的导师');
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '保存张三的导师' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/trainees/u1/mentor', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ mentorId: null }) })));
  });
  it('does not invent people for an empty result and offers voluntary enrollment to existing members', async () => {
    useSessionStore.setState({ identity: { id: 'employee', displayName: '员工', roles: ['EMPLOYEE'], permissions: [] } });
    request.mockResolvedValue({ ...workspace, canSubmit: false, selfProfile: null, trainees: [], submissions: [] });
    render(<TraineeWorkspacePage />); await screen.findByText('当前筛选范围内暂无管培生');
    expect(screen.queryByText('张三')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '我要入驻' }));
    expect(screen.getByRole('button', { name: '确认入驻' })).toBeInTheDocument();
    request.mockRejectedValueOnce(new Error('已入驻，请刷新'));
    fireEvent.click(screen.getByRole('button', { name: '确认入驻' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('已入驻，请刷新');
  });
  it('ignores a slower previous date response and exposes loading and query failures', async () => {
    let resolveOld!: (value: unknown) => void;
    request.mockReturnValueOnce(new Promise(done => { resolveOld = done; }));
    render(<TraineeWorkspacePage />);
    expect(screen.getByRole('status')).toHaveTextContent('正在同步');
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-10-01' } });
    await screen.findByRole('button', { name: '查看需求：优化客户线索' });
    await act(async () => resolveOld({ ...workspace, trainees: [{ ...person, displayName: '旧查询用户' }] }));
    expect(screen.queryByText('旧查询用户')).not.toBeInTheDocument();
    request.mockRejectedValueOnce(Object.assign(new Error('读取失败'), { status: 503 }));
    fireEvent.click(screen.getByRole('button', { name: '刷新工作区' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('读取失败');
    expect(screen.queryByRole('button', { name: '查看需求：优化客户线索' })).not.toBeInTheDocument();
  });
  it('does not allow an invalid date range to request data', async () => {
    render(<TraineeWorkspacePage />); await screen.findByRole('button', { name: '查看需求：优化客户线索' });
    const before = request.mock.calls.length;
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2099-01-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('开始日期不能晚于结束日期');
    expect(request).toHaveBeenCalledTimes(before);
  });
  it('allows an optional approval comment and prevents repeated reviews while pending', async () => {
    request.mockResolvedValue({ ...workspace, submissions: [{ ...submission, status: 'SUBMITTED', canEdit: false, canReview: true }] });
    render(<TraineeWorkspacePage />); fireEvent.click(await screen.findByRole('button', { name: '查看需求：优化客户线索' }));
    let resolve!: (value: unknown) => void;
    request.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const approve = screen.getByRole('button', { name: /^通过$/ });
    fireEvent.click(approve); fireEvent.click(approve);
    expect(approve).toBeDisabled();
    expect(request.mock.calls.filter(([path]) => path.includes('/review'))).toHaveLength(1);
    expect(request).toHaveBeenCalledWith('/api/trainees/submissions/s1/review', expect.objectContaining({ body: JSON.stringify({ version: 2, decision: 'APPROVED' }) }));
    resolve({ ...submission, status: 'APPROVED', canEdit: false, canReview: false, version: 3 });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^通过$/ })).not.toBeInTheDocument());
  });
  it('retains all authorized candidates while switching directly between people and clears them for a new account', async () => {
    const other = { ...person, userId: 'u2', displayName: '赵六', isSelf: false };
    request.mockImplementation(async path => {
      const id = new URL(path, 'http://localhost').searchParams.get('traineeId');
      return { ...workspace, trainees: id === 'u1' ? [person] : id === 'u2' ? [other] : [person, other], submissions: id === 'u2' ? [] : [submission] };
    });
    render(<TraineeWorkspacePage />);
    const select = screen.getByLabelText('管培生');
    await within(select).findByRole('option', { name: '赵六' });
    fireEvent.change(select, { target: { value: 'u1' } });
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringContaining('traineeId=u1'), expect.anything()));
    await waitFor(() => expect(screen.getByRole('button', { name: '刷新工作区' })).toBeEnabled());
    expect(within(select).getByRole('option', { name: '赵六' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'u2' } });
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringContaining('traineeId=u2'), expect.anything()));
    let resolveNew!: (value: unknown) => void;
    request.mockImplementationOnce(() => new Promise(done => { resolveNew = done; }));
    act(() => useSessionStore.setState({ identity: { id: 'new-account', displayName: '新用户', roles: ['EMPLOYEE'], permissions: [] } }));
    expect(screen.queryByRole('option', { name: '赵六' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '张三' })).not.toBeInTheDocument();
    await act(async () => resolveNew({ ...workspace, trainees: [], submissions: [] }));
  });
  it('updates the cached saved draft and retains its new version and partial-error form when submit fails', async () => {
    render(<TraineeWorkspacePage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看需求：优化客户线索' }));
    fireEvent.click(screen.getByRole('button', { name: '修改需求' }));
    fireEvent.change(screen.getByLabelText('解决方案'), { target: { value: '保存后的新方案' } });
    const draft = { ...submission, status: 'DRAFT', solution: '保存后的新方案', version: 3 };
    request.mockResolvedValueOnce(draft);
    request.mockRejectedValueOnce(Object.assign(new Error('版本已变化'), { status: 409 }));
    // The refresh stays pending, so a stale pre-save list cannot masquerade as the saved row.
    let resolveRefresh!: (value: unknown) => void;
    request.mockImplementationOnce(() => new Promise(done => { resolveRefresh = done; }));
    fireEvent.click(screen.getByRole('button', { name: '保存并提交审核' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('修改已保存为草稿');
    expect(screen.getByLabelText('解决方案')).toHaveValue('保存后的新方案');
    const list = screen.getByRole('region', { name: '按人查看需求' });
    expect(within(list).getByText('草稿')).toBeInTheDocument();
    expect(within(list).queryByText('未通过', { selector: '.fp-badge' })).not.toBeInTheDocument();
    await act(async () => resolveRefresh({ ...workspace, submissions: [draft], trainees: [{ ...person, counts: { total: 1, pending: 0, approved: 0, rejected: 0 } }] }));
    expect(screen.getByRole('alert')).toHaveTextContent('修改已保存为草稿');
    expect(screen.getByLabelText('解决方案')).toHaveValue('保存后的新方案');
    await waitFor(() => expect(screen.getByLabelText('张三的需求统计')).toHaveTextContent('需求总数1待审0已通过0未通过0'));
    // Retrying the kept form must patch the saved version, even before reopening it.
    request.mockResolvedValueOnce({ ...draft, version: 4 });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/trainees/submissions/s1', expect.objectContaining({ body: expect.stringContaining('"version":3') })));
  });
});
