export class AdminApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AdminApiError";
  }
}

export function createAdminApiClient({
  baseUrl,
  getAccessToken,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  getAccessToken: () => string | null;
  fetchImpl?: typeof fetch;
}) {
  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      const token = getAccessToken();
      if (token) headers.authorization = `Bearer ${token}`;
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        credentials: init.credentials ?? "include",
        headers,
      });
      if (!response.ok) throw new AdminApiError(`Request failed with status ${response.status}`, response.status);
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    },
  };
}
