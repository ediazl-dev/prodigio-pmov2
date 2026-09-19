import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { deleteProjectAdmin } from "./db";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "closure-compliance-admin",
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

describe("cierre, cumplimiento y auditoría", () => {
  let createdProjectId: number | null = null;

  afterEach(async () => {
    if (createdProjectId !== null) await deleteProjectAdmin(createdProjectId);
    createdProjectId = null;
  });

  it("persiste lecciones aprendidas, cierra una etapa y registra trazabilidad", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const project = await caller.projects.create({
      projectName: `Prueba de cierre ${Date.now()}`,
      clientName: "Cliente de prueba",
      projectType: "desarrollo",
    });
    createdProjectId = project.id;

    await caller.sow.save({
      projectId: project.id,
      data: { generalObjective: "Preparar cierre de prueba", totalAmount: "0", currency: "USD" },
    });
    await caller.closure.save({
      projectId: project.id,
      data: {
        category: "proceso",
        whatWorked: "La coordinación de prueba funcionó.",
        whatDidntWork: "No hubo incidencias relevantes.",
        improvements: "Mantener la trazabilidad.",
        finalScore: 9,
      },
    });

    const lessons = await caller.closure.get({ projectId: project.id });
    expect(lessons[0]).toMatchObject({ category: "proceso", finalScore: 9 });

    const closure = await caller.stages.formalClose({
      projectId: project.id,
      stageId: "sow",
      confirmed: true,
      notes: "Cierre formal de validación.",
    });
    expect(closure.success).toBe(true);

    const registeredClosure = await caller.stages.getClosure({ projectId: project.id, stageId: "sow" });
    expect(registeredClosure).toMatchObject({ projectId: project.id, stageId: "sow", notes: "Cierre formal de validación." });

    const compliance = await caller.compliance.metrics();
    expect(compliance.details).toEqual(expect.any(Array));

    const audit = await caller.audit.list({ page: 1, pageSize: 100, entity: "closure" });
    expect(audit.logs.some((log: any) => String(log.entityId) === String(project.id) && log.action === "save")).toBe(true);
  });
});
