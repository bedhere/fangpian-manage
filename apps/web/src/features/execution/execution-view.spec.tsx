import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionView } from './execution-view';

const execution = {
  id: 'p1', title: '智能资料整理', status: 'PLANNING', objective: '减少重复劳动', currentUserId: 'u1',
  plans: [{ id: 'plan-1', version: 1, status: 'SUBMITTED', objective: '减少重复劳动', confirmedBy: null, milestones: [{ id: 'm1', title: '原型', description: '完成原型', dueAt: '2026-11-01', weight: '100', expectedDeliverable: '原型包', status: 'PENDING' }] }],
  members: [], teamInvitations: [], progressLogs: [], healthSnapshots: [], riskActions: [], availablePeople: [],
};

describe('ExecutionView', () => {
  it('shows plan version, milestone weight and confirmation state', () => {
    render(<ExecutionView execution={execution} mode="plan" onAction={vi.fn()} />);
    expect(screen.getByText('计划 V1')).toBeInTheDocument();
    expect(screen.getAllByText('待主管确认').length).toBeGreaterThan(0);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('submits a real append-only progress entry', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    render(<ExecutionView execution={{ ...execution, status: 'IN_PROGRESS' }} mode="manage" onAction={onAction} />);
    fireEvent.change(screen.getByLabelText('进度百分比'), { target: { value: '35' } });
    fireEvent.change(screen.getByLabelText('进展摘要'), { target: { value: '完成数据接入' } });
    fireEvent.change(screen.getByLabelText('下一步'), { target: { value: '联调验收' } });
    fireEvent.click(screen.getByRole('button', { name: '追加进展' }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('progress', expect.objectContaining({ progressPercent: 35, summary: '完成数据接入' })));
  });

  it('requires a deliberate confirmation to replace the project owner', () => {
    const action = vi.fn();
    render(<ExecutionView execution={{ ...execution, status: 'AT_RISK', availablePeople: [{ id: 'u2', displayName: '新负责人', email: 'owner@example.com' }], riskActions: [{ id: 'r1', reason: '延期', remediationPlan: '补齐交付', dueAt: '2026-11-01', resolvedAt: null }] }} mode="manage" onAction={action} />);
    fireEvent.change(screen.getByLabelText('风险原因'), { target: { value: '调整项目负责人员' } });
    fireEvent.change(screen.getByLabelText('新负责人'), { target: { value: 'u2' } });
    expect(action).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('slider', { name: '滑动更换负责人' }), { key: 'End' });
    expect(action).toHaveBeenCalledWith('replace-owner', { newOwnerId: 'u2', reason: '调整项目负责人员' });
  });
});
