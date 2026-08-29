export type JiraWizardStep = "search" | "preflight" | "identity" | "mapping" | "ready";

export function resolveJiraWizardStep(readyForMapping: boolean, onboardingStatus: string): JiraWizardStep {
  if (!readyForMapping) return "preflight";
  if (onboardingStatus === "mapping") return "mapping";
  if (onboardingStatus === "reconciliation" || onboardingStatus === "ready") return "ready";
  return "preflight";
}

export function buildJiraMappingSubmission(
  candidates: Array<{ sourceKey: string; proposedTargetEntityType: string }>,
  decisions: Record<string, string>,
  persistedMappings: Array<{ sourceKey: string; targetEntityType: string }> = [],
) {
  return candidates.map(candidate => {
    const targetEntityType = decisions[candidate.sourceKey]
      ?? persistedMappings.find(mapping => mapping.sourceKey === candidate.sourceKey)?.targetEntityType
      ?? candidate.proposedTargetEntityType;
    return {
      sourceKey: candidate.sourceKey,
      targetEntityType,
      syncDirection: targetEntityType === "ignored" ? "none" : "jira_to_pmo",
    };
  });
}
