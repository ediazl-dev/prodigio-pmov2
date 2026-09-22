import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const section = source.slice(
  source.indexOf("const executiveEvidenceAdminRouter"),
  source.indexOf("// ==================== AUDIT ROUTER"),
);

describe("executiveEvidenceAdminRouter guardrails", () => {
  it("protege listado, resumen, proyectos y descarte con adminOnly", () => {
    expect(section.match(/adminOnly/g)?.length).toBe(4);
    expect(section).not.toContain("protectedProcedure");
  });

  it("audita el descarte sin exponer token, URL o hash", () => {
    expect(section).toContain('"executive_evidence_discarded"');
    expect(section).toContain('"executive_evidence_upload"');
    expect(section).not.toContain("receiptToken");
    expect(section).not.toContain("fileUrl");
    expect(section).not.toContain("fileSha256");
  });
});
