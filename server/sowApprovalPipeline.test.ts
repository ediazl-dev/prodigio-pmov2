import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { deleteProjectAdmin } from "./db";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "sow-approval-test-admin",
      email: "admin@prodigio.tech",
      name: "Administrador de Prueba",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("SoW approval pipeline", () => {
  let createdProjectId: number | null = null;

  afterEach(async () => {
    if (createdProjectId !== null) await deleteProjectAdmin(createdProjectId);
    createdProjectId = null;
  });

  it("mantiene bloqueada la siguiente etapa hasta que el SoW se aprueba y luego solo desbloquea Jira", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const suffix = Date.now();
    const created = await caller.projects.create({
      projectName: `Prueba aprobación SoW ${suffix}`,
      clientName: "Cliente de prueba",
      projectType: "desarrollo",
    });
    createdProjectId = created.id;

    const initialStages = await caller.stages.getAll({ projectId: created.id });
    expect(initialStages).toHaveLength(6);
    expect(initialStages.find(stage => stage.stageId === "sow")?.status).toBe("in_progress");
    expect(initialStages.find(stage => stage.stageId === "jira")?.status).toBe("locked");
    expect(initialStages.filter(stage => stage.stageId !== "sow").every(stage => stage.status === "locked")).toBe(true);

    const result = await caller.sow.approve({
      projectId: created.id,
      finalDocUrl: "https://files.prodigio.test/sow-aprobado.pdf",
    });
    expect(result).toEqual({ success: true });

    const afterApproval = await caller.stages.getAll({ projectId: created.id });
    expect(afterApproval.find(stage => stage.stageId === "sow")?.status).toBe("completed");
    expect(afterApproval.find(stage => stage.stageId === "jira")?.status).toBe("in_progress");
    expect(afterApproval.filter(stage => !["sow", "jira"].includes(stage.stageId)).every(stage => stage.status === "locked")).toBe(true);
  });
});
