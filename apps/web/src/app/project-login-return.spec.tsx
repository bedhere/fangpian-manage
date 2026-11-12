import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api', () => ({ apiClient: { request: vi.fn().mockResolvedValue({ roles: ['EMPLOYEE'] }) } }));
vi.mock("@/components/motion/page-motion", () => ({
  BlurText: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));
beforeEach(() => {
  vi.clearAllMocks();
  history.replaceState(null, "", "/?next=%2Fprojects%2Fp1");
});
afterEach(() => vi.unstubAllGlobals());
describe("shared-project login", () => {
  it.each([false, true])(
    "returns to the intended project, preserving mandatory-password step=%s",
    async (mustChangePassword) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            Response.json({ accessToken: "test-token", mustChangePassword }),
          ),
      );
      render(<LoginPage />);
      fireEvent.change(screen.getByLabelText("账号或邮箱"), {
        target: { value: "demo" },
      });
      fireEvent.change(screen.getByLabelText("密码", { exact: true }), {
        target: { value: "password" },
      });
      fireEvent.click(screen.getByRole("button", { name: "进入工作台" }));
      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(
          mustChangePassword
            ? "/change-password?next=%2Fprojects%2Fp1"
            : "/projects/p1",
        ),
      );
    },
  );
});
