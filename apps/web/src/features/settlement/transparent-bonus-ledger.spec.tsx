import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TransparentBonusLedger } from './transparent-bonus-ledger';

describe('TransparentBonusLedger', () => {
  it('shows employee, calculation rule and cumulative achievement facts', () => {
    render(<TransparentBonusLedger items={[{ id: 'l1', employee: { id: 'u1', displayName: '方小成' }, project: { id: 'p1', title: '关键项目' }, role: 'CONTRIBUTOR', task: null, amount: 1200, cumulativeAmount: 2600, contributionPercentage: 60, contributionScore: 52.8, grade: 'A', sCount: 1, aCount: 2, status: 'PAID', settlementMonth: '2026-10-01', ruleExplanation: '项目奖金 ¥2000.00 × 最终贡献比例 60.00%' }]} />);
    expect(screen.getByText('方小成')).toBeInTheDocument();
    expect(screen.getByText(/项目奖金 ¥2000.00/)).toBeInTheDocument();
    expect(screen.getByText(/累计 ¥2,600.00/)).toBeInTheDocument();
    expect(screen.getByText(/S 1 · A 2/)).toBeInTheDocument();
  });
});
