import { describe, expect, it } from "vitest";
import {
  canConfirmExistingJsmLink,
  canManageExistingJsmSpace,
  getJsmHealthPresentation,
  getJsmPreflightPresentation,
} from "./jsmExistingSpaceUi";

describe("J5 existing JSM Space UI policy", () => {
  it("permite modificar solo a admin y pmo", () => {
    expect(canManageExistingJsmSpace("admin")).toBe(true);
    expect(canManageExistingJsmSpace("pmo")).toBe(true);
    expect(canManageExistingJsmSpace("pm")).toBe(false);
    expect(canManageExistingJsmSpace("consulta")).toBe(false);
    expect(canManageExistingJsmSpace(undefined)).toBe(false);
  });

  it("traduce todos los estados de preflight a mensajes visibles", () => {
    expect(getJsmPreflightPresentation("ready")).toEqual({
      label: "Listo para vincular",
      tone: "success",
    });
    expect(getJsmPreflightPresentation("linked_to_other_service")).toEqual({
      label: "Vinculado a otro servicio",
      tone: "danger",
    });
    expect(getJsmPreflightPresentation("missing_issue_type_mapping")).toEqual({
      label: "Mappings pendientes",
      tone: "warning",
    });
  });

  it("solo habilita confirmar con permiso, corrida vigente y preflight linkable", () => {
    expect(
      canConfirmExistingJsmLink({
        canManage: true,
        runId: "preflight:12345678",
        canLink: true,
        isPending: false,
      })
    ).toBe(true);
    expect(
      canConfirmExistingJsmLink({
        canManage: false,
        runId: "preflight:12345678",
        canLink: true,
      })
    ).toBe(false);
    expect(
      canConfirmExistingJsmLink({
        canManage: true,
        runId: null,
        canLink: true,
      })
    ).toBe(false);
    expect(
      canConfirmExistingJsmLink({
        canManage: true,
        runId: "preflight:12345678",
        canLink: false,
      })
    ).toBe(false);
    expect(
      canConfirmExistingJsmLink({
        canManage: true,
        runId: "preflight:12345678",
        canLink: true,
        isPending: true,
      })
    ).toBe(false);
  });

  it("presenta salud pendiente por defecto y distingue estados operativos", () => {
    expect(getJsmHealthPresentation(null).label).toBe("Pendiente de validar");
    expect(getJsmHealthPresentation("healthy").label).toBe("Saludable");
    expect(getJsmHealthPresentation("warning").label).toBe("Con advertencias");
    expect(getJsmHealthPresentation("blocked").label).toBe("Bloqueado");
  });
});
