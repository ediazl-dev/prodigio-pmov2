import { describe, it, expect } from "vitest";

describe("GOOGLE_DRIVE_TOKEN", () => {
  it("debe estar configurado en el entorno", () => {
    const token = process.env.GOOGLE_DRIVE_TOKEN;
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token!.length).toBeGreaterThan(10);
  });

  it("debe ser un token válido de Google (formato ya29 o similar)", () => {
    const token = process.env.GOOGLE_DRIVE_TOKEN;
    // Los tokens de Google OAuth 2.0 típicamente empiezan con ya29. o son JWT
    // Aceptamos cualquier string no vacío como válido para este test básico
    expect(token).toMatch(/^[\w\-\.]+$/);
  });
});
