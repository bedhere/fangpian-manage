import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompanyInsightsView } from './company-insights-view';
describe('CompanyInsightsView', () => {
  it('renders actionable operating indicators and accessible table fallback', () => {
    render(<CompanyInsightsView data={{ projects: { total: 8, completed: 3, atRisk: 1 }, bonuses: { total: 12000, paid: 5000 }, capacity: { availableHours: 200, allocatedHours: 120 }, acceptanceRate: 80, highPriority: { p0: 1, p1: 2 }, bonusPool: 15000, aiEfficiency: 65, overdueProjects: [{ id: 'p1', title: '逾期项目', deadline: '2026-10-01' }], departmentCapacity: [{ rank: 1, department: '产品部', contributionScore: 88, totalBonus: 3000, completedProjects: 2, memberCount: 4 }], hiddenTalent: [] }} />);
    expect(screen.getByText('验收通过率')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '部门价值与产能表' })).toBeInTheDocument();
    expect(screen.getByText('逾期项目', { selector: 'strong' })).toBeInTheDocument();
  });
});
