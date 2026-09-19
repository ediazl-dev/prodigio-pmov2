import { ENV } from "./_core/env";

// ==================== JIRA REST API v3 Client ====================

const JIRA_BASE = ENV.jiraBaseUrl;
const JIRA_AUTH = Buffer.from(`${ENV.jiraEmail}:${ENV.jiraApiToken}`).toString("base64");

interface JiraRequestOptions {
  method?: string;
  body?: any;
  params?: Record<string, string>;
}

async function jiraFetch<T = any>(path: string, options: JiraRequestOptions = {}): Promise<T> {
  const { method = "GET", body, params } = options;
  let url = `${JIRA_BASE}/rest/api/3${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }
  const headers: Record<string, string> = {
    Authorization: `Basic ${JIRA_AUTH}`,
    Accept: "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`JIRA API error ${resp.status}: ${text}`);
  }

  const contentType = resp.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return resp.json() as Promise<T>;
  }
  return {} as T;
}

async function jiraServiceDeskFetch<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  let url = `${JIRA_BASE}/rest/servicedeskapi${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${JIRA_AUTH}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`JSM API error ${resp.status}: ${text}`);
  }

  const contentType = resp.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return resp.json() as Promise<T>;
  }
  return {} as T;
}

// ==================== Projects ====================

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  style: string;
  avatarUrls: Record<string, string>;
  lead?: { displayName: string; accountId: string };
  archived?: boolean;
  simplified?: boolean;
}

export async function listJiraProjects(): Promise<JiraProject[]> {
  return jiraFetch<JiraProject[]>("/project");
}

export async function getJiraProject(keyOrId: string): Promise<JiraProject & { issueTypes: any[] }> {
  return jiraFetch(`/project/${keyOrId}`);
}

// ==================== Jira Service Management (read only) ====================

export interface JsmServiceDesk {
  id: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  _links?: { self?: string };
}

interface JsmPagedResponse<T> {
  size: number;
  start: number;
  limit: number;
  isLastPage: boolean;
  values: T[];
  _links?: { base?: string; context?: string; next?: string; self?: string };
}

export interface JiraProjectPermission {
  id?: string;
  key: string;
  name?: string;
  type?: string;
  description?: string;
  havePermission: boolean;
}

export interface JiraProjectIssueType {
  id: string;
  name: string;
  description?: string;
  subtask?: boolean;
}

/** Lists every Service Desk visible to the configured technical identity. Read-only. */
export async function listJsmServiceDesks(options: { pageSize?: number; maxItems?: number } = {}): Promise<JsmServiceDesk[]> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
  const maxItems = Math.min(Math.max(options.maxItems ?? 1000, 1), 5000);
  const serviceDesks: JsmServiceDesk[] = [];
  let start = 0;

  while (serviceDesks.length < maxItems) {
    const page = await jiraServiceDeskFetch<JsmPagedResponse<JsmServiceDesk>>("/servicedesk", {
      start: String(start),
      limit: String(pageSize),
    });
    const values = Array.isArray(page.values) ? page.values : [];
    serviceDesks.push(...values.slice(0, maxItems - serviceDesks.length));

    if (page.isLastPage || values.length === 0) break;
    start = page.start + page.limit;
  }

  return serviceDesks;
}

/** Reads one Service Desk by its JSM identifier. Read-only. */
export async function getJsmServiceDesk(serviceDeskId: string): Promise<JsmServiceDesk> {
  return jiraServiceDeskFetch<JsmServiceDesk>(`/servicedesk/${encodeURIComponent(serviceDeskId)}`);
}

/** Reads effective project permissions for the configured technical identity. Read-only. */
export async function getJiraProjectPermissions(projectKey: string): Promise<Record<string, JiraProjectPermission>> {
  const result = await jiraFetch<{
    permissions: Record<string, JiraProjectPermission>;
  }>("/mypermissions", {
    params: {
      projectKey,
      permissions: "BROWSE_PROJECTS,CREATE_ISSUES",
    },
  });
  return result.permissions ?? {};
}

/** Reads issue types enabled for the Jira project. Read-only. */
export async function getJiraProjectIssueTypes(projectId: string): Promise<JiraProjectIssueType[]> {
  const issueTypes = await jiraFetch<JiraProjectIssueType[]>("/issuetype/project", {
    params: { projectId },
  });
  return Array.isArray(issueTypes) ? issueTypes : [];
}

export function buildJsmProjectUrls(projectKey: string, serviceDeskId: string) {
  return {
    agentUrl: `${JIRA_BASE}/jira/servicedesk/projects/${encodeURIComponent(projectKey)}/boards`,
    portalUrl: `${JIRA_BASE}/servicedesk/customer/portal/${encodeURIComponent(serviceDeskId)}`,
  };
}

// ==================== Issues (Search) ====================

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { name: string; key: string } };
    issuetype: { id?: string; name: string; subtask: boolean };
    project?: { id: string; key: string; name: string };
    assignee?: {
      displayName: string;
      accountId: string;
      avatarUrls?: Record<string, string>;
    } | null;
    priority?: { name: string; iconUrl: string } | null;
    created: string;
    updated: string;
    description?: any;
    labels?: string[];
    [key: string]: any;
  };
}

interface JiraSearchResult {
  issues: JiraIssue[];
  total?: number;
  nextPageToken?: string;
  isLast?: boolean;
}

export interface JsmSlaCycle {
  startTime?: { epochMillis?: number; iso8601?: string };
  stopTime?: { epochMillis?: number; iso8601?: string };
  breachTime?: { epochMillis?: number; iso8601?: string };
  breached?: boolean;
  paused?: boolean;
  withinCalendarHours?: boolean;
  goalDuration?: { millis?: number; friendly?: string };
  elapsedTime?: { millis?: number; friendly?: string };
  remainingTime?: { millis?: number; friendly?: string };
}

export interface JsmSlaInformation {
  name: string;
  completedCycles?: JsmSlaCycle[];
  ongoingCycle?: JsmSlaCycle | null;
}

export interface JsmSlaPage {
  size?: number;
  start?: number;
  limit?: number;
  isLastPage?: boolean;
  values: JsmSlaInformation[];
}

export async function searchJiraIssues(
  jql: string,
  options: {
    maxResults?: number;
    nextPageToken?: string;
    fields?: string[];
  } = {}
): Promise<JiraSearchResult> {
  const { maxResults = 50, nextPageToken, fields = ["summary", "status", "issuetype", "assignee", "priority", "created", "updated", "labels"] } = options;
  const body: any = { jql, maxResults, fields };
  if (nextPageToken) body.nextPageToken = nextPageToken;
  return jiraFetch<JiraSearchResult>("/search/jql", {
    method: "POST",
    body,
  });
}

