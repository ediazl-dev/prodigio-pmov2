import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  jiraEntityMappings,
  jiraImportExceptions,
  jiraProjectOnboardings,
  jiraSyncLogs,
} from "../drizzle/schema";
import { SANITIZED_JIRA_ONBOARDING_FIXTURE } from "./fixtures/jiraOnboarding.fixture";
import {
  CANONICAL_HOMOLOGATION_CONTRACT,
  CANONICAL_PROJECT_ROLES,
  CANONICAL_PROJECT_STAGE_IDS,
  buildCanonicalLinkedProjectStagePlan,
  buildLegacyLinkedProjectStagePlan,
  validateHomologationActivationContract,
} from "./jiraHomologation";

describe("contrato canónico de homologación Jira", () => {
  it("conserva exactamente las seis etapas y los cuatro roles autorizados", () => {
    expect(CANONICAL_PROJECT_STAGE_IDS).toEqual(["sow", "jira", "risks", "planning", "design", "closure"]);
    expect(CANONICAL_PROJECT_ROLES).toEqual(["admin", "pmo", "pm", "consulta"]);
    expect(validateHomologationActivationContract(CANONICAL_HOMOLOGATION_CONTRACT)).toEqual([]);
  });

  it.each([
    ["etapa adicional", { stageIds: [...CANONICAL_PROJECT_STAGE_IDS, "onboarding"] }],
    ["avance financiero", { progressMetric: "weighted_financial_value" }],
    ["datos ficticios", { missingDataPolicy: "autofill_estimates" }],
    ["cierre automático desde Jira", { jiraCanCompletePmoStages: true }],
    ["baseline Jira aprobado automáticamente", { jiraOnlyBaselinePolicy: "approved" }],
  ])("rechaza %s", (_label, override) => {
    const violations = validateHomologationActivationContract({
      ...CANONICAL_HOMOLOGATION_CONTRACT,
      ...override,
    });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("rechaza roles distintos de admin, pmo, pm y consulta", () => {
    const violations = validateHomologationActivationContract({
      ...CANONICAL_HOMOLOGATION_CONTRACT,
      roles: [...CANONICAL_PROJECT_ROLES, "importador"],
    });
    expect(violations).toContain("La homologación solo admite los roles admin, pmo, pm y consulta.");
  });
});

describe("caracterización del alta vinculada heredada", () => {
  it("documenta el salto directo a Avance y los cuatro autocierres que H4 debe eliminar", () => {
    const timestamp = new Date("2026-08-29T12:00:00.000Z");
    const plan = buildLegacyLinkedProjectStagePlan(timestamp);

    expect(plan.currentStage).toBe("design");
    expect(plan.stages.map(stage => [stage.stageId, stage.status, stage.progress])).toEqual([
      ["sow", "completed", 100],
      ["jira", "completed", 100],
      ["risks", "completed", 100],
      ["planning", "completed", 100],
      ["design", "in_progress", 0],
      ["closure", "locked", 0],
    ]);
    expect(plan.stages.slice(0, 4).every(stage => stage.completedAt === timestamp)).toBe(true);
  });
});

describe("reconstrucción canónica H4", () => {
  it("inicia en SoW y no completa ninguna etapa sin evidencia", () => {
    const plan = buildCanonicalLinkedProjectStagePlan();

    expect(plan.currentStage).toBe("sow");
    expect(plan.stages.map(stage => [stage.stageId, stage.status, stage.progress])).toEqual([
      ["sow", "in_progress", 0],
      ["jira", "locked", 0],
      ["risks", "locked", 0],
      ["planning", "locked", 0],
      ["design", "locked", 0],
      ["closure", "locked", 0],
    ]);
    expect(plan.stages.every(stage => stage.data.homologation.message === "[PENDIENTE DE EVIDENCIA]")).toBe(true);
  });

  it("conserva exactamente las seis etapas canónicas sin una etapa adicional de onboarding", () => {
    expect(buildCanonicalLinkedProjectStagePlan().stages.map(stage => stage.stageId)).toEqual(CANONICAL_PROJECT_STAGE_IDS);
  });
});

describe("fixture Jira sanitizado", () => {
  it("incluye candidatos y faltantes de calidad sin datos reales ni escrituras", () => {
    expect(SANITIZED_JIRA_ONBOARDING_FIXTURE.project.key).toBe("PILOT");
    expect(SANITIZED_JIRA_ONBOARDING_FIXTURE.issues.map(issue => issue.issueType)).toEqual([
      "Hito PMO",
      "Riesgos PMO",
      "Epic",
    ]);
    expect(SANITIZED_JIRA_ONBOARDING_FIXTURE.issues.some(issue => issue.dueDate === null)).toBe(true);
    expect(SANITIZED_JIRA_ONBOARDING_FIXTURE.issues.some(issue => issue.assigneeAccountId === null)).toBe(true);
    expect(JSON.stringify(SANITIZED_JIRA_ONBOARDING_FIXTURE)).not.toMatch(/@|atlassian\.net|prodigio\.tech/i);
  });
});

describe("persistencia H1 de onboarding y trazabilidad", () => {
  it("expone las cuatro tablas físicas aprobadas", () => {
    expect([
      getTableName(jiraProjectOnboardings),
      getTableName(jiraEntityMappings),
      getTableName(jiraSyncLogs),
      getTableName(jiraImportExceptions),
    ]).toEqual([
      "jira_project_onboarding",
      "jira_entity_mapping",
      "jira_sync_log",
      "jira_import_exception",
    ]);
  });

  it("incluye claves de idempotencia, versión, snapshot y resolución explícita", () => {
    expect(jiraProjectOnboardings.jiraProjectKey).toBeDefined();
    expect(jiraProjectOnboardings.sourceSnapshot).toBeDefined();
    expect(jiraProjectOnboardings.mappingVersion).toBeDefined();
    expect(jiraEntityMappings.mappingKey).toBeDefined();
    expect(jiraEntityMappings.syncDirection).toBeDefined();
    expect(jiraSyncLogs.runId).toBeDefined();
    expect(jiraSyncLogs.errorCount).toBeDefined();
    expect(jiraImportExceptions.resolution).toBeDefined();
    expect(jiraImportExceptions.resolvedAt).toBeDefined();
  });
});
