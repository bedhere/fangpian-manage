import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewQueueView } from './review-queue-view';

describe('ReviewQueueView', () => {
  it('blocks a conflicting rejection while approval is pending', () => {
    const decide = vi.fn(() => new Promise<void>(() => {}));
    render(<ReviewQueueView stage="BUSINESS" projects={[{
      id: 'p1', title: '客户资料自动整理', version: 4, status: 'DEPARTMENT_REVIEW',
      businessProblem: '人工重复录入', expectedResult: '自动整理', acceptanceCriteria: '准确率达标',
      publisher: { displayName: '员工一' }, publisherDepartment: { name: '销售部' }, approvals: [], aiAssessments: [],
    }]} onDecide={decide} />);
    fireEvent.change(screen.getByLabelText('业务价值分'), { target: { value: '88' } });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(screen.getByRole('button', { name: '驳回' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '驳回' }));
    expect(decide).toHaveBeenCalledOnce();
  });
  it('submits the visible project version and structured business score', () => {
    const decide = vi.fn();
    render(<ReviewQueueView stage="BUSINESS" projects={[{
      id: 'p1', title: '客户资料自动整理', version: 4, status: 'DEPARTMENT_REVIEW',
      businessProblem: '人工重复录入', expectedResult: '自动生成结构化资料', acceptanceCriteria: '抽样准确率达到目标',
      publisher: { displayName: '员工一' }, publisherDepartment: { name: '销售部' }, approvals: [], aiAssessments: [],
    }]} onDecide={decide} />);
    fireEvent.change(screen.getByLabelText('业务价值分'), { target: { value: '88' } });
    fireEvent.keyDown(screen.getByRole('slider', { name: '滑动通过业务审核' }), { key: 'End' });
    expect(decide).toHaveBeenCalledWith('p1', expect.objectContaining({ decision: 'APPROVED', expectedVersion: 4, businessValueScore: 88 }));
  });
});
