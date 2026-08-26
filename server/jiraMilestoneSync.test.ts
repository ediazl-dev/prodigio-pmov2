import { describe, expect, it } from "vitest";
import { deriveJiraMilestoneObservation } from "./jiraMilestoneSync";

describe("deriveJiraMilestoneObservation", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");

  it("marca como fulfilled cualquier estado de categoría Done y conserva la fecha real", () => {
    expect(
      deriveJiraMilestoneObservation(
        {
          key: "TAN-1",
          fields: {
            status: { name: "Cerrado", statusCategory: { key: "done" } },
            duedate: "2026-08-20",
            resolutiondate: "2026-08-25T18:30:00.000+0000",
          },
        },
        now,
      ),
    ).toEqual({
      jiraStatusName: "Cerrado",
      jiraDueDate: "2026-08-20",
      jiraClosedDate: "2026-08-25",
      semanticStatus: "fulfilled",
    });
  });

  it("marca como delayed un hito abierto cuya fecha planificada está vencida", () => {
    expect(
      deriveJiraMilestoneObservation(
        {
          key: "TAN-2",
          fields: {
            status: { name: "En curso", statusCategory: { key: "indeterminate" } },
            duedate: "2026-08-20",
            resolutiondate: null,
          },
        },
        now,
      ).semanticStatus,
    ).toBe("delayed");
  });

  it("elimina la fecha de cierre cuando Jira ya no considera el issue terminado", () => {
    expect(
      deriveJiraMilestoneObservation(
        {
          key: "TAN-3",
          fields: {
            status: { name: "Reabierto", statusCategory: { key: "indeterminate" } },
            duedate: "2026-09-10",
            resolutiondate: "2026-08-10T10:00:00.000+0000",
          },
        },
        now,
      ),
    ).toEqual({
      jiraStatusName: "Reabierto",
      jiraDueDate: "2026-09-10",
      jiraClosedDate: null,
      semanticStatus: "pending",
    });
  });
});
