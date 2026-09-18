export const PROJECT_NAME_UNIQUE_INDEX = "projects_project_name_unique";

export function normalizeProjectName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function formatPmoProjectId(projectId: number | string): string {
  return `PMO-${projectId}`;
}

export type ProjectIdentityConflict = {
  id: number;
  projectName: string;
  clientName: string;
  currentStage: string;
  status: string;
  origin: string;
  jiraProjectKey?: string | null;
};

export class DuplicateProjectNameError extends Error {
  readonly existingProject: ProjectIdentityConflict | null;

  constructor(
    projectName: string,
    existingProject: ProjectIdentityConflict | null = null
  ) {
    const suffix = existingProject
      ? ` Ya existe ${formatPmoProjectId(existingProject.id)} para ${existingProject.clientName}, en etapa ${existingProject.currentStage}.`
      : " Ya existe otro proyecto con ese nombre.";
    super(
      `No se puede usar el nombre \"${normalizeProjectName(projectName)}\".${suffix}`
    );
    this.name = "DuplicateProjectNameError";
    this.existingProject = existingProject;
  }
}

export function isProjectNameUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    errno?: unknown;
    message?: unknown;
  };
  const message = String(candidate.message ?? "");
  return (
    candidate.code === "ER_DUP_ENTRY" ||
    candidate.errno === 1062 ||
    message.includes(PROJECT_NAME_UNIQUE_INDEX)
  );
}
