export type InternalPlanActivity = {
  code: string; track: string; title: string; startDay: number; endDay: number;
  deliverable: string; gate?: string | null; dependency?: string | null;
  owner?: string | null; status: string; progress: number; notes?: string | null;
};
export type InternalPlanGate = { code: string; day: number; criterion: string; evidence: string; approver?: string | null; status: string; actualDate?: string | null };
export type NexosInternalManifest = { projectId: number; jiraProjectKey: string; sha256: string; fileName: string; activities: InternalPlanActivity[]; gates: InternalPlanGate[] };
export type InternalPlanJiraIssue = { id: string; key: string; fields: { summary: string; issuetype?: { name?: string }; status?: { name?: string; statusCategory?: { key?: string } }; duedate?: string | null; assignee?: { displayName?: string } | null; parent?: { key?: string } | null } };

export function internalPlanDate(dayOne: string | null, relativeDay: number, holidays: readonly string[] = []): string | null {
  if (!dayOne) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayOne) || !Number.isInteger(relativeDay) || relativeDay < 1) throw new Error("Fecha o día relativo inválido");
  const current = new Date(`${dayOne}T00:00:00Z`);
  if (!Number.isFinite(current.getTime()) || current.toISOString().slice(0, 10) !== dayOne) throw new Error("Fecha de inicio inválida");
  const isWorking = () => current.getUTCDay() !== 0 && current.getUTCDay() !== 6 && !holidays.includes(current.toISOString().slice(0, 10));
  if (!isWorking()) throw new Error("El Día 1 debe ser un día hábil");
  let day = 1;
  while (day < relativeDay) { current.setUTCDate(current.getUTCDate() + 1); if (isWorking()) day++; }
  return current.toISOString().slice(0, 10);
}

export function buildNexosInternalPlan(manifest: NexosInternalManifest, issues: InternalPlanJiraIssue[], dayOne: string | null, holidays: readonly string[] = []) {
  if (manifest.projectId !== 4470001 || manifest.jiraProjectKey !== "PMOPRONEX" || manifest.activities.length !== 19 || manifest.gates.length !== 4) throw new Error("Identidad o cardinalidad del plan no coincide");
  if (new Set(manifest.activities.map(a => a.code)).size !== 19 || new Set(issues.map(i => i.key)).size !== issues.length) throw new Error("Duplicidad de actividades o claves");
  const activities = manifest.activities.map(activity => {
    if (!/^A\d{2}$/.test(activity.code) || activity.startDay < 1 || activity.endDay > 15 || activity.endDay < activity.startDay || activity.progress < 0 || activity.progress > 1) throw new Error("Actividad inválida: " + activity.code);
    const matches = issues.filter(i => new RegExp(`^${activity.code}\\b`).test(i.fields.summary));
    if (matches.length !== 1 || !matches[0].key.startsWith("PMOPRONEX-")) throw new Error("No hay una única referencia Jira para " + activity.code);
    const issue = matches[0];
    return {
      ...activity, jiraIssueKey: issue.key, jiraIssueId: issue.id,
      jiraParentKey: issue.fields.parent?.key ?? null,
      jiraStatusName: issue.fields.status?.name ?? null,
      jiraStatusCategory: issue.fields.status?.statusCategory?.key ?? null,
      jiraAssignee: issue.fields.assignee?.displayName ?? null,
      jiraDueDate: issue.fields.duedate ?? null,
      baselineStartDate: internalPlanDate(dayOne, activity.startDay, holidays),
      baselineEndDate: internalPlanDate(dayOne, activity.endDay, holidays),
      plannedDays: activity.endDay - activity.startDay + 1,
      progressSource: "uploaded_work_plan" as const,
    };
  });
  const gates = manifest.gates.map(gate => {
    const matches = activities.filter(a => a.gate === gate.code);
    if (matches.length !== 1 || matches[0].endDay !== gate.day) throw new Error("Gate no coincide con el plan: " + gate.code);
    const activity = matches[0];
    if (gate.actualDate || !/^pendiente$/i.test(gate.status)) throw new Error("Esta importación no acepta gates previamente cumplidos sin evidencia");
    return { ...gate, activityCode: activity.code, jiraIssueKey: activity.jiraIssueKey,
      jiraIssueId: activity.jiraIssueId, title: `${gate.code} · ${activity.deliverable}`,
      baselineDate: activity.baselineEndDate, jiraDueDate: activity.jiraDueDate,
      jiraStatusName: activity.jiraStatusName, billingWeight: 0, acceptedAt: null,
      economicPurpose: "delivery_only" as const,
    };
  });
  return { projectId: manifest.projectId, projectNature: "internal" as const, hasRevenue: false as const,
    baselineStartDate: dayOne, baselineKind: "internal_work_plan" as const,
    activities, gates, billingMilestones: [], projectStatus: "activo" as const };
}