export async function getJsmRequestSlas(issueIdOrKey: string, start = 0, limit = 50): Promise<JsmSlaPage> {
  return jiraServiceDeskFetch<JsmSlaPage>(`/request/${encodeURIComponent(issueIdOrKey)}/sla`, {
    start: String(start),
    limit: String(limit),
  });
}

export async function getProjectIssues(
  projectKey: string,
  options: {
    maxResults?: number;
    nextPageToken?: string;
    statusCategory?: string;
  } = {}
): Promise<JiraSearchResult> {
  let jql = `project=${projectKey} ORDER BY created DESC`;
  if (options.statusCategory) {
    jql = `project=${projectKey} AND statusCategory="${options.statusCategory}" ORDER BY created DESC`;
  }
  return searchJiraIssues(jql, {
    maxResults: options.maxResults,
    nextPageToken: options.nextPageToken,
  });
}

/** Count issues matching a JQL query (fetches 0 results, reads total from response) */
export async function countJiraIssues(jql: string): Promise<number> {
  const result = await searchJiraIssues(jql, { maxResults: 1 });
  // New API doesn't return total, so we need to paginate to count.
  // For stats, we fetch a page and count manually.
  // Alternative: use maxResults=0 but API requires at least 1
  return result.issues.length;
}

// ==================== Issue Details ====================

export async function getJiraIssue(issueKey: string): Promise<JiraIssue> {
  return jiraFetch<JiraIssue>(`/issue/${issueKey}`, {
    params: {
      fields: "summary,status,issuetype,project,assignee,priority,created,updated,labels,description",
    },
  });
}

// ==================== Create Issue ====================

export interface CreateIssueInput {
  projectKey: string;
  summary: string;
  issueTypeName?: string; // defaults to "Task" (auto-resolved for JSM next-gen)
  issueTypeId?: string; // strict mode: Jira receives this exact configured type, without fallback
  description?: string;
  assigneeAccountId?: string;
  labels?: string[];
  dueDate?: string; // YYYY-MM-DD
}

// Cache de issue types por proyecto para evitar llamadas repetidas
const _issueTypeCache: Record<string, string[]> = {};

/**
 * Obtiene el primer issue type disponible para un proyecto.
 * En proyectos JSM next-gen, "Task" no existe — se usa el primer tipo disponible (ej: "Get IT help").
 * En proyectos PMO classic, devuelve "Task" directamente.
 */
async function resolveIssueTypeName(projectKey: string, preferred: string): Promise<string> {
  if (!_issueTypeCache[projectKey]) {
    try {
      const proj = await jiraFetch<{
        id: string;
        projectTypeKey?: string;
        style?: string;
        issueTypes?: Array<{ name: string }>;
      }>(`/project/${projectKey}`);
      // Obtener issue types via endpoint dedicado usando el ID numérico del proyecto
      const types = await jiraFetch<Array<{ id: string; name: string }>>(`/issuetype/project?projectId=${proj.id}`);
      _issueTypeCache[projectKey] = Array.isArray(types) ? types.map(t => t.name) : [];
    } catch {
      return preferred; // fallback al tipo solicitado si falla la consulta
    }
  }
  const available = _issueTypeCache[projectKey];
  if (!available.length) return preferred;
  // Si el tipo preferido está disponible, usarlo
  if (available.includes(preferred)) return preferred;
  // En JSM next-gen: preferir "Get IT help" como equivalente a Task, sino el primero disponible
  const fallbackOrder = ["Get IT help", "Email request", "Report an incident", "Service Request"];
  for (const fb of fallbackOrder) {
    if (available.includes(fb)) return fb;
  }
  return available[0];
}

export async function createJiraIssue(input: CreateIssueInput): Promise<{ id: string; key: string; self: string }> {
  // JIRA summary limit is 255 characters
  const rawSummary = input.summary;
  const summary = rawSummary.length > 255 ? rawSummary.substring(0, 252) + "..." : rawSummary;
  if (rawSummary.length > 255) {
    console.warn(`[JIRA] Summary truncated from ${rawSummary.length} to 255 chars: ${rawSummary.substring(0, 80)}...`);
  }
  // Existing callers may still resolve by name; J4 sync always supplies issueTypeId and bypasses fallbacks.
  const resolvedIssueType = input.issueTypeId ? null : await resolveIssueTypeName(input.projectKey, input.issueTypeName ?? "Task");
  const fields: any = {
    project: { key: input.projectKey },
    summary,
    issuetype: input.issueTypeId ? { id: input.issueTypeId } : { name: resolvedIssueType },
  };
  if (input.description) {
    // Split long descriptions into multiple paragraphs for ADF format
    const paragraphs = input.description.split("\n").filter(Boolean);
    fields.description = {
      type: "doc",
      version: 1,
      content: paragraphs.map(p => ({
        type: "paragraph",
        content: [{ type: "text", text: p }],
      })),
    };
  }
  if (input.assigneeAccountId) {
    fields.assignee = { accountId: input.assigneeAccountId };
  }
  if (input.labels?.length) {
    fields.labels = input.labels;
  }
  if (input.dueDate) {
    // Normalize dueDate to YYYY-MM-DD (JIRA requires this exact format)
    const normalized = input.dueDate.includes("T") ? input.dueDate.split("T")[0] : input.dueDate;
    fields.duedate = normalized;
  }
  return jiraFetch("/issue", { method: "POST", body: { fields } });
}

// ==================== Project Statuses ====================

export async function getProjectStatuses(projectKey: string): Promise<
  Array<{
    name: string;
    statuses: Array<{
      name: string;
      id: string;
      statusCategory: { name: string };
    }>;
  }>
> {
  return jiraFetch(`/project/${projectKey}/statuses`);
}

// ==================== Issue Transitions ====================

export async function getIssueTransitions(issueKey: string): Promise<{
  transitions: Array<{
    id: string;
    name: string;
    to: { name: string; id: string };
  }>;
}> {
  return jiraFetch(`/issue/${issueKey}/transitions`);
}

/**
 * Transition a JIRA issue to a specific status by name.
 * Finds the transition whose `to.name` matches targetStatusName (case-insensitive).
 * Returns true if successful, false if the transition was not found.
 */
export async function transitionJiraIssue(issueKey: string, targetStatusName: string): Promise<boolean> {
  try {
    const { transitions } = await getIssueTransitions(issueKey);
    const target = transitions.find(t => t.to.name.toLowerCase() === targetStatusName.toLowerCase());
    if (!target) {
      console.warn(`[JIRA] Transition to "${targetStatusName}" not found for issue ${issueKey}. Available: ${transitions.map(t => t.to.name).join(", ")}`);
      return false;
    }
    await jiraFetch(`/issue/${issueKey}/transitions`, {
      method: "POST",
      body: { transition: { id: target.id } },
    });
    return true;
  } catch (err: any) {
    console.warn(`[JIRA] Failed to transition ${issueKey} to "${targetStatusName}": ${err.message}`);
    return false;
  }
}

