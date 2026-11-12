import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectListView } from './project-list-view';

describe('ProjectListView', () => {
  it('identifies an empty department queue without implying missing permissions', () => {
    render(<ProjectListView department projects={[]} total={0} />);
    expect(screen.getByRole('heading', { name: '部门项目' })).toBeVisible();
    expect(screen.getByText('本部门暂无进行中的项目')).toBeVisible();
  });
  it('opens the complete progress board from owned projects', () => {
    render(<ProjectListView owned projects={[{ id: 'p1', title: '客户资料自动整理', status: 'IN_PROGRESS', projectLevel: 'P2', updatedAt: '', publisher: { displayName: '员工一' }, publisherDepartment: { name: '销售部' }, owner: { displayName: '我' } }]} total={1} />);
    expect(screen.getByRole('link', { name: '查看完整进度时间轴' })).toHaveAttribute('href', '/projects/p1/manage');
  });
  it('explains why projects awaiting owner assignment are absent from the owned view', () => {
    render(<ProjectListView owned projects={[]} total={0} />);
    expect(screen.getByRole('heading', { name: '我推进的项目' })).toBeInTheDocument();
    expect(screen.getByText(/接取项目并被指定为负责人后/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看我发起或参与的项目' })).toHaveAttribute('href', '/projects');
  });
  it('renders real project facts with a discoverable detail link', () => {
    render(<ProjectListView projects={[{
      id: 'p1', title: '客户资料自动整理', status: 'TECH_REVIEW', projectLevel: 'P2',
      updatedAt: '2026-10-08T00:00:00.000Z', publisher: { displayName: '员工一' },
      publisherDepartment: { name: '销售部' }, owner: null,
    }]} total={1} />);
    expect(screen.getByRole('heading', { name: '客户资料自动整理' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看项目' })).toHaveAttribute('href', '/projects/p1');
    expect(screen.getByText('技术审核')).toBeInTheDocument();
  });
});
