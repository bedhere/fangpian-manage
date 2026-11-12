import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api-client";

describe("API client", () => {
  it('notifies the page only after session refresh cannot restore access',async()=>{
    const onUnauthorized=vi.fn(),fetchImpl=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null,{status:401}));
    const client=createApiClient({baseUrl:'https://api.test',getAccessToken:()=>null,setAccessToken:()=>{},fetchImpl,onUnauthorized});
    await expect(client.request('/api/projects/p1')).rejects.toMatchObject({status:401});expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
  it("refreshes once after 401 and retries with the rotated access token", async () => {
    let token = "expired";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({code:'SESSION_UNAUTHORIZED'}, { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({ accessToken: "rotated" }, { status: 200 }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }, { status: 200 }));
    const client = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken: () => token,
      setAccessToken: (value) => {
        token = value ?? "";
      },
      fetchImpl,
    });

    await expect(client.request<{ ok: boolean }>("/api/users/me")).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("http://api.test/api/auth/refresh");
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ method: "POST", credentials: "include" });
    expect(fetchImpl.mock.calls[2]?.[1]).toMatchObject({
      headers: expect.objectContaining({ authorization: "Bearer rotated" }),
    });
  });
});
