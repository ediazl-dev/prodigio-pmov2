import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getJiraRuntimeCredentials } from "./jiraClient";

const clientSource = readFileSync(new URL("./jiraClient.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("credenciales Jira en tiempo de ejecución", () => {
  it("construye la autorización desde el token vigente y normaliza espacios", () => {
    const first = getJiraRuntimeCredentials({
      JIRA_BASE_URL: "https://example.atlassian.net/",
      JIRA_EMAIL: "user@example.com",
      JIRA_API_TOKEN: " token-anterior ",
    });
    const second = getJiraRuntimeCredentials({
      JIRA_BASE_URL: "https://example.atlassian.net/",
      JIRA_EMAIL: "user@example.com",
      JIRA_API_TOKEN: " token-nuevo ",
    });

    expect(first.baseUrl).toBe("https://example.atlassian.net");
    expect(first.apiToken).toBe("token-anterior");
    expect(second.apiToken).toBe("token-nuevo");
    expect(second.authorization).not.toBe(first.authorization);
    expect(Buffer.from(second.authorization.replace("Basic ", ""), "base64").toString("utf8"))
      .toBe("user@example.com:token-nuevo");
  });

  it("no conserva una cabecera Basic calculada al importar el módulo", () => {
    expect(clientSource).not.toContain("const JIRA_AUTH =");
    expect(clientSource).toContain("const credentials = getJiraRuntimeCredentials()");
  });

  it("activa el token validado y no presenta un 401 como expiración confirmada", () => {
    expect(routerSource).toContain("process.env.JIRA_API_TOKEN = credentials.apiToken");
    expect(routerSource).toContain("Atlassian rechazó la combinación JIRA_EMAIL + token (HTTP 401)");
    expect(routerSource).not.toContain("Token expirado o inválido. Genera un nuevo API Token");
  });
});
