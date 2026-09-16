import type { JsmExistingSpacePreflight, JsmExistingSpaceSnapshot } from "../shared/jsmExistingSpace";
import {
  buildJsmProjectUrls,
  getJiraProject,
  getJiraProjectIssueTypes,
  getJiraProjectPermissions,
  getJsmServiceDesk,
  type JiraProject,
  type JiraProjectIssueType,
  type JiraProjectPermission,
  type JsmServiceDesk,
} from "./jiraClient";

export interface InspectJsmExistingSpaceInput {
  serviceDeskId: string;
  serviceId: number;
  linkedServiceId?: number | null;
  expectedProjectId?: string | null;
  mappedIssueTypeIds?: string[];
}

export interface InspectJsmExistingSpaceDependencies {
  getServiceDesk: (serviceDeskId: string) => Promise<JsmServiceDesk>;
  getProject: (projectId: string) => Promise<JiraProject & { issueTypes: any[] }>;
  getPermissions: (projectKey: string) => Promise<Record<string, JiraProjectPermission>>;
  getIssueTypes: (projectId: string) => Promise<JiraProjectIssueType[]>;
  buildUrls: (projectKey: string, serviceDeskId: string) => { agentUrl: string; portalUrl: string };
  now: () => Date;
}

const defaultDependencies: InspectJsmExistingSpaceDependencies = {
  getServiceDesk: getJsmServiceDesk,
  getProject: getJiraProject,
  getPermissions: getJiraProjectPermissions,
  getIssueTypes: getJiraProjectIssueTypes,
  buildUrls: buildJsmProjectUrls,
  now: () => new Date(),
};

export async function inspectJsmExistingSpace(
  input: InspectJsmExistingSpaceInput,
  dependencies: InspectJsmExistingSpaceDependencies = defaultDependencies,
): Promise<JsmExistingSpacePreflight> {
  const serviceDesk = await dependencies.getServiceDesk(input.serviceDeskId);
  const [project, permissions, issueTypes] = await Promise.all([
    dependencies.getProject(serviceDesk.projectId),
    dependencies.getPermissions(serviceDesk.projectKey),
    dependencies.getIssueTypes(serviceDesk.projectId),
  ]);

  const urls = dependencies.buildUrls(serviceDesk.projectKey, serviceDesk.id);
  const snapshot: JsmExistingSpaceSnapshot = {
    serviceDeskId: String(serviceDesk.id),
    projectId: String(serviceDesk.projectId),
    projectKey: serviceDesk.projectKey,
    projectName: serviceDesk.projectName,
    projectTypeKey: project.projectTypeKey,
    archived: project.archived === true,
    canBrowseProject: permissions.BROWSE_PROJECTS?.havePermission === true,
    canCreateIssues: permissions.CREATE_ISSUES?.havePermission === true,
    issueTypes: issueTypes.map(issueType => ({
      id: String(issueType.id),
      name: issueType.name,
      description: issueType.description,
      subtask: issueType.subtask === true,
    })),
    agentUrl: urls.agentUrl,
    portalUrl: urls.portalUrl,
    inspectedAt: dependencies.now().toISOString(),
  };

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (project.projectTypeKey !== "service_desk") {
    blockers.push("El proyecto Jira asociado no es un Space de Jira Service Management.");
    return { status: "not_service_desk", canLink: false, blockers, warnings, snapshot };
  }

  if (project.archived === true) {
    blockers.push("El Space JSM se encuentra archivado o inactivo.");
    return { status: "archived_or_inactive", canLink: false, blockers, warnings, snapshot };
  }

  if (input.expectedProjectId && String(input.expectedProjectId) !== String(serviceDesk.projectId)) {
    blockers.push("La identidad del proyecto cambió desde el diagnóstico anterior.");
    return { status: "identity_changed", canLink: false, blockers, warnings, snapshot };
  }

  if (!snapshot.canBrowseProject) {
    blockers.push("La cuenta técnica no tiene permiso para consultar el proyecto Jira asociado.");
    return { status: "service_desk_not_accessible", canLink: false, blockers, warnings, snapshot };
  }

  if (input.linkedServiceId && input.linkedServiceId !== input.serviceId) {
    blockers.push(`El Space JSM ya está vinculado al servicio recurrente ${input.linkedServiceId}.`);
    return { status: "linked_to_other_service", canLink: false, blockers, warnings, snapshot };
  }

  if (!snapshot.canCreateIssues) {
    blockers.push("La cuenta técnica no tiene permiso para crear issues en el Space JSM.");
    return { status: "missing_create_issue_permission", canLink: false, blockers, warnings, snapshot };
  }

  if (input.linkedServiceId === input.serviceId) {
    return { status: "already_linked_same_service", canLink: true, blockers, warnings, snapshot };
  }

  const mappedIds = new Set(input.mappedIssueTypeIds ?? []);
  if (mappedIds.size > 0 && !snapshot.issueTypes.some(issueType => mappedIds.has(issueType.id))) {
    blockers.push("Los tipos de issue configurados ya no están disponibles en el Space JSM.");
    return { status: "missing_issue_type_mapping", canLink: false, blockers, warnings, snapshot };
  }

  if (mappedIds.size === 0) {
    warnings.push("Los tipos de issue para plan de trabajo y facturación deben configurarse antes de sincronizar.");
  }

  return { status: "ready", canLink: true, blockers, warnings, snapshot };
}
