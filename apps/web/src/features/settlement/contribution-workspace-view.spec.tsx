import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContributionWorkspaceView } from './contribution-workspace-view';

describe('ContributionWorkspaceView', () => {
  it('blocks a conflicting dispute while confirmation is pending', () => {
    const action = vi.fn(() => new Promise<void>(() => {}));
    render(<ContributionWorkspaceView workspace={{ project: { id: 'p1', title: '项目', status: 'CONTRIBUTION_CONFIRMATION', members: [], rating: null, disputes: [], contributions: [{ id: 'c1', userId: 'u1', proposalVersion: 1, proposedPercentage: '60', finalPercentage: null, status: 'PENDING', supersededAt: null, user: { displayName: '小方' } }] }, allowedActions: ['RESPOND_CONTRIBUTION'] }} onAction={action} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(screen.getByRole('button', { name: '提出异议' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '提出异议' }));
    expect(action).toHaveBeenCalledOnce();
  });
  it('shows proposal history and preserves dispute original/final allocations', () => {
    const onAction = vi.fn();
    render(<ContributionWorkspaceView workspace={{ project: { id: 'p1', title: '项目', status: 'CONTRIBUTION_CONFIRMATION', members: [], rating: { grade: 'A', finalScore: 90 }, contributions: [{ id: 'c2', userId: 'u1', proposalVersion: 2, proposedPercentage: '60', finalPercentage: null, status: 'PENDING', supersededAt: null, user: { displayName: '小方' } }, { id: 'c1', userId: 'u1', proposalVersion: 1, proposedPercentage: '50', finalPercentage: '50', status: 'CONFIRMED', supersededAt: '2026-10-08', user: { displayName: '小方' } }], disputes: [{ id: 'd1', reason: '投入未计入', status: 'RESOLVED', originalAllocation: [{ userId: 'u1', percentage: '50' }], finalAllocation: [{ userId: 'u1', percentage: '60' }], resolution: '按交付证据调整', raisedBy: { displayName: '小方' }, arbitrator: { displayName: '监督人' } }] }, allowedActions: ['RESPOND_CONTRIBUTION'] } as never} onAction={onAction} />);
    expect(screen.getByText('方案 V2')).toBeInTheDocument();
    expect(screen.getByText('原方案 50% → 最终 60%')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('slider', { name: '滑动确认我的比例' }), { key: 'End' });
    expect(onAction).toHaveBeenCalledWith('respond', expect.objectContaining({ contributionId: 'c2', decision: 'CONFIRM' }));
  });
});