// ==================== Users (Assignable) ====================

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
  active: boolean;
}

export async function getAssignableUsers(projectKey: string): Promise<JiraUser[]> {
  return jiraFetch<JiraUser[]>("/user/assignable/search", {
    params: { project: projectKey, maxResults: "100" },
  });
}

// ==================== Boards (Agile) ====================

async function jiraAgileFetch<T = any>(path: string, options: JiraRequestOptions = {}): Promise<T> {
  const { method = "GET", body, params } = options;
  let url = `${JIRA_BASE}/rest/agile/1.0${path}`;
  if (params) url += `?${new URLSearchParams(params).toString()}`;
  const headers: Record<string, string> = {
    Authorization: `Basic ${JIRA_AUTH}`,
    Accept: "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";
  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`JIRA Agile API error ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
  location?: { projectKey: string; projectName: string };
}

export async function getProjectBoards(projectKey: string): Promise<JiraBoard[]> {
  const result = await jiraAgileFetch<{ values: JiraBoard[] }>("/board", {
    params: { projectKeyOrId: projectKey },
  });
  return result.values ?? [];
}

// ==================== Corporate Configuration (PPDC HIBRIDO) ====================

/** Corporate JIRA configuration constants for PPDC HIBRIDO projects */
export const PPDC_CONFIG = {
  // Category: PPDC HIBRIDO (id: 10014)
  categoryId: "10014",
  categoryName: "PPDC HIBRIDO",

  // Owner: Eugenio Diaz (cuenta activa — Yanahí 712020:326edb27 fue desactivada)
  ownerAccountId: "5c97e53641803d601d7a09a9",
  ownerName: "Eugenio Diaz",

  // Schema: PPDC: Project Management Issue Type Scheme (id: 12530)
  issueTypeSchemeId: "12530",
  issueTypeSchemeName: "PPDC: Project Management Issue Type Scheme",

  // Workflow: PPDC: Project Management Workflow Scheme (id: 11742)
  workflowSchemeId: "11742",
  workflowSchemeName: "PPDC: Project Management Workflow Scheme",

  // Screen: PPDC: Project Management Issue Type Screen Scheme (id: 11509)
  screenSchemeId: "11509",
  screenSchemeName: "PPDC: Project Management Issue Type Screen Scheme",

  // Notifications: Default Notification Scheme (id: 10000)
  notificationSchemeId: "10000",
  notificationSchemeName: "Default Notification Scheme",

  // Reference project for board structure
  referenceProjectKey: "PRPMTD1",
  referenceProjectName: "[PMO Ruta Pass] Plan Modernización TI - Deal 1996",

  // 5 PMO boards to create in every new Space
  // JQL filters per board (use {KEY} as placeholder for project key)
  pmoBoards: [
    {
      name: "Gestion PMI",
      type: "kanban",
      jqlTemplate: `project = {KEY} AND issuetype in (Task, "Sub-task", Epic, Story) ORDER BY created DESC`,
    },
    {
      name: "Tablero Hito PMO",
      type: "kanban",
      jqlTemplate: `project = {KEY} AND issuetype = "Hito PMO" ORDER BY duedate ASC`,
    },
    {
      name: "Tablero Riesgos PMO",
      type: "kanban",
      jqlTemplate: `project = {KEY} AND issuetype = "Riesgos PMO" ORDER BY priority DESC`,
    },
    {
      name: "Tablero Cambio de Alcance",
      type: "kanban",
      jqlTemplate: `project = {KEY} AND issuetype = "Cambio de Alcance" ORDER BY created DESC`,
    },
    {
      name: "Tablero Proyecto PMO - Avance",
      type: "kanban",
      jqlTemplate: `project = {KEY} AND issuetype = "Proyecto PMO - Avance" ORDER BY updated DESC`,
    },
  ],
};

// ==================== Template Structure (PBTISD1) ====================

export interface JiraTemplateStructure {
  templateKey: string;
  templateName: string;
  projectTypeKey: string;
  boards: Array<{
    name: string;
    type: string;
    boardId?: number;
    filterId?: string;
    jqlTemplate?: string;
  }>;
  issueTypes: Array<{ name: string; description: string; subtask: boolean }>;
  workflows: Array<{
    issueType: string;
    statuses: Array<{ name: string; category: string }>;
  }>;
}

/** Static PPDC issue types - canonical corporate template */
const PPDC_ISSUE_TYPES: Array<{
  name: string;
  description: string;
  subtask: boolean;
}> = [
  { name: "Task", description: "Tarea general del proyecto", subtask: false },
  {
    name: "Sub-task",
    description: "Subtarea asociada a una tarea principal",
    subtask: true,
  },
  {
    name: "Epic",
    description: "Agrupación de tareas de alto nivel",
    subtask: false,
  },
  {
    name: "Story",
    description: "Historia de usuario o requerimiento funcional",
    subtask: false,
  },
  {
    name: "Hito PMO",
    description: "Hito de facturación o entrega del proyecto",
    subtask: false,
  },
  {
    name: "Riesgos PMO",
    description: "Riesgo identificado en la matriz de riesgos",
    subtask: false,
  },
  {
    name: "Cambio de Alcance",
    description: "Solicitud de cambio de alcance del proyecto",
    subtask: false,
  },
  {
    name: "Proyecto PMO - Avance",
    description: "Registro de avance general del proyecto",
    subtask: false,
  },
];

/** Static PPDC workflows - canonical corporate template */
const PPDC_WORKFLOWS: Array<{
  issueType: string;
  statuses: Array<{ name: string; category: string }>;
}> = [
  {
    issueType: "Task",
    statuses: [
      { name: "To Do", category: "To Do" },
      { name: "In Progress", category: "In Progress" },
      { name: "In Review", category: "In Progress" },
      { name: "Done", category: "Done" },
    ],
  },
  {
    issueType: "Hito PMO",
    statuses: [
      { name: "Planificado", category: "To Do" },
      { name: "En Ejecución", category: "In Progress" },
      { name: "Facturado", category: "Done" },
      { name: "Cancelado", category: "Done" },
    ],
  },
  {
    issueType: "Riesgos PMO",
    statuses: [
      { name: "Identificado", category: "To Do" },
      { name: "En Mitigación", category: "In Progress" },
      { name: "Mitigado", category: "Done" },
      { name: "Materializado", category: "In Progress" },
      { name: "Cerrado", category: "Done" },
    ],
  },
  {
    issueType: "Cambio de Alcance",
    statuses: [
      { name: "Solicitado", category: "To Do" },
      { name: "En Evaluación", category: "In Progress" },
      { name: "Aprobado", category: "Done" },
      { name: "Rechazado", category: "Done" },
    ],
  },
  {
    issueType: "Proyecto PMO - Avance",
    statuses: [
      { name: "Abierto", category: "To Do" },
      { name: "En Progreso", category: "In Progress" },
      { name: "Completado", category: "Done" },
    ],
  },
];

/** Fetches the structure of the template project. Falls back to static PPDC config if JIRA API fails. */
export async function getTemplateStructure(templateKey = "PBTISD1"): Promise<JiraTemplateStructure> {
  try {
    const [project, statuses] = await Promise.all([getJiraProject(templateKey), getProjectStatuses(templateKey)]);

    const issueTypes = (project.issueTypes ?? []).map((t: any) => ({
      name: t.name,
      description: t.description ?? "",
      subtask: t.subtask ?? false,
    }));

    const workflows = statuses.map((s: any) => ({
      issueType: s.name,
      statuses: (s.statuses ?? []).map((st: any) => ({
        name: st.name,
        category: st.statusCategory?.name ?? "Unknown",
      })),
    }));

    return {
      templateKey,
      templateName: project.name,
      projectTypeKey: project.projectTypeKey,
      boards: PPDC_CONFIG.pmoBoards,
      issueTypes,
      workflows,
    };
  } catch (err: any) {
    // Fallback: use static PPDC corporate template when JIRA API fails (e.g. template project deleted)
    console.warn(`[JIRA] getTemplateStructure failed for ${templateKey}, using static PPDC fallback: ${err.message}`);
    return {
      templateKey,
      templateName: "PPDC: Project Management Template",
      projectTypeKey: "business",
      boards: PPDC_CONFIG.pmoBoards,
      issueTypes: PPDC_ISSUE_TYPES,
      workflows: PPDC_WORKFLOWS,
    };
  }
}

// ==================== Create JIRA Project (Space) ====================

export interface CreateJiraSpaceInput {
  spaceName: string;
  spaceKey: string;
  description?: string;
  leadAccountId: string;
  /**
   * When set to 'service_desk', creates a JSM project with Mesa de Servicio category (id: 10007).
   * Defaults to 'business' (PPDC HIBRIDO) for PMO projects.
   * Recurring services should always use 'service_desk'.
   */
  projectType?: "business" | "service_desk";
}

/** Corporate JIRA configuration constants for JSM / Mesa de Servicio projects */
export const JSM_CONFIG = {
  // Category: Mesa de Servicio (id: 10007)
  categoryId: "10007",
  categoryName: "Mesa de Servicio",
  // Owner: Eugenio Diaz (cuenta activa — Yanahí 712020:326edb27 fue desactivada)
  ownerAccountId: "5c97e53641803d601d7a09a9",
  // JSM next-gen template key — matches MSCSPP reference standard (style: next-gen, simplified: true)
  // Verified via API testing: this template produces style='next-gen', simplified=true
  // Creates a clean portal with minimal issue types and queues in the tenant language (Spanish)
  projectTemplateKey: "com.atlassian.servicedesk:next-gen-it-service-desk",
  projectTypeKey: "service_desk" as const,
};

export interface CreateJiraSpaceResult {
  success: boolean;
  created: boolean; // true = created in JIRA, false = pending permissions
  jiraProjectId?: string;
  jiraProjectKey?: string;
  jiraProjectName?: string;
  jiraProjectUrl?: string;
  template: JiraTemplateStructure;
  error?: string;
  corporateConfig?: {
    category: string;
    owner: string;
    issueTypeScheme: string;
    workflowScheme: string;
    screenScheme: string;
    notificationScheme: string;
  };
}

/** Attempts to create a JIRA project replicating the PBTISD1 template structure with PPDC corporate configuration. */
export async function createJiraSpace(input: CreateJiraSpaceInput): Promise<CreateJiraSpaceResult> {
  // Always fetch the template structure first (used for preview and result summary)
  const template = await getTemplateStructure("PBTISD1");

  // Determine if this is a JSM (service_desk) or standard PMO (business) project
  const isJSM = input.projectType === "service_desk";

  try {
    // Step 1: Create the project — JSM uses Mesa de Servicio category, PMO uses PPDC HIBRIDO
    const result = await jiraFetch<{ id: string; key: string; self: string }>("/project", {
      method: "POST",
      body: isJSM
        ? {
            // JSM / Mesa de Servicio configuration
            name: input.spaceName,
            key: input.spaceKey,
            projectTypeKey: JSM_CONFIG.projectTypeKey,
            projectTemplateKey: JSM_CONFIG.projectTemplateKey,
            leadAccountId: input.leadAccountId || JSM_CONFIG.ownerAccountId,
            description: input.description ?? `Mesa de Servicio creada desde PMO Platform Prodigio. Categoría: ${JSM_CONFIG.categoryName}.`,
            assigneeType: "UNASSIGNED",
            categoryId: JSM_CONFIG.categoryId,
          }
        : {
            // Standard PMO / PPDC HIBRIDO configuration
            name: input.spaceName,
            key: input.spaceKey,
            projectTypeKey: "business",
            projectTemplateKey: "com.atlassian.jira-core-project-templates:jira-core-simplified-project-management",
            // Owner: Yanahí Takiana Villegas García (corporate PMO owner)
            leadAccountId: PPDC_CONFIG.ownerAccountId,
            description: input.description ?? `Proyecto creado desde PMO Platform Prodigio. Categoría: ${PPDC_CONFIG.categoryName}.`,
            assigneeType: "UNASSIGNED",
            // Category: PPDC HIBRIDO
            categoryId: PPDC_CONFIG.categoryId,
          },
    });

    // Step 2: Apply corporate schemas to the new project
    const projectId = result.id;
    const applySchemas = async () => {
      const schemaErrors: string[] = [];

      // Apply Issue Type Scheme: PPDC: Project Management Issue Type Scheme
      // Endpoint: PUT /rest/api/3/issuetypescheme/project (without schemeId in URL)
      // Body: { issueTypeSchemeId: "12530", projectId } — confirmed working via testing
      try {
        await jiraFetch(`/issuetypescheme/project`, {
          method: "PUT",
          body: { issueTypeSchemeId: PPDC_CONFIG.issueTypeSchemeId, projectId },
        });
      } catch (e: any) {
        schemaErrors.push(`IssueTypeScheme: ${e.message?.substring(0, 100)}`);
      }

      // Apply Workflow Scheme: PPDC: Project Management Workflow Scheme
      // Endpoint: PUT /rest/api/3/workflowscheme/project (assign scheme to project)
      try {
        await jiraFetch(`/workflowscheme/project`, {
          method: "PUT",
          body: { workflowSchemeId: PPDC_CONFIG.workflowSchemeId, projectId },
        });
      } catch (e: any) {
        schemaErrors.push(`WorkflowScheme: ${e.message?.substring(0, 100)}`);
      }

      // Apply Issue Type Screen Scheme: PPDC: Project Management Issue Type Screen Scheme
      // Endpoint: PUT /rest/api/3/issuetypescreenscheme/project (without schemeId in URL)
      // Body: { issueTypeScreenSchemeId: "11509", projectId } — confirmed working via testing
      try {
        await jiraFetch(`/issuetypescreenscheme/project`, {
          method: "PUT",
          body: {
            issueTypeScreenSchemeId: PPDC_CONFIG.screenSchemeId,
            projectId,
          },
        });
      } catch (e: any) {
        schemaErrors.push(`ScreenScheme: ${e.message?.substring(0, 100)}`);
      }

      // Apply Notification Scheme: Default Notification Scheme
      // Endpoint: PUT /rest/api/3/project/{projectId}/notificationscheme
      try {
        await jiraFetch(`/project/${projectId}/notificationscheme`, {
          method: "PUT",
          body: { notificationSchemeId: PPDC_CONFIG.notificationSchemeId },
        });
      } catch (e: any) {
        // Fallback: try via project update
        try {
          await jiraFetch(`/project/${result.key}`, {
            method: "PUT",
            body: {
              notificationScheme: parseInt(PPDC_CONFIG.notificationSchemeId),
            },
          });
        } catch (e2: any) {
          schemaErrors.push(`NotificationScheme: ${e2.message?.substring(0, 100)}`);
        }
      }

      return schemaErrors;
    };

    // Apply schemas only for PMO (business) projects — JSM projects manage their own schemas
    if (!isJSM) {
      const schemaErrors = await applySchemas();
      if (schemaErrors.length > 0) {
        console.warn(`[JIRA Space] Schema application warnings for ${result.key}:`, schemaErrors);
      }
    }

    // Step 3: Create the 5 PMO boards via JQL filters (PMO only — JSM has its own portal/queues)
    // NOTE: Business projects (JWM) do NOT support location in the agile board API.
    // Boards are created without location; the JQL filter scopes them to the project.
    const createdBoards: Array<{
      name: string;
      type: string;
      boardId?: number;
      filterId?: string;
    }> = [];
    const agileHeaders = {
      Authorization: `Basic ${JIRA_AUTH}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // JSM projects skip PMO board creation — they use JSM queues and portals instead
    const boardsToCreate = isJSM ? [] : PPDC_CONFIG.pmoBoards;
    for (const board of boardsToCreate) {
      try {
        // Build JQL from template (replace {KEY} with actual project key)
        const filterJql = board.jqlTemplate.replace(/\{KEY\}/g, result.key);
        // Use project key prefix to make filter names unique across projects
        const filterName = `[${result.key}] ${board.name}`;
        let filterId: string | undefined;

        // Check if filter already exists (idempotent)
        // NOTE: JIRA filter/search uses partial matching, so we must verify exact name match.
        // We paginate through results to find the exact filter name.
        let exactFilter: any = null;
        let searchStartAt = 0;
        while (!exactFilter) {
          const searchResp = await fetch(`${JIRA_BASE}/rest/api/3/filter/search?filterName=${encodeURIComponent(filterName)}&maxResults=50&startAt=${searchStartAt}`, { headers: agileHeaders });
          const searchResult = (await searchResp.json()) as any;
          exactFilter = searchResult.values?.find((v: any) => v.name === filterName) ?? null;
          if (exactFilter || searchResult.isLast || !searchResult.values?.length) break;
          searchStartAt += 50;
        }
        if (exactFilter) {
          filterId = exactFilter.id;
        } else {
          // Create filter with a unique temp name first, then rename (avoids duplicate name race)
          const tempName = `${filterName} ${Date.now()}`;
          const filterResp = await fetch(`${JIRA_BASE}/rest/api/3/filter`, {
            method: "POST",
            headers: agileHeaders,
            body: JSON.stringify({ name: tempName, jql: filterJql }),
          });
          const filter = (await filterResp.json()) as any;
          if (!filter.id) throw new Error(`Filter creation failed: ${JSON.stringify(filter)}`);
          filterId = filter.id;
          // Rename to canonical name
          await fetch(`${JIRA_BASE}/rest/api/3/filter/${filterId}`, {
            method: "PUT",
            headers: agileHeaders,
            body: JSON.stringify({ name: filterName, jql: filterJql }),
          });
        }

        if (!filterId) throw new Error(`Could not obtain filter ID for ${board.name}`);

        // Create Kanban board WITHOUT location (business projects require this)
        const boardResp = await fetch(`${JIRA_BASE}/rest/agile/1.0/board`, {
          method: "POST",
          headers: agileHeaders,
          body: JSON.stringify({
            name: board.name,
            type: "kanban",
            filterId: parseInt(filterId),
            // No location field - business projects don't support it
          }),
        });
        const boardResult = (await boardResp.json()) as any;
        if (boardResult.id) {
          createdBoards.push({
            name: board.name,
            type: "kanban",
            boardId: boardResult.id,
            filterId,
          });
        } else {
          createdBoards.push({ name: board.name, type: "kanban" });
          console.warn(`[JIRA Space] Board creation warning for ${board.name}:`, boardResult);
        }
      } catch (e: any) {
        createdBoards.push({ name: board.name, type: "kanban" });
        console.warn(`[JIRA Space] Board creation error for ${board.name}:`, e.message?.substring(0, 100));
      }
    }
    const boards = createdBoards;

    // Step 4: Get the actual issue types and statuses for this project
    let actualWorkflows = template.workflows;
    let actualIssueTypes = template.issueTypes;
    try {
      const [proj, statuses] = await Promise.all([getJiraProject(result.key), getProjectStatuses(result.key)]);
      actualIssueTypes = (proj.issueTypes ?? []).map((t: any) => ({
        name: t.name,
        description: t.description ?? "",
        subtask: t.subtask ?? false,
      }));
      actualWorkflows = statuses.map((s: any) => ({
        issueType: s.name,
        statuses: (s.statuses ?? []).map((st: any) => ({
          name: st.name,
          category: st.statusCategory?.name ?? "Unknown",
        })),
      }));
    } catch {
      // Use template structure as fallback
    }

    // JSM projects use a different URL (service desk portal)
    const jiraProjectUrl = isJSM ? `${JIRA_BASE}/jira/servicedesk/projects/${result.key}/boards` : `${JIRA_BASE}/jira/core/projects/${result.key}/board`;

    return {
      success: true,
      created: true,
      jiraProjectId: result.id,
      jiraProjectKey: result.key,
      jiraProjectName: input.spaceName,
      jiraProjectUrl,
      // Corporate configuration applied
      corporateConfig: isJSM
        ? {
            category: JSM_CONFIG.categoryName,
            owner: PPDC_CONFIG.ownerName,
            issueTypeScheme: "JSM Default",
            workflowScheme: "JSM Default",
            screenScheme: "JSM Default",
            notificationScheme: PPDC_CONFIG.notificationSchemeName,
          }
        : {
            category: PPDC_CONFIG.categoryName,
            owner: PPDC_CONFIG.ownerName,
            issueTypeScheme: PPDC_CONFIG.issueTypeSchemeName,
            workflowScheme: PPDC_CONFIG.workflowSchemeName,
            screenScheme: PPDC_CONFIG.screenSchemeName,
            notificationScheme: PPDC_CONFIG.notificationSchemeName,
          },
      template: {
        ...template,
        boards: boards.length > 0 ? boards : PPDC_CONFIG.pmoBoards,
        issueTypes: actualIssueTypes,
        workflows: actualWorkflows,
      },
    };
  } catch (e: any) {
    // If 403 (permissions not granted yet), return pending mode with template structure
    const is403 = e.message?.includes("403") || e.message?.includes("administrator");
    if (is403) {
      return {
        success: true,
        created: false,
        jiraProjectKey: input.spaceKey,
        jiraProjectName: input.spaceName,
        jiraProjectUrl: undefined,
        template,
        error: "Pendiente de permisos de administrador de sitio JIRA. El Space quedará registrado y se creará cuando se habiliten los permisos.",
      };
    }
    throw e;
  }
}

