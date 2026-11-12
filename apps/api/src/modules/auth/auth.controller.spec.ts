import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';

describe('AuthController refresh cookie contract', () => {
  it('keeps the refresh token out of the login response and writes an HttpOnly cookie', async () => {
    const auth = {
      login: vi.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 }),
    };
    const cookie = vi.fn();
    const controller = new AuthController(auth as never);

    const body = await controller.login(
      { email: 'employee1@example.com', password: 'DEMO_ONLY_ChangeMe_2026!' },
      { cookie } as never,
    );

    expect(body).toEqual({ accessToken: 'access', expiresIn: 900, mustChangePassword: false });
    expect(cookie).toHaveBeenCalledWith(
      'valueflow_refresh_token',
      'refresh',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/api/auth' }),
    );
  });

  it('rotates the cookie using only the incoming HttpOnly cookie', async () => {
    const auth = {
      refresh: vi.fn().mockResolvedValue({ accessToken: 'next-access', refreshToken: 'next-refresh', expiresIn: 900 }),
    };
    const cookie = vi.fn();
    const controller = new AuthController(auth as never);

    const body = await controller.refresh(
      { cookies: { valueflow_refresh_token: 'current-refresh' } } as never,
      { cookie } as never,
    );

    expect(auth.refresh).toHaveBeenCalledWith('current-refresh');
    expect(body).toEqual({ accessToken: 'next-access', expiresIn: 900, mustChangePassword: false });
    expect(cookie).toHaveBeenCalledWith(
      'valueflow_refresh_token',
      'next-refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('clears the refresh cookie when logging out', () => {
    const controller = new AuthController({} as never);
    const clearCookie = vi.fn();

    expect(controller.logout({ clearCookie } as never)).toEqual({ success: true });
    expect(clearCookie).toHaveBeenCalledWith(
      'valueflow_refresh_token',
      expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
    );
  });
});
