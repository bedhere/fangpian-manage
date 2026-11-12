import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BonusLedgerView } from './bonus-ledger-view';

const ledgers = [
  { id: '1', amount: '1200.00', contributionPercentage: '60', status: 'PENDING', settlementMonth: '2026-10-01', project: { title: '项目甲', rating: { grade: 'A' } } },
  { id: '2', amount: '800.00', contributionPercentage: '40', status: 'PAID', settlementMonth: '2026-09-01', project: { title: '项目乙', rating: { grade: 'B' } } },
];

describe('BonusLedgerView', () => {
  it('filters by status and explains the allocation calculation', () => {
    render(<BonusLedgerView ledgers={ledgers as never} />);
    expect(screen.getByText('¥ 2,000.00')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('流水状态'), { target: { value: 'PAID' } });
    expect(screen.queryByText('项目甲')).not.toBeInTheDocument();
    expect(screen.getByText('项目乙')).toBeInTheDocument();
    expect(screen.getByText(/项目奖金 × 最终贡献比例/)).toBeInTheDocument();
  });
});
