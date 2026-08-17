import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const runLiveLlmTests = process.env.RUN_LIVE_LLM_TESTS === "true";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "sow-agentic-live-admin",
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

describe.runIf(runLiveLlmTests)("SoW agéntico con PDF y LLM", () => {
  it("extrae un SoW estructurado desde PDF, lo persiste como borrador y permite aprobarlo", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const suffix = Date.now();
    const projectName = `Prueba SoW agéntico ${suffix}`;
    const clientName = "Cliente de prueba";
    const project = await caller.projects.create({
      projectName,
      clientName,
      projectType: "desarrollo",
    });

    const extraction = await caller.sow.extractFromPdf({
      projectId: project.id,
      projectName,
      clientName,
      pdfUrls: [{
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        fileName: "propuesta-prueba.pdf",
      }],
    });

    expect(extraction.success).toBe(true);
    expect(extraction.data).toMatchObject({
      projectName: expect.any(String),
      clientName: expect.any(String),
      executiveSummary: expect.any(String),
      deliverables: expect.any(Array),
      milestones: expect.any(Array),
      currency: expect.any(String),
    });

    const saved = await caller.sow.get({ projectId: project.id });
    expect(saved).toMatchObject({
      aiExtracted: true,
      status: "draft",
      sourcePdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    });

    await caller.sow.approve({ projectId: project.id });
    const stages = await caller.stages.getAll({ projectId: project.id });
    expect(stages.find(stage => stage.stageId === "sow")?.status).toBe("completed");
    expect(stages.find(stage => stage.stageId === "jira")?.status).toBe("in_progress");
  }, 120_000);
});
