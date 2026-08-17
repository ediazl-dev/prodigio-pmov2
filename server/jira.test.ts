import { describe, it, expect } from "vitest";

const JIRA_BASE = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_TOKEN = process.env.JIRA_API_TOKEN;
const AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64");
const HEADERS = { Authorization: `Basic ${AUTH}`, Accept: "application/json" };

describe("JIRA Integration - Credentials", () => {
  it("should have JIRA environment variables configured", () => {
    expect(JIRA_BASE).toBeTruthy();
    expect(JIRA_EMAIL).toBeTruthy();
    expect(JIRA_TOKEN).toBeTruthy();
    expect(JIRA_BASE).toContain("atlassian.net");
  });
});

describe("JIRA Integration - Projects", () => {
  it("should connect to JIRA and list projects", async () => {
    const resp = await fetch(`${JIRA_BASE}/rest/api/3/project`, { headers: HEADERS });
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("key");
    expect(data[0]).toHaveProperty("name");
    expect(data[0]).toHaveProperty("id");
  }, 15_000);

  it("should get project details with issue types", async () => {
    const projResp = await fetch(`${JIRA_BASE}/rest/api/3/project`, { headers: HEADERS });
    const projects = await projResp.json();
    const key = projects[0]?.key;
    expect(key).toBeTruthy();

    const resp = await fetch(`${JIRA_BASE}/rest/api/3/project/${key}`, { headers: HEADERS });
    expect(resp.ok).toBe(true);
    const detail = await resp.json();
    expect(detail).toHaveProperty("key", key);
    expect(detail).toHaveProperty("issueTypes");
    expect(Array.isArray(detail.issueTypes)).toBe(true);
    expect(detail.issueTypes.length).toBeGreaterThan(0);
    expect(detail.issueTypes[0]).toHaveProperty("name");
  }, 15_000);
});

describe("JIRA Integration - Issues Search", () => {
  it("should search issues with bounded JQL", async () => {
    const projResp = await fetch(`${JIRA_BASE}/rest/api/3/project`, { headers: HEADERS });
    const projects = await projResp.json();
    const key = projects[0]?.key;

    const resp = await fetch(`${JIRA_BASE}/rest/api/3/search/jql`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        jql: `project=${key} ORDER BY created DESC`,
        maxResults: 5,
        fields: ["summary", "status", "issuetype", "assignee", "priority"],
      }),
    });
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data).toHaveProperty("issues");
    expect(Array.isArray(data.issues)).toBe(true);
  }, 15_000);

  it("should filter issues by status category", async () => {
    const projResp = await fetch(`${JIRA_BASE}/rest/api/3/project`, { headers: HEADERS });
    const projects = await projResp.json();
    const key = projects[0]?.key;

    const resp = await fetch(`${JIRA_BASE}/rest/api/3/search/jql`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        jql: `project=${key} AND statusCategory="Done" ORDER BY created DESC`,
        maxResults: 1,
        fields: ["summary", "status"],
      }),
    });
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data).toHaveProperty("issues");
  }, 15_000);
});

describe("JIRA Integration - Users", () => {
  it("should fetch assignable users for a project", async () => {
    const projResp = await fetch(`${JIRA_BASE}/rest/api/3/project`, { headers: HEADERS });
    const projects = await projResp.json();
    const key = projects[0]?.key;

    const resp = await fetch(`${JIRA_BASE}/rest/api/3/user/assignable/search?project=${key}&maxResults=5`, {
      headers: HEADERS,
    });
    expect(resp.ok).toBe(true);
    const users = await resp.json();
    expect(Array.isArray(users)).toBe(true);
    if (users.length > 0) {
      expect(users[0]).toHaveProperty("accountId");
      expect(users[0]).toHaveProperty("displayName");
    }
  }, 15_000);
});

describe("JIRA Integration - jiraClient module", () => {
  it("should import and use jiraHealthCheck", async () => {
    const { jiraHealthCheck } = await import("./jiraClient");
    const result = await jiraHealthCheck();
    expect(result.ok).toBe(true);
    expect(result.projectCount).toBeGreaterThan(0);
  }, 15_000);

  it("should import and use listJiraProjects", async () => {
    const { listJiraProjects } = await import("./jiraClient");
    const projects = await listJiraProjects();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0]).toHaveProperty("key");
  }, 15_000);

  it("should import and use getProjectIssues", async () => {
    const { listJiraProjects, getProjectIssues } = await import("./jiraClient");
    const projects = await listJiraProjects();
    const key = projects[0].key;
    const result = await getProjectIssues(key, { maxResults: 3 });
    expect(result).toHaveProperty("issues");
    expect(Array.isArray(result.issues)).toBe(true);
  }, 15_000);

  it("should import and use getAssignableUsers", async () => {
    const { listJiraProjects, getAssignableUsers } = await import("./jiraClient");
    const projects = await listJiraProjects();
    const key = projects[0].key;
    const users = await getAssignableUsers(key);
    expect(Array.isArray(users)).toBe(true);
  }, 15_000);
});
