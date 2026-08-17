import { describe, expect, it } from "vitest";
import { listJiraProjects } from "./jiraClient";
import { pipedriveHealthCheck } from "./pipedriveClient";

describe("external credentials", () => {
  it("authenticates Pipedrive through a lightweight health check", async () => {
    expect(await pipedriveHealthCheck()).toBe(true);
  }, 15_000);

  it("authenticates Jira by listing the accessible projects", async () => {
    const projects = await listJiraProjects();
    expect(Array.isArray(projects)).toBe(true);
  }, 15_000);
});
