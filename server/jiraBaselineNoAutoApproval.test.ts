import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const cardSource = readFileSync(
  new URL("../client/src/components/BaselineExecutiveCard.tsx", import.meta.url),
  "utf8",
);

describe("guardia H5 contra autoaprobación de baseline Jira", () => {
  it("elimina los símbolos y la versión del fallback autoaprobado heredado", () => {
    const productionSource = `${routerSource}\n${dbSource}\n${cardSource}`;
    expect(productionSource).not.toContain("createExecutiveBaselineWithMilestones");
    expect(productionSource).not.toContain("jira-auto-v1");
    expect(productionSource).not.toMatch(/approvedByName\s*:\s*["']Sistema["']/);
  });

  it("expone creación draft y aprobación humana como operaciones separadas", () => {
    expect(dbSource).toContain("createOrReplaceJiraBaselineProposal");
    expect(dbSource).toContain('sourceStatus: "draft"');
    expect(routerSource).toContain("approveBaselineProposal");
    expect(routerSource).toContain("approvalNotes");
    expect(routerSource).toContain("approveJiraBaselineProposal");
    expect(cardSource).toContain("approveBaselineProposal.useMutation");
  });

  it("el Dashboard Ejecutivo no crea una fuente como efecto lateral de lectura", () => {
    const dashboardProcedureStart = routerSource.indexOf("getExecutiveDashboardV2:");
    const dashboardProcedureEnd = routerSource.indexOf("updateMilestoneBaseline:", dashboardProcedureStart);
    expect(dashboardProcedureStart).toBeGreaterThanOrEqual(0);
    expect(dashboardProcedureEnd).toBeGreaterThan(dashboardProcedureStart);

    const dashboardProcedure = routerSource.slice(dashboardProcedureStart, dashboardProcedureEnd);
    expect(dashboardProcedure).not.toContain("createOrReplaceJiraBaselineProposal");
    expect(dashboardProcedure).not.toContain("approveJiraBaselineProposal");
  });
});
