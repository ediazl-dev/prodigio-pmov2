import { describe, expect, it, vi } from "vitest";
import { buildRecurringJsmSnapshot, collectRecurringJsmSnapshot } from "./recurringServicesJsmSnapshot";
import type { JiraIssue, JsmSlaInformation } from "./jiraClient";

function issue(input: { key: string; priority: string; statusKey: string; created: string; dueDate?: string; issueType?: string }): JiraIssue {
  return {
    id: input.key,
    key: input.key,
    self: `https://jira.test/${input.key}`,
    fields: {
      summary: input.key,
      status: { name: input.statusKey, statusCategory: { name: input.statusKey, key: input.statusKey } },
      issuetype: { name: input.issueType ?? "Incident", subtask: false },
      assignee: null,
      priority: { name: input.priority, iconUrl: "" },
      created: input.created,
      updated: input.created,
      duedate: input.dueDate,
    },
  };
}

describe("recurring services JSM snapshots", () => {
  it("calcula incidentes, antigüedad, vencimiento y SLA desde ciclos reales", () => {
    const issues = [
      issue({ key: "OPS-1", priority: "Highest", statusKey: "indeterminate", created: "2026-07-01T00:00:00.000Z", dueDate: "2026-09-10" }),
      issue({ key: "OPS-2", priority: "Medium", statusKey: "done", created: "2026-09-10T00:00:00.000Z" }),
    ];
    const slas = new Map<string, JsmSlaInformation[]>([
      ["OPS-1", [
        { name: "Time to first response", completedCycles: [{ breached: false }] },
        { name: "Time to resolution", ongoingCycle: { breached: true } },
      ]],
      ["OPS-2", [
        { name: "Tiempo de primera respuesta", completedCycles: [{ breached: true }] },
        { name: "Tiempo de resolución", completedCycles: [{ breached: false }] },
      ]],
    ]);

    const result = buildRecurringJsmSnapshot({
      service: { id: 7, jsmProjectKey: "OPS", jsmServiceDeskId: "42" },
      issues,
      slaRecordsByIssue: slas,
      slaFailureCount: 0,
      capturedAt: new Date("2026-09-16T12:00:00.000Z"),
      source: "manual",
    });

    expect(result).toMatchObject({
      status: "success",
      incidentCount: 2,
      openIncidentCount: 1,
      criticalOpenCount: 1,
      overdueIncidentCount: 1,
      unresolvedOver30DaysCount: 1,
      firstResponseMeasuredCount: 2,
      firstResponseMetCount: 1,
      firstResponseCompliancePct: "50.00",
      resolutionMeasuredCount: 2,
      resolutionMetCount: 1,
      resolutionCompliancePct: "50.00",
    });
  });

  it("devuelve N/D cuando el servicio no tiene identidad JSM confirmada", async () => {
    const result = await collectRecurringJsmSnapshot({ service: { id: 8 }, source: "manual" });
    expect(result.status).toBe("not_configured");
    expect(result.incidentCount).toBeNull();
    expect(result.firstResponseCompliancePct).toBeNull();
  });

  it("pagina issues y SLA y degrada a parcial si una solicitud falla", async () => {
    const first = issue({ key: "OPS-1", priority: "High", statusKey: "indeterminate", created: "2026-09-01T00:00:00.000Z" });
    const second = issue({ key: "OPS-2", priority: "Low", statusKey: "new", created: "2026-09-02T00:00:00.000Z" });
    const searchIssues = vi
      .fn()
      .mockResolvedValueOnce({ issues: [first], isLast: false, nextPageToken: "next" })
      .mockResolvedValueOnce({ issues: [second], isLast: true });
    const getRequestSlas = vi.fn().mockResolvedValueOnce({ values: [], isLastPage: true, limit: 50 }).mockRejectedValueOnce(new Error("forbidden"));

    const result = await collectRecurringJsmSnapshot({
      service: { id: 9, jsmProjectKey: "OPS", jsmServiceDeskId: "42" },
      source: "scheduled",
      capturedAt: new Date("2026-09-16T12:00:00.000Z"),
      adapter: { searchIssues: searchIssues as any, getRequestSlas: getRequestSlas as any },
    });

    expect(searchIssues).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("partial");
    expect(result.errorCode).toBe("JSM_SLA_PARTIAL");
    expect(result.incidentCount).toBe(2);
  });
});
