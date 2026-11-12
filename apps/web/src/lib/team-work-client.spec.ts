import { afterEach, describe, expect, it, vi } from "vitest";
import { request, getToken } from "../../../team-work/src/api/client";
afterEach(() => { vi.restoreAllMocks(); });
describe("embedded workspace client", () => {
  it("maps requests and accepts responses only from the same origin parent", async () => {
    const parent = { postMessage: vi.fn() };
    vi.spyOn(window, "parent", "get").mockReturnValue(parent as unknown as Window);
    const pending = request("GET", "/api/tasks");
    const [sent, origin] = parent.postMessage.mock.calls[0];
    expect(sent.path).toBe("/api/team-work/tasks");
    expect(sent).not.toHaveProperty("token");
    expect(origin).toBe(location.origin);
    let settled = false;
    void pending.then(() => { settled = true; });
    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.test", source: parent as unknown as Window, data: { type: "team-work:response", id: sent.id, data: "evil" } }));
    window.dispatchEvent(new MessageEvent("message", { origin: location.origin, source: window, data: { type: "team-work:response", id: sent.id, data: "evil" } }));
    await Promise.resolve();
    expect(settled).toBe(false);
    window.dispatchEvent(new MessageEvent("message", { origin: location.origin, source: parent as unknown as Window, data: { type: "team-work:response", id: sent.id, data: { tasks: [] } } }));
    await expect(pending).resolves.toEqual({ tasks: [] });
  });
  it("does not read stored JWTs and rejects standalone use", async () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    expect(getToken()).toBe("parent-session");
    expect(read).not.toHaveBeenCalled();
    await expect(request("GET", "/api/auth/me")).rejects.toThrow("请从方片工作台");
  });
});
