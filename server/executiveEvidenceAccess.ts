export type ExecutiveEvidenceAccessInput = {
  projectExists: boolean;
  approvedSourceExists: boolean;
};

export type ExecutiveEvidenceAccessResult =
  | { allowed: true }
  | { allowed: false; code: "PROJECT_NOT_FOUND" | "APPROVED_BASELINE_REQUIRED"; reason: string };

/**
 * La elegibilidad documental depende de la existencia del proyecto y de un
 * baseline ejecutivo aprobado. Los permisos de rol se aplican en la capa tRPC.
 */
export function assessExecutiveEvidenceAccess(input: ExecutiveEvidenceAccessInput): ExecutiveEvidenceAccessResult {
  if (!input.projectExists) {
    return { allowed: false, code: "PROJECT_NOT_FOUND", reason: "Proyecto no encontrado" };
  }
  if (!input.approvedSourceExists) {
    return {
      allowed: false,
      code: "APPROVED_BASELINE_REQUIRED",
      reason: "El proyecto no tiene un baseline ejecutivo aprobado",
    };
  }
  return { allowed: true };
}
