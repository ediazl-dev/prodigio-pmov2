import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const deadlinesPage = readFileSync(resolve(process.cwd(), "client/src/pages/admin/AdminDeadlines.tsx"), "utf8");
const evidencePage = readFileSync(resolve(process.cwd(), "client/src/pages/admin/AdminEvidenceHistory.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

type CanonicalRole = "admin" | "pmo" | "pm" | "consulta";

function makeContext(role: CanonicalRole): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `reports-${role}`,
      email: `${role}@prodigio.tech`,
      name: `Usuario ${role}`,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Reportes transversales por rol", () => {
  it("ubica Financiero, Plazos y Evidencia dentro de Reportes", () => {
    expect(layout).toContain('label: "Financiero", path: "/reports/finance"');
    expect(layout).toContain('label: "Plazos por Etapa", path: "/reports/deadlines"');
    expect(layout).toContain('label: "Evidencia documental", path: "/reports/evidence"');
    expect(app).toContain('<Route path="/reports/finance" component={FinancialConsolidated} />');
    expect(app).toContain('<Route path="/reports/deadlines" component={AdminDeadlines} />');
    expect(app).toContain('<Route path="/reports/evidence" component={AdminEvidenceHistory} />');
  });

  it("redirige las URLs administrativas anteriores sin bloquear roles de lectura", () => {
    expect(app).toContain('<Route path="/admin/finance">{() => <Redirect to="/reports/finance" />}</Route>');
    expect(app).toContain('<Route path="/admin/deadlines">{() => <Redirect to="/reports/deadlines" />}</Route>');
    expect(app).toContain('<Route path="/admin/evidence-history">{() => <Redirect to="/reports/evidence" />}</Route>');
  });

  it.each(["admin", "pmo", "pm", "consulta"] as const)("permite consultas financieras, de plazos y evidencia al rol %s", async role => {
    const caller = appRouter.createCaller(makeContext(role));
    await expect(caller.deadlines.list()).resolves.toBeInstanceOf(Array);
    await expect(caller.executiveEvidenceAdmin.summary()).resolves.toMatchObject({ total: expect.any(Number) });
    await expect(caller.portfolioConsole.getFinancialPortfolioV2({ from: "2026-01-01", to: "2026-09-25", page: 1, pageSize: 10 })).resolves.toMatchObject({
      lifecycle: expect.any(Object),
      items: expect.any(Array),
    });
  });

  it("mantiene las mutaciones de plazos y evidencia bajo adminOnly", () => {
    expect(routerSource).toMatch(/update:\s*adminOnly\.input/);
    expect(routerSource).toMatch(/bulkUpdate:\s*adminOnly\.input/);
    expect(routerSource).toMatch(/discard:\s*adminOnly\.input/);
    expect(routerSource).toMatch(/restore:\s*adminOnly\.input/);
    expect(deadlinesPage).toContain('const canEdit = (user as any)?.role === "admin"');
    expect(deadlinesPage).toContain("disabled={!canEdit}");
    expect(evidencePage).toContain('const canManage = (user as any)?.role === "admin"');
    expect(evidencePage).toContain("canManage && item.canDiscard");
    expect(evidencePage).toContain("canManage && item.canRestore");
  });
});
