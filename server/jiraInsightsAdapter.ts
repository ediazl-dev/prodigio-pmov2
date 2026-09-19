/**
 * Adaptador entre los issues crudos de Jira y el motor de insights.
 *
 * Existe para que el cambio dentro de `jiraClient.ts` sea de tres líneas y toda
 * la clasificación quede aquí, testeada y en un solo lugar.
 *
 * Lo importante que resuelve: **un riesgo, una épica y un hito NO son tareas.**
 * Hoy `percentComplete` divide por `allIssues.length`, que mezcla los cuatro
 * tipos. En CCLA eso da 2/57 = 4%, cuando las tareas reales son 24 y el avance
 * operacional es 8%. Aquí cada issue se clasifica por su tipo antes de contarse.
 */

import type { IssueCategory, IssueKind, InsightIssue } from "./jiraProgressInsights";

/** Forma mínima de un issue de Jira. Evita acoplar el motor al cliente. */
export interface RawJiraIssue {
  key: string;
  fields: {
    summary?: string;
    status?: { name?: string; statusCategory?: { name?: string } };
    issuetype?: { name?: string };
    assignee?: { displayName?: string } | null;
    duedate?: string | null;
    updated?: string | null;
    parent?: { key?: string } | null;
    [key: string]: unknown;
  };
}

/**
 * Nombres de estado que significan "cerrado" aunque la statusCategory de Jira
 * diga otra cosa. Se replican de `jiraClient.ts`, donde ya existen: varios
 * proyectos tienen la categoría mal configurada y sin esto el avance miente.
 */
const DONE_STATUS_NAMES = new Set([
  "finalizada", "done", "cerrado", "closed", "cumplido", "cumplido (entregable)",
  "resuelto", "resolved", "completado", "completed", "terminado",
]);

const IN_PROGRESS_STATUS_NAMES = new Set([
  "in progress", "en progreso", "actividades en curso", "activo", "en curso",
  "analizado", "identificado",
]);

export function classifyCategory(statusCategory: string | undefined, statusName: string | undefined): IssueCategory {
  const name = (statusName ?? "").toLowerCase().trim();
  if (statusCategory === "Done" || DONE_STATUS_NAMES.has(name)) return "Done";
  if (statusCategory === "In Progress" || IN_PROGRESS_STATUS_NAMES.has(name)) return "In Progress";
  return "To Do";
}

/** Un issue de Jira es una tarea solo si no es épica, hito, riesgo ni cambio de alcance. */
export function classifyKind(issueType: string | undefined): IssueKind {
  const type = (issueType ?? "").toLowerCase().trim();
  if (type === "epic" || type === "épica" || type === "epica") return "epic";
  if (type.includes("hito") || type.includes("milestone")) return "milestone";
  if (type.includes("riesgo") || type.includes("risk")) return "risk";
  if (type.includes("cambio de alcance") || type.includes("scope change")) return "scope_change";
  if ((type.includes("proyecto") || type.includes("project")) && type.includes("avance")) return "progress_marker";
  return "task";
}

export function toInsightIssues(issues: RawJiraIssue[]): InsightIssue[] {
  return issues.map(issue => {
    const statusName = issue.fields.status?.name ?? "Unknown";
    return {
      key: issue.key,
      summary: issue.fields.summary ?? issue.key,
      kind: classifyKind(issue.fields.issuetype?.name),
      status: statusName,
      category: classifyCategory(issue.fields.status?.statusCategory?.name, statusName),
      assignee: issue.fields.assignee?.displayName ?? null,
      dueDate: issue.fields.duedate ?? null,
      updated: issue.fields.updated ?? null,
      parentKey: issue.fields.parent?.key ?? null,
    };
  });
}
