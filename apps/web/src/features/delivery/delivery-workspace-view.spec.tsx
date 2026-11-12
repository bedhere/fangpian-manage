import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryWorkspaceView } from './delivery-workspace-view';

const workspace = {
  project: { id: 'p1', title: '智能工单', status: 'BUSINESS_ACCEPTANCE' },
  deliveries: [{ id: 'd1', version: 2, title: '交付包', type: 'FILE', changeSummary: '完成返修', createdAt: '2026-10-08T00:00:00Z' }],
  aiAssessments: [{ id: 'a1', status: 'SUCCEEDED', output: { technicalQuality: 91, businessFit: 88, completeness: 90, risk: 12, suggestedGrade: 'A', reasoningSummary: '质量稳定', issues: [], recommendations: ['补充监控'] } }],
  acceptances: [], rating: null,
  assignedRoles: ['DEPARTMENT_HEAD_BUSINESS'], allowedActions: ['SUBMIT_ACCEPTANCE'],
  scoring: { weights: { publisherBusiness: 30, departmentHeadBusiness: 30, aiTechnical: 10, ownerManagerTechnical: 10, projectManagement: 20 }, thresholds: { S: 95, A: 85, B: 70, C: 60 } },
};

describe('DeliveryWorkspaceView', () => {
  it('locks the revision decision while approval is pending', () => {
    const action = vi.fn(() => new Promise<void>(() => {}));
    render(<DeliveryWorkspaceView workspace={workspace as never} onAction={action} />);
    fireEvent.change(screen.getByLabelText('验收评分'), { target: { value: '92' } });
    fireEvent.change(screen.getByLabelText('验收意见'), { target: { value: '符合验收标准' } });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(screen.getByRole('button', { name: '退回返修' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '退回返修' }));
    expect(action).toHaveBeenCalledOnce();
  });
  it('shows immutable version, AI explanation and only assigned scoring role', () => {
    const onAction = vi.fn();
    render(<DeliveryWorkspaceView workspace={workspace as never} onAction={onAction} />);
    expect(screen.getByText('V2 · 交付包')).toBeInTheDocument();
    expect(screen.getByText('质量稳定')).toBeInTheDocument();
    expect(screen.getByText('发布部门负责人业务验收')).toBeInTheDocument();
    expect(screen.queryByText('项目负责人直属主管技术验收')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('验收评分'), { target: { value: '92' } });
    fireEvent.change(screen.getByLabelText('验收意见'), { target: { value: '符合验收标准' } });
    fireEvent.keyDown(screen.getByRole('slider', { name: '滑动通过验收' }), { key: 'End' });
    expect(onAction).toHaveBeenCalledWith('accept', expect.objectContaining({ role: 'DEPARTMENT_HEAD_BUSINESS', score: 92 }));
  });
});
