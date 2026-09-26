import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./documentGovernanceRouter.ts", import.meta.url), "utf8");
const repositorySource = readFileSync(new URL("./documentGovernanceRepository.ts", import.meta.url), "utf8");
const appRouterSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("documentGovernanceRouter guardrails", () => {
  it("registra el dominio transversal en el appRouter", () => {
    expect(appRouterSource).toContain("documentGovernance: documentGovernanceRouter");
  });

  it("protege todas las operaciones con sesión y descarga firmada", () => {
    expect(routerSource).not.toContain("publicProcedure");
    expect(routerSource.match(/protectedProcedure/g)?.length).toBeGreaterThanOrEqual(8);
    expect(routerSource).toContain("storageGet(artifact.fileKey)");
    expect(routerSource).not.toContain("return { key:");
  });

  it("no registra contenido base64 ni secretos de storage en auditoría", () => {
    expect(routerSource).not.toMatch(/audit\([\s\S]{0,400}fileBase64/);
    expect(routerSource).not.toMatch(/audit\([\s\S]{0,400}fileKey/);
    expect(routerSource).not.toContain("forgeApiKey");
  });

  it("mantiene decisiones append-only y archivo lógico", () => {
    expect(repositorySource).toContain("insert(documentValidationDecisions)");
    expect(repositorySource).not.toContain("delete(documentValidationDecisions)");
    expect(repositorySource).toContain('artifactStatus: "archived"');
    expect(repositorySource).not.toContain("delete(documentArtifacts)");
  });

  it("crea una decisión pending al cargar cada nueva versión", () => {
    expect(repositorySource).toContain('decision: "pending"');
    expect(repositorySource).toContain('artifactStatus: "superseded"');
    expect(repositorySource).toContain("supersedesArtifactId");
  });
});
