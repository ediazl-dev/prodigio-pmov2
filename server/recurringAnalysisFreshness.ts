export function isRecurringAnalysisOlderThanConfiguration(input: {
  configuredAt?: string | Date | null;
  analysisCreatedAt?: string | Date | null;
}): boolean {
  if (!input.configuredAt) return false;
  const configured = new Date(input.configuredAt).getTime();
  if (!Number.isFinite(configured)) return false;
  if (!input.analysisCreatedAt) return true;
  const analyzed = new Date(input.analysisCreatedAt).getTime();
  return !Number.isFinite(analyzed) || analyzed < configured;
}