/** Get the current user's accountId in JIRA */
export async function getJiraCurrentUser(): Promise<{
  accountId: string;
  displayName: string;
  emailAddress: string;
}> {
  return jiraFetch("/myself");
}

// ==================== Reporting ====================

export interface JiraProjectReport {
  projectKey: string;
  projectName: string;
  total: number;
  done: number;
  inProgress: number;
  toDo: number;
  percentComplete: number;
  byType: Array<{ name: string; count: number; done: number }>;
  byAssignee: Array<{
    name: string;
    accountId?: string;
    avatar?: string;
    total: number;
    done: number;
    inProgress: number;
  }>;
  recentActivity: Array<{
    key: string;
    summary: string;
    status: string;
    statusCategory: string;
    type: string;
    assignee: string;
    updated: string;
  }>;
  overdueIssues: Array<{
    key: string;
    summary: string;
    type: string;
    assignee: string;
    duedate: string;
    status: string;
  }>;
  lastUpdated: string;
}

/** Fetch all issues for a project (paginates through all pages) */
async function fetchAllIssues(projectKey: string, extraJql = ""): Promise<JiraIssue[]> {
  const all: JiraIssue[] = [];
  let token: string | undefined;
  let done = false;
  const fields = [
    "summary", "status", "issuetype", "assignee", "priority", "duedate", "created", "updated",
    "resolutiondate", "timetracking", "timeoriginalestimate", "timespent",
    "aggregatetimeoriginalestimate", "aggregatetimespent",
    "customfield_11096", // PMO Fase
    "customfield_11023", // Avance PMO (%)
    "customfield_11025", // Estado Ejecutivo
    "customfield_11203", // Estado Financiero
  ];
  while (!done) {
    const jql = `project = ${projectKey}${extraJql ? " AND " + extraJql : ""} ORDER BY updated DESC`;
    const result = await searchJiraIssues(jql, {
      maxResults: 100,
      nextPageToken: token,
      fields,
    });
    all.push(...result.issues);
    if (result.isLast || !result.nextPageToken || result.issues.length === 0) done = true;
    else token = result.nextPageToken;
    if (all.length >= 1000) break; // safety cap
  }
  return all;
}

