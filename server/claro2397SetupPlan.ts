export const CLARO_2397_ID = 3090001;
export const CLARO_2397_SPACE = "MDSCE2937";

export function buildClaro2397SetupPlan(input: {
  service: { id: number; dealId: string | number | null; jsmProjectKey: string | null; status: string };
  workItems: Array<{ id: number; jiraIssueKey: string | null }>;
  billing: Array<{ id: number; monthNumber: number; jiraIssueKey: string | null }>;
  workIssues: Array<{ key: string; fields: { project?: { key: string }; summary: string } }>;
  billingIssues: Array<{ key: string; fields: { project?: { key: string }; summary: string } }>;
}) {
  if (input.service.id !== CLARO_2397_ID || String(input.service.dealId) !== "2397" || input.service.jsmProjectKey !== CLARO_2397_SPACE || input.service.status !== "activo") throw Error("Identidad/lifecycle Claro2397 no válidos");
  if (input.workItems.length !== 32 || input.billing.length !== 12) throw Error("Inventario contractual cambió; detener y revisar");
  const keys = new Set<string>();
  for (const item of input.workItems) {
    const issue = input.workIssues.find(issue => issue.key === item.jiraIssueKey);
    if (!item.jiraIssueKey || !issue || issue.fields.project?.key !== CLARO_2397_SPACE || keys.has(item.jiraIssueKey)) throw Error("Actividad sin referencia única verificada en JSM");
    keys.add(item.jiraIssueKey);
  }
  const months = new Set<number>();
  const bindings = input.billing.map(item => {
    const expected = `MDS2937-${55 + item.monthNumber}`;
    const issue = input.billingIssues.find(issue => issue.key === expected);
    const observedMonth = Number(issue?.fields.summary.match(/Facturaci[oó]n\s+Mes\s+(\d+)\b/i)?.[1]);
    if (item.monthNumber < 1 || item.monthNumber > 12 || months.has(item.monthNumber) || !issue || observedMonth !== item.monthNumber || issue.fields.project?.key !== "MDS2937" || !issue.fields.summary.includes("2397") || (item.jiraIssueKey && item.jiraIssueKey !== expected)) throw Error("Hito existente ambiguo o distinto del Deal/período");
    months.add(item.monthNumber);
    return { entityId: item.id, monthNumber: item.monthNumber, jiraIssueKey: expected };
  });
  return {
    bindings,
    policy: { workPlanMode: "external_reference" as const, billingMode: "external_reference" as const, reason: "Reutilización verificada: 32 actividades ya existentes en MDSCE2937 y 12 hitos del Deal2397 en MDS2937. No crear copias ni cambiar tipos, fechas, importes, estados o evidencia. Las cifras históricas de Jira se conservan separadas de la programación PMO; el enlace no acredita emisión de factura." },
  };
}
