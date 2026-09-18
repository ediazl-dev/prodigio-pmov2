import { normalizeProjectName } from "@shared/projectIdentity";

export const HOME_PROJECT_TYPES = [
  "apigee",
  "desarrollo",
  "integracion",
  "data",
  "otro",
] as const;
export type HomeProjectType = (typeof HOME_PROJECT_TYPES)[number];

export interface HomeProjectForm {
  projectName: string;
  clientName: string;
  clientEmail: string;
  projectType: HomeProjectType;
  totalAmount: string;
  currency: string;
}

export interface ProjectIdentityRow {
  id: number;
  projectName: string;
}

export function canCreateProjectsFromHome(role: string | null | undefined): boolean {
  return role === "admin" || role === "pmo";
}

export function findDuplicateProject(
  projects: ProjectIdentityRow[],
  projectName: string
): ProjectIdentityRow | null {
  const normalizedName = normalizeProjectName(projectName);
  if (!normalizedName) return null;
  return (
    projects.find(
      project => normalizeProjectName(project.projectName) === normalizedName
    ) ?? null
  );
}

export function buildHomeProjectInput(form: HomeProjectForm) {
  const projectName = normalizeProjectName(form.projectName);
  const clientName = form.clientName.trim();
  if (!projectName || !clientName) return null;

  return {
    projectName,
    clientName,
    clientEmail: form.clientEmail.trim() || undefined,
    projectType: form.projectType,
    totalAmount: form.totalAmount.trim() || undefined,
    currency: form.currency.trim().toUpperCase() || "USD",
  };
}
