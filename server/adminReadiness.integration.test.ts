import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-readiness-check",
      email: "admin@prodigio.tech",
      name: "Administrador Prodigio",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("preparación del panel administrativo", () => {
  it("consulta usuarios, plantilla PPDC, salud Jira, cumplimiento y auditoría", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const [users, tokenHealth, template, compliance, auditStats] = await Promise.all([
      caller.users.list(),
      caller.jira.tokenHealth(),
      caller.jira.getTemplate(),
      caller.compliance.metrics(),
      caller.audit.stats(),
    ]);

    expect(users).toEqual(expect.any(Array));
    expect(["active", "inactive", "error"]).toContain(tokenHealth.status);
    expect(template.boards.length).toBeGreaterThan(0);
    expect(template.issueTypes.length).toBeGreaterThan(0);
    expect(compliance.details).toEqual(expect.any(Array));
    expect(auditStats.totalRecent).toEqual(expect.any(Number));
  }, 120_000);
});
