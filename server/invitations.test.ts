import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getUserByEmail, upsertUser } from "./db";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "invitation-test-admin",
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

describe("invitaciones y vinculación de cuentas", () => {
  it("mantiene el rol admin del propietario y bloquea invitar administradores", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.auth.me()).resolves.toMatchObject({ role: "admin" });
    await expect(caller.users.invite({
      email: `admin-invitado-${Date.now()}@prodigio.test`,
      name: "Administrador invitado",
      role: "admin" as any,
      origin: "https://prodigio.test",
    })).rejects.toThrow();
  });

  it.each(["pmo", "pm", "consulta"] as const)("acepta y vincula la cuenta invitada con rol %s", async (role) => {
    const caller = appRouter.createCaller(createAdminContext());
    const suffix = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `invitado-${suffix}@prodigio.test`;

    const invitation = await caller.users.invite({
      email,
      name: `Usuario ${role}`,
      role,
      origin: "https://prodigio.test",
    });
    expect(invitation.success).toBe(true);

    const accepted = await caller.users.acceptInvite({ token: invitation.token });
    expect(accepted).toMatchObject({ success: true, email, role });

    const beforeOAuth = await getUserByEmail(email);
    expect(beforeOAuth).toMatchObject({ email, role, status: "invitado" });
    expect(beforeOAuth?.openId).toMatch(/^invite_/);

    const realOpenId = `oauth-${suffix}`;
    await upsertUser({
      openId: realOpenId,
      email,
      name: `Usuario ${role}`,
      loginMethod: "manus",
      lastSignedIn: new Date(),
    });

    const linked = await getUserByEmail(email);
    expect(linked).toMatchObject({ openId: realOpenId, email, role, status: "activo" });
  });
});
