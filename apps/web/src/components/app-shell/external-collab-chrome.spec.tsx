import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SiteChrome } from './site-chrome';
import { useSessionStore } from '@/stores/session-store';
const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiClient: api }));
vi.mock('next/navigation', () => ({ usePathname: () => '/external-collab/tianji-callback' }));
vi.mock('./route-progress', () => ({ RouteProgress: () => null }));
it('renders the public OAuth callback without a platform identity, header, or session bootstrap', () => {
  useSessionStore.getState().clearSession();
  render(<SiteChrome><p>正在处理官方授权</p></SiteChrome>);
  expect(screen.getByText('正在处理官方授权')).toBeVisible();
  expect(screen.queryByRole('navigation')).toBeNull();
  expect(api.request).not.toHaveBeenCalled();
});