/** Build a full project report from JIRA issues */
export async function getJiraProjectReport(projectKey: string): Promise<JiraProjectReport> {
  const [project, allIssues] = await Promise.all([
    getJiraProject(projectKey).catch(() => ({
      id: projectKey,
      key: projectKey,
      name: projectKey,
      projectTypeKey: "business",
      style: "classic",
      avatarUrls: {},
      issueTypes: [],
    })),
    fetchAllIssues(projectKey),
  ]);

  const total = allIssues.length;
  let done = 0,
    inProgress = 0,
    toDo = 0;

  const typeMap: Record<string, { count: number; done: number }> = {};
  const assigneeMap: Record<
    string,
    {
      name: string;
      accountId?: string;
      avatar?: string;
      total: number;
      done: number;
      inProgress: number;
    }
  > = {};

  for (const issue of allIssues) {
    const cat = issue.fields.status?.statusCategory?.name ?? "To Do";
    if (cat === "Done") done++;
    else if (cat === "In Progress") inProgress++;
    else toDo++;

    // By type
    const typeName = issue.fields.issuetype?.name ?? "Unknown";
    if (!typeMap[typeName]) typeMap[typeName] = { count: 0, done: 0 };
    typeMap[typeName].count++;
    if (cat === "Done") typeMap[typeName].done++;

    // By assignee
    const assigneeName = issue.fields.assignee?.displayName ?? "Sin asignar";
    const assigneeId = issue.fields.assignee?.accountId ?? "unassigned";
    const assigneeAvatar = issue.fields.assignee?.avatarUrls?.["48x48"];
    if (!assigneeMap[assigneeId])
      assigneeMap[assigneeId] = {
        name: assigneeName,
        accountId: assigneeId,
        avatar: assigneeAvatar,
        total: 0,
        done: 0,
        inProgress: 0,
      };
    assigneeMap[assigneeId].total++;
    if (cat === "Done") assigneeMap[assigneeId].done++;
    else if (cat === "In Progress") assigneeMap[assigneeId].inProgress++;
  }

  // Recent activity: updated in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentActivity = allIssues
    .filter(i => new Date(i.fields.updated) >= sevenDaysAgo)
    .slice(0, 20)
    .map(i => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status?.name ?? "",
      statusCategory: i.fields.status?.statusCategory?.name ?? "",
      type: i.fields.issuetype?.name ?? "",
      assignee: i.fields.assignee?.displayName ?? "Sin asignar",
      updated: i.fields.updated,
    }));

  // Overdue: duedate < now AND not done
  const now = new Date();
  const overdueIssues = allIssues
    .filter(i => {
      const cat = i.fields.status?.statusCategory?.name ?? "";
      return i.fields.duedate && new Date(i.fields.duedate) < now && cat !== "Done";
    })
    .slice(0, 20)
    .map(i => ({
      key: i.key,
      summary: i.fields.summary,
      type: i.fields.issuetype?.name ?? "",
      assignee: i.fields.assignee?.displayName ?? "Sin asignar",
      duedate: i.fields.duedate!,
      status: i.fields.status?.name ?? "",
    }));

  return {
    projectKey,
    projectName: project.name,
    total,
    done,
    inProgress,
    toDo,
    percentComplete: total > 0 ? Math.round((done / total) * 100) : 0,
    byType: Object.entries(typeMap)
      .map(([name, v]) => ({ name, count: v.count, done: v.done }))
      .sort((a, b) => b.count - a.count),
    byAssignee: Object.values(assigneeMap).sort((a, b) => b.total - a.total),
    recentActivity,
    overdueIssues,
    lastUpdated: new Date().toISOString(),
  };
}

