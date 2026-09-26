import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const section = source.slice(
  source.indexOf("const executiveEvidenceAdminRouter"),
  source.indexOf("// ==================== AUDIT ROUTER"),
);

describe("executiveEvidenceAdminRouter guardrails", () => {
  it("abre cobertura, listado, resumen y proyectos a usuarios autenticados y reserva mutaciones a Admin", () => {
    expect(section.match(/protectedProcedure/g)?.length).toBe(4);
    expect(section.match(/adminOnly/g)?.length).toBe(2);
    expect(section).toContain("discard: adminOnly");
    expect(section).toContain("restore: adminOnly");
  });

  it("audita el descarte sin exponer token, URL o hash", () => {
    expect(section).toContain('"executive_evidence_discarded"');
    expect(section).toContain('"executive_evidence_restored"');
    expect(section).toContain('"executive_evidence_upload"');
    expect(section).not.toContain("receiptToken");
    expect(section).not.toContain("fileUrl");
    expect(section).not.toContain("fileSha256");
  });
});
