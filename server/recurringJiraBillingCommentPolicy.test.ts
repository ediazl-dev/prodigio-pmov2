import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminSettingValue: vi.fn(),
}));

vi.mock("./db", () => ({ getAdminSettingValue: mocks.getAdminSettingValue }));

import type { JiraIssue } from "./jiraClient";
import {
  getExplicitJiraBillingCommentConfirmation,
  getRecurringJiraBillingCommentPolicyKey,
  loadRecurringJiraBillingCommentPolicy,
  parseRecurringJiraBillingCommentPolicy,
  type RecurringJiraBillingCommentPolicy,
} from "./recurringJiraBillingCommentPolicy";

const scope = { serviceId: 2100001, projectId: "13011", projectKey: "CAMANSOP01" };
const policy: RecurringJiraBillingCommentPolicy = {
  version: 1,
  serviceId: scope.serviceId,
  projectId: scope.projectId,
  projectKey: scope.projectKey,
  issueKeys: ["CAMANSOP01-20", "CAMANSOP01-21", "CAMANSOP01-22", "CAMANSOP01-23", "CAMANSOP01-24", "CAMANSOP01-25"],
  authorAccountIds: ["Aiza619253aed5986c006a543998"],
  verifiedAt: "2026-10-21T21:00:00.000Z",
};

function issue(overrides: Record<string, unknown> = {}): JiraIssue {
  return {
    id: "10020",
    key: "CAMANSOP01-20",
    self: "https://jira.example/rest/api/3/issue/10020",
    fields: {
      summary: "Hito 20",
      status: { name: "Done", statusCategory: { name: "Done", key: "done" } },
      issuetype: { name: "Task", subtask: false },
      project: { id: "13011", key: "CAMANSOP01", name: "Camanchaca" },
      labels: [],
      created: "2026-10-01T10:00:00.000Z",
      updated: "2026-10-21T10:00:00.000Z",
      ...overrides,
    },
  } as JiraIssue;
}

function comment(
  text: string,
  input: { id?: string; updated?: string; accountId?: string; accountType?: string; displayName?: string } = {},
): Record<string, unknown> {
  return {
    id: input.id ?? "comment-1",
    updated: input.updated ?? "2026-10-21T10:00:00.000Z",
    author: {
      accountId: input.accountId ?? policy.authorAccountIds[0],
      accountType: input.accountType ?? "atlassian",
      displayName: input.displayName ?? "Autora verificada",
    },
    body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  };
}

function withComments(comments: unknown[], total = comments.length, extraFields: Record<string, unknown> = {}): JiraIssue {
  return issue({
    ...extraFields,
    comment: { startAt: 0, total, maxResults: comments.length, comments },
  });
}

