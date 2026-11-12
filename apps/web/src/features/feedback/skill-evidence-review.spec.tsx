import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillEvidenceReview } from './skill-evidence-review';

describe('SkillEvidenceReview', () => {
  it('shows real project evidence and submits an explicit decision', () => {
    const review = vi.fn();
    render(<SkillEvidenceReview evidence={[{ id: 'e1', contributionPercentage: '40', grade: 'S', user: { displayName: '方小成' }, project: { title: '客户洞察' }, skill: { name: '数据分析' } }]} onReview={review} />);
    expect(screen.getByText('客户洞察')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('审核理由'), { target: { value: '项目成果已验证该技能' } });
    fireEvent.keyDown(screen.getByRole('slider', { name: '滑动验证通过' }), { key: 'End' });
    expect(review).toHaveBeenCalledWith('e1', 'VERIFIED', '项目成果已验证该技能');
  });
});
