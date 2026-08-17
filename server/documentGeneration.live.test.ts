import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const runDocumentTests = process.env.RUN_DOCUMENT_TESTS === "true";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "document-generation-live-admin",
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

describe.runIf(runDocumentTests)("generación documental de Prodigio", () => {
  it("genera y almacena un SoW DOCX con versión serializada", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const suffix = Date.now();
    const project = await caller.projects.create({
      projectName: `Prueba documental ${suffix}`,
      clientName: "Cliente de prueba",
      projectType: "desarrollo",
    });

    await caller.sow.save({
      projectId: project.id,
      data: {
        generalObjective: "Validar la generación de un documento SoW.",
        specificObjectives: ["Generar un DOCX", "Conservar una versión"],
        activitiesIncluded: ["Preparación", "Ejecución"],
        deliverables: [{ name: "SoW", description: "Documento generado" }],
        totalAmount: "1000",
        currency: "USD",
        billingMilestones: [{ description: "Entrega documental", percentage: "100", amount: "1000" }],
      },
    });

    const generated = await caller.sow.downloadDocx({ projectId: project.id, version: "1.0" });
    expect(generated.url).toMatch(/^https?:\/\//);
    expect(generated.fileName).toMatch(/\.docx$/);
    expect(generated.version).toBe("1.0");
  }, 120_000);
});
