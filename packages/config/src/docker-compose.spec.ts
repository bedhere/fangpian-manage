import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ComposeService = {
  environment?: Record<string, string>;
};

type ComposeConfig = {
  services: Record<string, ComposeService>;
};

describe("Docker Compose browser-facing URLs", () => {
  it("keeps API and CORS origins aligned with overridden host ports", () => {
    const workspaceRoot = resolve(import.meta.dirname, "../../..");
    const output = execFileSync("docker", ["compose", "config", "--format", "json"], {
      cwd: workspaceRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        WEB_PORT_HOST: "3100",
        API_PORT_HOST: "3101",
        ADMIN_PORT_HOST: "3102",
      },
    });
    const config = JSON.parse(output) as ComposeConfig;

    expect(config.services.web?.environment?.NEXT_PUBLIC_API_URL).toBe("http://localhost:3101");
    expect(config.services.admin?.environment?.NEXT_PUBLIC_API_URL).toBe("http://localhost:3101");
    expect(config.services.api?.environment?.WEB_ORIGIN).toBe(
      "http://localhost:3100,http://localhost:3102",
    );
  });
});