describe("recurringJiraBillingCommentPolicy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("construye la clave persistida por serviceId", () => {
    expect(getRecurringJiraBillingCommentPolicyKey(scope.serviceId)).toBe("recurring-jira-billing-comment-policy:2100001");
  });

  it("carga una política JSON con scope exacto, seis issues y autores verificados", async () => {
    mocks.getAdminSettingValue.mockResolvedValueOnce(JSON.stringify(policy));

    await expect(loadRecurringJiraBillingCommentPolicy(scope)).resolves.toEqual({ policy, present: true, error: null });
    expect(mocks.getAdminSettingValue).toHaveBeenCalledWith("recurring-jira-billing-comment-policy:2100001");
  });

  it("rechaza serviceId, projectId o projectKey fuera del scope exacto", () => {
    expect(() => parseRecurringJiraBillingCommentPolicy({ ...policy, serviceId: 2100002 }, scope)).toThrow(/serviceId/);
    expect(() => parseRecurringJiraBillingCommentPolicy({ ...policy, projectId: "99999" }, scope)).toThrow(/projectId/);
    expect(() => parseRecurringJiraBillingCommentPolicy({ ...policy, projectKey: "OTRO" }, scope)).toThrow(/projectKey/);
    expect(() => parseRecurringJiraBillingCommentPolicy({ ...policy, issueKeys: ["CAMANSOP01-20"] }, scope)).toThrow(/6/);
  });

  it("distingue ausencia, JSON malformado y error de lectura sin fallback", async () => {
    mocks.getAdminSettingValue.mockResolvedValueOnce(null);
    await expect(loadRecurringJiraBillingCommentPolicy(scope)).resolves.toEqual({ policy: null, present: false, error: null });

    mocks.getAdminSettingValue.mockResolvedValueOnce("{malformado");
    const malformed = await loadRecurringJiraBillingCommentPolicy(scope);
    expect(malformed).toMatchObject({ policy: null, present: true });
    expect(malformed.error).toMatch(/JSON/);

    mocks.getAdminSettingValue.mockRejectedValueOnce(new Error("Database no disponible"));
    const failed = await loadRecurringJiraBillingCommentPolicy(scope);
    expect(failed).toMatchObject({ policy: null, present: true });
    expect(failed.error).toMatch(/No se pudo leer/);
  });

  it("requiere proyecto, issue explícito y comentarios completos; falta paginación devuelve null", () => {
    expect(getExplicitJiraBillingCommentConfirmation(withComments([comment("Facturado")], 2), policy)).toBeNull();
    expect(getExplicitJiraBillingCommentConfirmation(withComments([comment("Facturado")], 1, { project: { id: "999", key: "CAMANSOP01" } }), policy)).toBeNull();
    expect(getExplicitJiraBillingCommentConfirmation(withComments([comment("Facturado")], 1), { ...policy, issueKeys: ["CAMANSOP01-21", ...policy.issueKeys.slice(1)] })).toBeNull();
  });

  it("acepta sólo accountType atlassian y authorAccountIds allowlisted", () => {
    const wrongType = withComments([comment("Facturado", { accountType: "app" })]);
    const wrongAuthor = withComments([comment("Facturado", { accountId: "otro-autor" })]);
    expect(getExplicitJiraBillingCommentConfirmation(wrongType, policy)).toBeNull();
    expect(getExplicitJiraBillingCommentConfirmation(wrongAuthor, policy)).toBeNull();
  });

  it("no usa Done ni etiquetas PMO generadas como confirmación", () => {
    const doneOnly = issue({ comment: { startAt: 0, total: 0, comments: [] } });
    expect(getExplicitJiraBillingCommentConfirmation(doneOnly, policy)).toBeNull();

    const generated = withComments([comment("Facturado")], 1, { labels: ["pmo-recurring"] });
    expect(getExplicitJiraBillingCommentConfirmation(generated, policy)).toBeNull();
  });

  it.each([
    "Facturado",
    "Facturación confirmada",
    "Facturación confirmada el 15/09",
    "Confirmada facturación, asociada a la HES",
    "Facturación completada asociada a la HES https://example.test/hes/20",
    "Facturación completada asociada a la HES https://drive.google.com/file/d/document/view?usp=sharing",
  ])("reconoce la frase positiva explícita %s", (text) => {
    const result = getExplicitJiraBillingCommentConfirmation(withComments([comment(text)]), policy);
    expect(result).toMatchObject({ status: "billed", id: "comment-1", authorAccountId: policy.authorAccountIds[0], updatedAt: "2026-10-21T10:00:00.000Z" });
    expect(result?.text).toContain(text.replace("https://example.test/hes/20", "https://example.test/hes/20"));
  });

  it("reconoce los tres negativos explícitos y no trata HES sola como estado", () => {
    for (const text of ["No facturado", "Facturación anulada", "Facturación no confirmada"]) {
      expect(getExplicitJiraBillingCommentConfirmation(withComments([comment(text)]), policy)?.status).toBe("not_billed");
    }
    expect(getExplicitJiraBillingCommentConfirmation(withComments([comment("HES https://example.test/hes/20")]), policy)).toBeNull();
  });

  it("usa el último timestamp relevante: una anulación posterior supera Facturado anterior", () => {
    const result = getExplicitJiraBillingCommentConfirmation(withComments([
      comment("Facturado", { id: "old", updated: "2026-10-20T10:00:00.000Z" }),
      comment("Facturación anulada", { id: "new", updated: "2026-10-21T10:00:00.000Z" }),
    ]), policy);
    expect(result).toMatchObject({ status: "not_billed", id: "new" });
  });

  it("devuelve unknown si hay estados contrarios en el mismo timestamp", () => {
    const result = getExplicitJiraBillingCommentConfirmation(withComments([
      comment("Facturado", { id: "yes", updated: "2026-10-21T10:00:00.000Z" }),
      comment("No facturado", { id: "no", updated: "2026-10-21T10:00:00.000Z" }),
    ]), policy);
    expect(result).toMatchObject({ status: "unknown" });
  });

  it("ignora preguntas, tentativos, futuras acciones, citas y textos de otras issues", () => {
    const texts = [
      "¿Facturado?",
      "Facturado tentativamente, por confirmar",
      "Se facturará el próximo mes",
      "> Facturado",
      "Facturado en CAMANSOP01-21; se revisa otra issue",
    ];
    for (const text of texts) {
      expect(getExplicitJiraBillingCommentConfirmation(withComments([comment(text)]), policy)).toBeNull();
    }
  });

  it("mantiene Facturado anterior cuando el comentario posterior sólo habla de eliminar una URL y no aplica", () => {
    const result = getExplicitJiraBillingCommentConfirmation(withComments([
      comment("Facturado", { id: "confirmed", updated: "2026-10-20T10:00:00.000Z" }),
      comment("URL https://example.test/hes/20 se elimina porque no aplica", { id: "noise", updated: "2026-10-21T10:00:00.000Z" }),
    ]), policy);
    expect(result).toMatchObject({ status: "billed", id: "confirmed" });
  });
});
