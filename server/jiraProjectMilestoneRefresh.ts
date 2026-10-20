import { deriveJiraMilestoneObservation } from "./jiraMilestoneSync";

export type RefreshMilestone = {
  id: number; milestoneCode: string; jiraIssueKey: string; title: string;
  billingWeight: string; baselineDate: string | null; jiraDueDate: string | null;
  jiraClosedDate: string | null; jiraStatusName: string | null;
  semanticStatus: "pending" | "fulfilled" | "delayed" | "blocked";
};
export type RefreshJiraIssue = {
  key: string;
  fields: { summary: string; issuetype?: { name?: string }; duedate?: string | null;
    resolutiondate?: string | null; updated?: string;
    status?: { name?: string | null; statusCategory?: { key?: string | null } | null } | null };
};

export function parseJiraMilestoneWeight(summary: string): string {
  const matches = Array.from(summary.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g));
  if (matches.length !== 1) throw new Error("Cada hito debe informar un único porcentaje Jira explícito.");
  const value = Number(matches[0][1].replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Porcentaje Jira inválido.");
  return value.toFixed(2);
}

/** Actualiza únicamente observaciones; nunca copia duedate al baseline ni registra aceptación/factura. */
export function buildProjectMilestoneRefreshPlan(input: {
  existing: RefreshMilestone[]; issues: RefreshJiraIssue[]; projectKey: string;
  syncObservedWeights: boolean; now: Date;
}) {
  const issues = input.issues.filter(issue => /hito|milestone/i.test(issue.fields.issuetype?.name ?? ""));
  const keys = issues.map(issue => issue.key);
  if (new Set(keys).size !== keys.length || issues.some(issue => !issue.key.startsWith(`${input.projectKey}-`))) throw new Error("Claves Jira duplicadas o fuera del proyecto.");
  const existingKeys = input.existing.map(item => item.jiraIssueKey);
  if (new Set(existingKeys).size !== existingKeys.length) throw new Error("Mapping PMO ambiguo.");
  if (existingKeys.some(key => !keys.includes(key))) throw new Error("Faltan hitos PMO en la respuesta Jira; detener sin borrar.");
  const rows = issues.map(issue => {
    const existing = input.existing.find(item => item.jiraIssueKey === issue.key);
    const number = issue.fields.summary.match(/^H(\d+)\s*[-–:]/i)?.[1];
    if (!existing && number == null) throw new Error("Hito nuevo sin código H explícito.");
    const milestoneCode = existing?.milestoneCode ?? `M${String(Number(number)).padStart(2, "0")}`;
    const observation = deriveJiraMilestoneObservation(issue, input.now);
    const billingWeight = input.syncObservedWeights ? parseJiraMilestoneWeight(issue.fields.summary) : existing?.billingWeight ?? "0.00";
    const values = { title: issue.fields.summary, billingWeight, ...observation };
    const changed = !existing || Object.entries(values).some(([key,value]) => existing[key as keyof RefreshMilestone] !== value);
    return { id: existing?.id ?? null, milestoneCode, jiraIssueKey: issue.key, baselineDate: existing?.baselineDate ?? null, values, changed };
  }).sort((a,b) => a.milestoneCode.localeCompare(b.milestoneCode));
  if (new Set(rows.map(row => row.milestoneCode)).size !== rows.length) throw new Error("Código de hito duplicado.");
  const totalWeight = Math.round(rows.reduce((sum,row) => sum + Number(row.values.billingWeight),0) * 100) / 100;
  if (input.syncObservedWeights && Math.abs(totalWeight - 100) > 0.01) throw new Error("Los pesos observados Jira no suman 100%; requieren reconciliación humana.");
  return { rows, totalWeight, created: rows.filter(row => row.id == null).length, updated: rows.filter(row => row.id != null && row.changed).length };
}
