import { describe, expect, it } from "vitest";
import { getJiraCurrentUser } from "./jiraClient";

const runLive = process.env.RUN_JIRA_TOKEN_LIVE === "1";

describe.skipIf(!runLive)("token Jira — validación live de sólo lectura", () => {
  it("autentica /myself con JIRA_EMAIL y JIRA_API_TOKEN vigentes", async () => {
    expect(process.env.JIRA_EMAIL).toBeTruthy();
    expect(process.env.JIRA_API_TOKEN).toBeTruthy();

    const user = await getJiraCurrentUser();
    expect(user.accountId).toBeTruthy();
    expect(user.active).not.toBe(false);
    if (user.emailAddress) {
      expect(user.emailAddress.toLowerCase()).toBe(process.env.JIRA_EMAIL?.trim().toLowerCase());
    }
  }, 30_000);
});
