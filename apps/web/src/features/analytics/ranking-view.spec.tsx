import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RankingView } from './ranking-view';

describe('RankingView', () => {
  it('offers all eight configured ranking perspectives and profile drilldown', () => {
    const onTypeChange = vi.fn();
    render(<RankingView type="contribution" rows={[{ rank: 1, id: 'u1', name: '方小成', department: '产品部', capabilityLevel: 'L3', rankingValue: 123, contributionScore: 123 } as never]} onTypeChange={onTypeChange} />);
    expect(screen.getAllByRole('button')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'AI 效率' }));
    expect(onTypeChange).toHaveBeenCalledWith('aiEfficiency');
    expect(screen.getByRole('link', { name: /方小成/ })).toHaveAttribute('href', '/profile/u1');
  });
});
