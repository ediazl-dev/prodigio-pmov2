import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const advanceStagePath = resolve(process.cwd(), "client/src/pages/stages/AvanceStage.tsx");
const routerPath = resolve(process.cwd(), "server/routers.ts");

describe("contrato de interfaz para reporte DOCX de avance", () => {
  it("conecta la acción visible de descarga DOCX con el procedimiento de avance", () => {
    const stageSource = readFileSync(advanceStagePath, "utf8");
    const routerSource = readFileSync(routerPath, "utf8");

    expect(routerSource).toContain("generateDocx:");
    expect(stageSource).toContain("trpc.advance.generateDocx.useMutation()");
    expect(stageSource).toContain("handleGenerateDocx");
    expect(stageSource).toContain("mutateAsync({ projectId, summary: summary || undefined })");
    expect(stageSource).toContain("Descargar DOCX");
    expect(stageSource).toContain("a.href = result.url");
    expect(stageSource).toContain("a.download = result.fileName");
  });
});