/** Get a summary report for all JIRA spaces linked to PMO projects */
export interface JiraConsolidatedReport {
  totalSpaces: number;
  totalIssues: number;
  totalDone: number;
  avgProgress: number;
  spaces: Array<{
    spaceId: number;
    spaceName: string;
    projectKey: string;
    projectName: string;
    projectUrl: string;
    pmoProjectId: number;
    pmoProjectName: string;
    total: number;
    done: number;
    inProgress: number;
    toDo: number;
    percentComplete: number;
  }>;
  lastUpdated: string;
}

// ==================== Advance Report ====================

export interface JiraAdvanceReport {
  projectKey: string;
  projectName: string;
  reportDate: string;
  // Summary KPIs
  totalIssues: number;
  doneCount: number;
  inProgressCount: number;
  toDoCount: number;
  percentComplete: number;
  // Issues by status (for donut chart)
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  // Issues by type (for bar chart)
  byType: Array<{ type: string; count: number }>;
  // Epics map
  epics: Array<{
    key: string;
    summary: string;
    status: string;
    statusCategory: string;
    doneSubtasks: number;
    totalSubtasks: number;
  }>;
  // Milestones (Hito PMO)
  milestones: Array<{
    key: string;
    summary: string;
    status: string;
    statusCategory: string;
    percentage?: string;
    duedate?: string | null;
    resolutiondate?: string | null;
  }>;
  // Risks
  risks: Array<{
    key: string;
    summary: string;
    status: string;
    statusCategory: string;
    priority: string;
  }>;
  // Scope changes (Cambio de Alcance)
  scopeChanges: Array<{
    key: string;
    summary: string;
    status: string;
    statusCategory: string;
    priority: string;
  }>;
  // Team contributions
  team: Array<{
    name: string;
    accountId?: string;
    avatar?: string;
    total: number;
    done: number;
    inProgress: number;
    contribution: string;
    status: string;
  }>;
  // Milestones summary
  milestonesCumplidos: number;
  milestonesPendientes: number;
  milestoneCompletionPct: number;
  primaryProgressPct: number;
  primaryProgressSource: "MILESTONES" | "JIRA_FALLBACK";
  operationalPhase: string | null;
  executiveStatus: string | null;
  financialStatus: string | null;
  advanceReportedPct: number | null;
  projectManagerName: string | null;
  projectManagerAccountId: string | null;
  operationalUpdatedAt: string | null;
  // Time tracking (in seconds from JIRA)
  totalTimeSpentSeconds: number;
  totalOriginalEstimateSeconds: number;
  totalTimeSpentHours: number;
  totalOriginalEstimateHours: number;
  lastUpdated: string;
}

