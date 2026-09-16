import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectJsmExistingSpace, type InspectJsmExistingSpaceDependencies } from "./jsmExistingSpaceService";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("J2 JSM read-only readers", () => {
  it("recorre todas las páginas de Service Desks usando únicamente GET", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      expect(init?.method).toBe("GET");
      expect(url).toContain("/rest/servicedeskapi/servicedesk");

      if (url.includes("start=0")) {
        return new Response(JSON.stringify({
          size: 2,
          start: 0,
          limit: 2,
          isLastPage: false,
          values: [
            { id: "10", projectId: "10010", projectName: "Mesa Uno", projectKey: "MESA1" },
            { id: "11", projectId: "10011", projectName: "Mesa Dos", projectKey: "MESA2" },
          ],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }

      return new Response(JSON.stringify({
        size: 1,
        start: 2,
        limit: 2,
        isLastPage: true,
        values: [{ id: "12", projectId: "10012", projectName: "Mesa Tres", projectKey: "MESA3" }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { listJsmServiceDesks } = await import("./jiraClient");
    const desks = await listJsmServiceDesks({ pageSize: 2 });

    expect(desks.map(desk => desk.id)).toEqual(["10", "11", "12"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method === "GET")).toBe(true);
  });
});

describe("J2 JSM preflight evaluator", () => {
  const makeDependencies = (overrides: Partial<InspectJsmExistingSpaceDependencies> = {}): InspectJsmExistingSpaceDependencies => ({
    getServiceDesk: vi.fn(async () => ({ id: "25", projectId: "10250", projectName: "Mesa Cliente", projectKey: "MSC" })),
    getProject: vi.fn(async () => ({
      id: "10250",
      key: "MSC",
      name: "Mesa Cliente",
      projectTypeKey: "service_desk",
      style: "next-gen",
      avatarUrls: {},
      issueTypes: [],
    })),
    getPermissions: vi.fn(async () => ({
      BROWSE_PROJECTS: { key: "BROWSE_PROJECTS", havePermission: true },
      CREATE_ISSUES: { key: "CREATE_ISSUES", havePermission: true },
    })),
    getIssueTypes: vi.fn(async () => [
      { id: "10001", name: "Solicitud", subtask: false },
      { id: "10002", name: "Incidente", subtask: false },
    ]),
    buildUrls: vi.fn(() => ({ agentUrl: "https://example.atlassian.net/jira/servicedesk/projects/MSC/boards", portalUrl: "https://example.atlassian.net/servicedesk/customer/portal/25" })),
    now: () => new Date("2026-09-16T12:00:00.000Z"),
    ...overrides,
  });

  it("declara listo un Space JSM accesible y libre sin ejecutar escrituras", async () => {
    const dependencies = makeDependencies();
    const result = await inspectJsmExistingSpace({ serviceDeskId: "25", serviceId: 2040001 }, dependencies);

    expect(result.status).toBe("ready");
    expect(result.canLink).toBe(true);
    expect(result.snapshot.serviceDeskId).toBe("25");
    expect(result.snapshot.issueTypes).toHaveLength(2);
    expect(result.warnings).toContain("Los tipos de issue para plan de trabajo y facturación deben configurarse antes de sincronizar.");
  });

  it("bloquea proyectos Jira que no sean service_desk", async () => {
    const dependencies = makeDependencies({
      getProject: vi.fn(async () => ({
        id: "10250",
        key: "MSC",
        name: "Proyecto empresarial",
        projectTypeKey: "business",
        style: "classic",
        avatarUrls: {},
        issueTypes: [],
      })),
    });

    const result = await inspectJsmExistingSpace({ serviceDeskId: "25", serviceId: 2040001 }, dependencies);
    expect(result.status).toBe("not_service_desk");
    expect(result.canLink).toBe(false);
  });

  it("bloquea un Space JSM ya vinculado a otro servicio", async () => {
    const result = await inspectJsmExistingSpace(
      { serviceDeskId: "25", serviceId: 2040001, linkedServiceId: 2040099 },
      makeDependencies(),
    );
    expect(result.status).toBe("linked_to_other_service");
    expect(result.canLink).toBe(false);
  });

  it("marca como idempotente el Space ya vinculado al mismo servicio", async () => {
    const result = await inspectJsmExistingSpace(
      { serviceDeskId: "25", serviceId: 2040001, linkedServiceId: 2040001 },
      makeDependencies(),
    );
    expect(result.status).toBe("already_linked_same_service");
    expect(result.canLink).toBe(true);
  });

  it("bloquea cuando falta permiso para crear issues", async () => {
    const dependencies = makeDependencies({
      getPermissions: vi.fn(async () => ({
        BROWSE_PROJECTS: { key: "BROWSE_PROJECTS", havePermission: true },
        CREATE_ISSUES: { key: "CREATE_ISSUES", havePermission: false },
      })),
    });
    const result = await inspectJsmExistingSpace({ serviceDeskId: "25", serviceId: 2040001 }, dependencies);
    expect(result.status).toBe("missing_create_issue_permission");
    expect(result.canLink).toBe(false);
  });
});
