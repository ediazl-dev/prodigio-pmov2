import { describe, expect, it } from "vitest";
import { getJsmSyncConfiguration } from "./jsmRecurringSyncRunner";

const serviceId = Number(process.env.JSM_SYNC_SERVICE_ID || 0);
const shouldRunLive =
  process.env.RUN_JSM_SYNC_READONLY_LIVE === "true" &&
  Number.isInteger(serviceId) &&
  serviceId > 0;

describe.runIf(shouldRunLive)("J4 contexto JSM real de solo lectura", () => {
  it("lee proyecto, permisos, tipos de issue, mappings y readiness sin ejecutar sincronización", async () => {
    const configuration = await getJsmSyncConfiguration(serviceId, 5);
    expect(configuration.project.id).toBeTruthy();
    expect(configuration.project.key).toBeTruthy();
    expect(Array.isArray(configuration.issueTypes)).toBe(true);
    expect(Array.isArray(configuration.mappings)).toBe(true);
    expect(Array.isArray(configuration.runs)).toBe(true);
    expect(Array.isArray(configuration.readiness.blockers)).toBe(true);
  }, 60_000);
});
