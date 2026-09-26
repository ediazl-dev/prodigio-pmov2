# Política de gobierno documental v1

**Versión:** `2026-09-26.v1`  
**Base de implementación:** checkpoint `e661224`  
**Estado inicial:** modo observación; los gates productivos se activan sólo después de migración y remediación verificadas.

## Requisitos base

| Entidad | Requisitos obligatorios |
|---|---|
| Servicio recurrente | Contrato, SoW, propuesta técnico-económica y P&L con costeo |
| Proyecto PMO nativo o vinculado | Los cuatro anteriores más plan de trabajo con hitos |

La política se aplica a todos los tipos de servicio, incluido Staffing. Una excepción `not_applicable` no se infiere: requiere autorización Admin, motivo, evidencia, fecha y versión de política.

## Regla de cumplimiento

Un requisito cumple únicamente cuando existe un artefacto asociado a la entidad correcta, la versión seleccionada está validada, la vigencia cubre el corte o fue aprobada expresamente como abierta y no existe rechazo, revocación o reemplazo posterior. Toda carga comienza en estado pendiente.

La lectura separa presencia, validación, vigencia, aplicabilidad y cumplimiento derivado. Los históricos conservan brechas y decisiones, pero no reabren etapas automáticamente.

## Defaults operativos adoptados

- **Carga:** Admin, PMO y PM; el PM debe pertenecer al expediente cuando aplique.
- **Validación:** Admin y PMO. Para la primera versión, el P&L requiere además un checklist financiero explícito; no se crea un rol nuevo.
- **Excepciones:** sólo Admin, siempre con motivo y evidencia.
- **Vigencia:** se admite vigencia abierta únicamente cuando el revisor la declara explícitamente; las fechas nunca se inventan.
- **P&L:** debe acreditar ingreso o presupuesto, costo, margen, moneda, fecha de corte y aprobación financiera. `financial_data` o un archivo llamado `pl` no bastan por sí solos.
- **Plan de proyecto:** Gantt, WBS o Jira pueden ser fuente, pero debe persistirse un artefacto o manifiesto versionado con al menos un hito identificable, fecha de captura y hash.
- **Jira:** un issue `Done`, un Hito PMO o una referencia `jira://` son evidencia operacional; no equivalen a contrato ni aceptación del cliente.
- **Rollout:** primero modo observación, luego remediación y finalmente gates por cohorte.

## Compatibilidad legacy

- `contrato` y `sow` son candidatos directos al requisito correspondiente, pero siguen pendientes hasta validación.
- `propuesta_tecnica` requiere confirmar que contiene componente económico.
- `pl` requiere confirmar que corresponde a P&L con costeo; nunca se interpreta como plan de trabajo por nombre.
- `otro` no satisface requisitos base.
- No se borran filas, referencias ni versiones existentes durante la migración.

## Guardrails

- El servidor es la autoridad de los gates; la UI sólo explica bloqueadores.
- Cada cierre guarda snapshot de policy, corte, documento, versión y decisión.
- Las decisiones son append-only y auditables.
- Las descargas verifican identidad y permisos y no exponen `fileKey` ni tokens.
- Se preserva el ciclo financiero hasta **Facturado** y el flujo independiente de **Multas**.
- Antes de cada checkpoint: pruebas focales, build, revisión TypeScript, diff, secretos, rama y referencias.

## Deuda técnica heredada

La base mantiene cinco errores TypeScript previos y no relacionados: cuatro en `server/jiraMilestoneSync.ts` y uno en `server/routers.ts` sobre `estadoSII`. Ninguna fase documental debe agregar errores nuevos.

## Estado de implementación

### R0 — completado

El catálogo y los defaults quedaron congelados en código y pruebas sobre el checkpoint `dac58181`.

### R1 — modelo aditivo aplicado

Se creó la migración `0052_simple_thaddeus_ross.sql` con siete tablas nuevas: catálogo, artefactos, decisiones append-only, resoluciones de aplicabilidad, asociaciones, snapshots de plan y snapshots de gates. La migración no contiene `DROP`, `TRUNCATE`, `DELETE` ni `ALTER TABLE`.

Antes de aplicarla se guardó un respaldo con checksum en `/home/ubuntu/backups/prodigio-pmo/2026-09-26-document-governance-r1/`. La base conservaba 12 proyectos, 3 servicios recurrentes, 12 documentos recurrentes y cero controles recurrentes. Después de la migración se verificaron las siete tablas y nueve entradas de catálogo. En R1 no se importaron documentos ni se activaron gates.

### R2 — API transversal implementada

La API `documentGovernance` permite consultar catálogo y expediente, cargar versiones con hash SHA-256, detectar duplicados, validar, rechazar, revocar, archivar lógicamente, autorizar excepciones y descargar mediante URL firmada. La carga verifica tamaño máximo de 25 MB, extensión, MIME y firma binaria. Cada nueva versión deja la anterior como `superseded` y crea una decisión `pending`; ninguna operación elimina físicamente artefactos o decisiones.

La carga queda habilitada para Admin, PMO y PM asignado; la validación para Admin/PMO; `not_applicable` sólo para Admin con evidencia. El P&L sólo puede validarse con los seis controles financieros explícitos. La auditoría no registra base64, `fileKey` ni secretos.
