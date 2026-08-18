export function assessMilestoneAcceptanceEligibility(input: {
  milestoneExists: boolean;
  alreadyAccepted: boolean;
  evidenceUrl: string;
  evidenceFileName: string;
}) {
  if (!input.milestoneExists) return { allowed: false, reason: "El hito no pertenece al baseline contractual activo" } as const;
  if (input.alreadyAccepted) return { allowed: false, reason: "El hito ya tiene un acta de aceptación vigente" } as const;
  if (!/^https?:\/\//i.test(input.evidenceUrl) || !input.evidenceFileName.trim()) {
    return { allowed: false, reason: "El acta requiere una URL y un nombre de archivo válidos" } as const;
  }
  return { allowed: true, reason: null } as const;
}