export function calculateExecutiveProgress(milestonesTotal: number, milestonesCumplidos: number, totalIssues: number, doneIssues: number) {
  const milestoneCompletionPct = milestonesTotal > 0 ? Math.round((milestonesCumplidos / milestonesTotal) * 100) : 0;
  const issueCompletionPct = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;
  const primaryProgressSource: "MILESTONES" | "JIRA_FALLBACK" = milestonesTotal > 0 ? "MILESTONES" : "JIRA_FALLBACK";
  return {
    milestoneCompletionPct,
    issueCompletionPct,
    primaryProgressPct: milestonesTotal > 0 ? milestoneCompletionPct : issueCompletionPct,
    primaryProgressSource,
  };
}

/** Build a comprehensive advance report from JIRA issues for the PMO dashboard */
export async function getJiraAdvanceReport(projectKey: string): Promise<JiraAdvanceReport> {
  const [project, allIssues] = await Promise.all([
    getJiraProject(projectKey).catch(() => ({
      id: projectKey,
      key: projectKey,
      name: projectKey,
      projectTypeKey: "business",
      style: "classic",
      avatarUrls: {},
      issueTypes: [],
    })),
    fetchAllIssues(projectKey),
  ]);

  const total = allIssues.length;
  let doneCount = 0,
    inProgressCount = 0,
    toDoCount = 0;
  let totalTimeSpentSeconds = 0,
    totalOriginalEstimateSeconds = 0;

  // Status colors mapping
  const statusColors: Record<string, string> = {
    Finalizada: "#10b981",
    Done: "#10b981",
    Cerrado: "#6b7280",
    Closed: "#6b7280",
    Cumplido: "#06b6d4",
    Pendiente: "#f59e0b",
    Aceptado: "#ef4444",
    Activo: "#3b82f6",
    "In Progress": "#3b82f6",
    "To Do": "#94a3b8",
  };

  const statusMap: Record<string, number> = {};
  const typeMap: Record<string, number> = {};
  const assigneeMap: Record<
    string,
    {
      name: string;
      accountId?: string;
      avatar?: string;
      total: number;
      done: number;
      inProgress: number;
      types: Record<string, number>;
    }
  > = {};
  const epics: JiraAdvanceReport["epics"] = [];
  const milestones: JiraAdvanceReport["milestones"] = [];
  const risks: JiraAdvanceReport["risks"] = [];
  const scopeChanges: JiraAdvanceReport["scopeChanges"] = [];
  const epicChildMap: Record<string, { done: number; total: number }> = {};
  const projectProgressIssue = allIssues.find(issue => {
    const typeName = issue.fields.issuetype?.name?.toLowerCase() ?? "";
    return typeName.includes("proyecto pmo") && typeName.includes("avance");
  }) ?? null;

  const optionValue = (value: unknown): string | null => {
    if (typeof value === "string") return value.trim() || null;
    if (Array.isArray(value)) {
      const values = value.map(optionValue).filter((item): item is string => Boolean(item));
      return values.length ? values.join(", ") : null;
    }
    if (value && typeof value === "object") {
      const candidate = value as { value?: unknown; name?: unknown };
      return optionValue(candidate.value) ?? optionValue(candidate.name);
    }
    return null;
  };

  // Status names that indicate "done" regardless of JIRA statusCategory
  // (some JIRA projects have misconfigured statusCategory mappings)
  const DONE_STATUS_NAMES = new Set(["finalizada", "done", "cerrado", "closed", "cumplido", "cumplido (entregable)", "resuelto", "resolved", "completado", "completed", "terminado"]);
  const IN_PROGRESS_STATUS_NAMES = new Set(["in progress", "en progreso", "actividades en curso", "activo", "en curso", "analizado", "identificado"]);

  // First pass: classify all issues
  for (const issue of allIssues) {
    const cat = issue.fields.status?.statusCategory?.name ?? "To Do";
    const statusName = issue.fields.status?.name ?? "Unknown";
    const statusNameLower = statusName.toLowerCase().trim();
    const typeName = issue.fields.issuetype?.name ?? "Unknown";
    const priority = issue.fields.priority?.name ?? "Medium";

    // Count by status category — use status name as override when statusCategory is wrong
    if (cat === "Done" || DONE_STATUS_NAMES.has(statusNameLower)) doneCount++;
    else if (cat === "In Progress" || IN_PROGRESS_STATUS_NAMES.has(statusNameLower)) inProgressCount++;
    else toDoCount++;

    // Time tracking aggregation (JIRA returns seconds)
    const fields: any = issue.fields;
    totalTimeSpentSeconds += fields.timespent || fields.timeSpent || fields.aggregatetimespent || 0;
    totalOriginalEstimateSeconds += fields.timeoriginalestimate || fields.timeOriginalEstimate || fields.aggregatetimeoriginalestimate || 0;

    // Count by status name
    statusMap[statusName] = (statusMap[statusName] || 0) + 1;

    // Count by type
    typeMap[typeName] = (typeMap[typeName] || 0) + 1;

    // Assignee tracking
    const assigneeName = issue.fields.assignee?.displayName ?? "Sin asignar";
    const assigneeId = issue.fields.assignee?.accountId ?? "unassigned";
    const assigneeAvatar = issue.fields.assignee?.avatarUrls?.["48x48"];
    if (!assigneeMap[assigneeId])
      assigneeMap[assigneeId] = {
        name: assigneeName,
        accountId: assigneeId,
        avatar: assigneeAvatar,
        total: 0,
        done: 0,
        inProgress: 0,
        types: {},
      };
    assigneeMap[assigneeId].total++;
    assigneeMap[assigneeId].types[typeName] = (assigneeMap[assigneeId].types[typeName] || 0) + 1;
    // Use corrected classification for assignee tracking
    const effectiveCat = cat === "Done" || DONE_STATUS_NAMES.has(statusNameLower) ? "Done" : cat === "In Progress" || IN_PROGRESS_STATUS_NAMES.has(statusNameLower) ? "In Progress" : "To Do";
    if (effectiveCat === "Done") assigneeMap[assigneeId].done++;
    else if (effectiveCat === "In Progress") assigneeMap[assigneeId].inProgress++;

    // Classify by issue type using corrected statusCategory
    const typeNorm = typeName.toLowerCase();
    if (typeNorm === "epic" || typeNorm === "épica") {
      epics.push({
        key: issue.key,
        summary: issue.fields.summary,
        status: statusName,
        statusCategory: effectiveCat,
        doneSubtasks: 0,
        totalSubtasks: 0,
      });
    } else if (typeNorm.includes("hito") || typeNorm.includes("milestone")) {
      const pctMatch = issue.fields.summary.match(/(\d+)%/);
      milestones.push({
        key: issue.key,
        summary: issue.fields.summary,
        status: statusName,
        statusCategory: effectiveCat,
        percentage: pctMatch?.[1],
        duedate: (issue.fields as any).duedate ?? null,
        resolutiondate: (issue.fields as any).resolutiondate ?? null,
      });
    } else if (typeNorm.includes("riesgo") || typeNorm.includes("risk")) {
      risks.push({
        key: issue.key,
        summary: issue.fields.summary,
        status: statusName,
        statusCategory: effectiveCat,
        priority,
      });
    } else if (typeNorm.includes("cambio") || typeNorm.includes("change") || typeNorm.includes("avance")) {
      scopeChanges.push({
        key: issue.key,
        summary: issue.fields.summary,
        status: statusName,
        statusCategory: effectiveCat,
        priority,
      });
    }
  }

  // Build byStatus array
  const byStatus = Object.entries(statusMap)
    .map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      color: statusColors[status] || "#94a3b8",
    }))
    .sort((a, b) => b.count - a.count);

  // Build byType array
  const byType = Object.entries(typeMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Build team array with contribution summary
  const team = Object.values(assigneeMap)
    .filter(a => a.accountId !== "unassigned")
    .map(a => {
      const topTypes = Object.entries(a.types)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([t, c]) => t)
        .join(", ");
      const status = a.total === a.done ? "Completado" : a.inProgress > 0 ? "Trabajo activo" : "Pendiente";
      return {
        name: a.name,
        accountId: a.accountId,
        avatar: a.avatar,
        total: a.total,
        done: a.done,
        inProgress: a.inProgress,
        contribution: `${a.total} issues — ${topTypes}`,
        status,
      };
    })
    .sort((a, b) => b.total - a.total);

  const milestonesCumplidos = milestones.filter(m => m.statusCategory === "Done").length;
  const milestonesPendientes = milestones.filter(m => m.statusCategory !== "Done").length;
  const { milestoneCompletionPct, issueCompletionPct, primaryProgressPct, primaryProgressSource } = calculateExecutiveProgress(milestones.length, milestonesCumplidos, total, doneCount);
  // Note: effectiveCat is already used above, so milestones now correctly use the overridden category

  return {
    projectKey,
    projectName: project.name,
    reportDate: new Date().toISOString(),
    totalIssues: total,
    doneCount,
    inProgressCount,
    toDoCount,
    percentComplete: issueCompletionPct,
    byStatus,
    byType,
    epics,
    milestones,
    risks,
    scopeChanges,
    team,
    milestonesCumplidos,
    milestonesPendientes,
    milestoneCompletionPct,
    primaryProgressPct,
    primaryProgressSource,
    operationalPhase: optionValue(projectProgressIssue?.fields.customfield_11096),
    executiveStatus: optionValue(projectProgressIssue?.fields.customfield_11025),
    financialStatus: optionValue(projectProgressIssue?.fields.customfield_11203),
    advanceReportedPct: Number.isFinite(Number(projectProgressIssue?.fields.customfield_11023))
      ? Number(projectProgressIssue?.fields.customfield_11023)
      : null,
    projectManagerName: projectProgressIssue?.fields.assignee?.displayName ?? null,
    projectManagerAccountId: projectProgressIssue?.fields.assignee?.accountId ?? null,
    operationalUpdatedAt: projectProgressIssue?.fields.updated ?? null,
    totalTimeSpentSeconds,
    totalOriginalEstimateSeconds,
    totalTimeSpentHours: Math.round((totalTimeSpentSeconds / 3600) * 10) / 10,
    totalOriginalEstimateHours: Math.round((totalOriginalEstimateSeconds / 3600) * 10) / 10,
    lastUpdated: new Date().toISOString(),
  };
}

// ==================== Health Check ====================

export async function jiraHealthCheck(): Promise<{
  ok: boolean;
  projectCount?: number;
  error?: string;
}> {
  try {
    const projects = await listJiraProjects();
    return { ok: true, projectCount: projects.length };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
