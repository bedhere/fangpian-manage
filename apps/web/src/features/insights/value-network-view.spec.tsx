import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValueNetworkView } from './value-network-view';
describe('ValueNetworkView', () => {
  it('renders network metrics and an accessible edge table fallback', () => {
    render(<ValueNetworkView data={{ nodes: [{ id: 'department:d1', entityId: 'd1', type: 'DEPARTMENT', label: '产品部' }, { id: 'employee:u1', entityId: 'u1', type: 'EMPLOYEE', label: '方小成' }], edges: [{ from: 'department:d1', to: 'employee:u1', type: 'MEMBER_OF' }], metrics: { nodeCount: 2, edgeCount: 1, crossDepartmentProjects: 0 } }} />);
    expect(screen.getAllByText('产品部')).toHaveLength(2);
    expect(screen.getByRole('table', { name: '价值流关系表' })).toBeInTheDocument();
    expect(screen.getByText('MEMBER_OF')).toBeInTheDocument();
  });
});
