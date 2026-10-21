# Preparación de la migración 4727 a CONSALOP02

**21-oct-2026. Base:** `42562d65`. **Alcance autorizado:** operación y facturación del servicio PMO-2070001 deben quedar en CONSALOP02. **Estado:** P0 ejecutado; P1 pendiente de sesión Jira para configuración/verificación por interfaz. No se movieron, crearon ni actualizaron issues; no se cambiaron registros PMO.

## Respaldo completado

Se respaldaron la ficha, etapas, 24 controles, seis cuotas UF195, documentos y decisiones documentales, reportes, evidencia financiera, multas, SLA, mappings y corridas. Se conservó el SoW adjunto y se capturaron completos los seis hitos PSCSC4S-41/-19/-20/-21/-22/-23, sus campos, changelog paginado y comentarios paginados. El adjunto de aprobación de M01 también fue descargado y respaldado. Todos los checksums SHA-256 pasaron.

Directorio privado: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-migration/2026-10-21T17-56-58-914Z/`. El respaldo no está en Git ni contiene credenciales del cliente API.

El snapshot fresco conserva tres hitos Facturado y tres No facturado en el campo `customfield_11237`. El traslado no autoriza inferir entrega o aceptación de los controles operativos.

## Compatibilidad confirmada y pendiente

PSCSC4S es `classic`/business (12976); CONSALOP02 es `next-gen`/service_desk (13114). La cuenta técnica tiene permisos de Browse, Move, Create y Bulk Change, y administración del destino. El campo Estado de Facturación tiene contexto global 12913 y opciones existentes.

El destino sólo tiene tipos de mesa de ayuda. Falta configurar/validar tipos adecuados de Staffing y facturación. La presencia global del campo no demuestra que su valor se represente correctamente en las pantallas/formularios del destino.

La API oficial de bulk move admite mappings, pero advierte que no tiene toda la funcionalidad de la interfaz. La guía de migración entre estilos advierte que ciertos campos globales pueden retener datos sin mapearse/mostrarse en los campos locales del destino. No se concluye que mover sea imposible; **se requiere configurar y verificar la vía nativa antes de escribir**. [1] [2] [3]

Se abrió Jira en el navegador aislado; redirige al inicio de sesión Atlassian. El token API funciona, pero no autentica una sesión web. La siguiente acción es que el usuario inicie sesión en el navegador abierto, sin compartir su contraseña en chat.

## Implementación preparada y validación

Se añadió `scripts/prepareStaffing4727Migration.ts`, exclusivamente de lectura: GET API y SELECT DB, con límites de paginación, timeouts, validación de identidad/cuotización y archivos privados. Se actualizó el backlog; no se activó aún el corte financiero ni se encendió una creación ciega de hitos.

`pnpm build` exitoso; `pnpm check` conserva los cinco errores TypeScript heredados (cuatro en jiraMilestoneSync.ts y uno estadoSII en routers.ts). `git diff --check` correcto. No se afirma ejecución de una suite funcional nueva, puesto que este bloque no modifica el comportamiento de la aplicación.

Después del acceso Jira se retomará P1 y luego la secuencia autorizada de simulación, migración, generación del plan y corte exclusivo a CONSALOP02. Si la vía nativa no conserva evidencia, se detendrá y propondrá la alternativa prevista en el plan antes de copiar.

## Referencias

[1]: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/ "Atlassian Jira Cloud REST API — Issue bulk operations"
[2]: https://developer.atlassian.com/cloud/jira/platform/bulk-operation-additional-examples-and-faqs/ "Atlassian — Bulk operation examples and FAQs"
[3]: https://support.atlassian.com/jira-work-management/docs/migrate-between-team-managed-and-company-managed-projects/ "Atlassian — Migrate between team-managed and company-managed spaces"
