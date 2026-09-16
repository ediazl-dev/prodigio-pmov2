import { describe, expect, it } from "vitest";
import { getJiraProject, getJiraProjectIssueTypes, getJiraProjectPermissions, getJsmServiceDesk, listJsmServiceDesks } from "./jiraClient";

const runLive = process.env.RUN_JSM_READONLY_LIVE === "1";

describe.skipIf(!runLive)("J2 JSM readers — live read-only", () => {
  it("lista Service Desks y valida la identidad del primer resultado usando solo lectores GET", async () => {
    const serviceDesks = await listJsmServiceDesks({ pageSize: 25, maxItems: 100 });
    expect(Array.isArray(serviceDesks)).toBe(true);

    if (serviceDesks.length === 0) return;

    const candidate = serviceDesks[0];
    const [serviceDesk, project, permissions, issueTypes] = await Promise.all([
      getJsmServiceDesk(candidate.id),
      getJiraProject(candidate.projectId),
      getJiraProjectPermissions(candidate.projectKey),
      getJiraProjectIssueTypes(candidate.projectId),
    ]);

    expect(String(serviceDesk.id)).toBe(String(candidate.id));
    expect(String(serviceDesk.projectId)).toBe(String(candidate.projectId));
    expect(project.projectTypeKey).toBe("service_desk");
    expect(permissions).toHaveProperty("BROWSE_PROJECTS");
    expect(permissions).toHaveProperty("CREATE_ISSUES");
    expect(Array.isArray(issueTypes)).toBe(true);
  }, 30_000);
});
