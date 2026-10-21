# Activación de Staffing 4727 — CONSALOP02

Servicio PMO-2070001. Ejecución autorizada del plan del 21-oct-2026. Estado al guardar este bloque: facturación trasladada y corte PMO certificado; operación aún en dry-run.

## Facturación ejecutada

Se movieron los seis originales por la API nativa de Jira, sin copias ni eliminación de su historial. Se verificaron ID, descripción, fecha objetivo, reporter/asignado, vínculos, comentarios, todas las entradas históricas originales y bytes SHA-256 del adjunto de aprobación. Los nombres del workflow se mapearon de `Pendiente` a `To Do` y de `Cumplido (Entregable)` a `Done`; no se inventó fecha de resolución. El workflow de origen clasificaba ambos como categoría `new`, por lo que esa categoría no se usó para determinar cumplimiento.

| Período | Origen histórico | Destino canónico | Estado explícito observado | Cuota |
|---|---|---|---|---:|
| M01 | PSCSC4S-41 | CONSALOP02-3 | Facturado | UF195 |
| M02 | PSCSC4S-19 | CONSALOP02-4 | Facturado | UF195 |
| M03 | PSCSC4S-20 | CONSALOP02-5 | Facturado | UF195 |
| M04 | PSCSC4S-21 | CONSALOP02-6 | No facturado | UF195 |
| M05 | PSCSC4S-22 | CONSALOP02-7 | No facturado | UF195 |
| M06 | PSCSC4S-23 | CONSALOP02-2 | No facturado | UF195 |

El campo global `customfield_11237` es una selección múltiple incompatible con la reutilización en este JSM team-managed. Se creó y verificó una definición local de selección simple, `customfield_12127 / Estado de Facturación Staffing`, sin valor por defecto, con Facturado / No facturado / Sin información. El bulk move no copió el campo opcional incompatible automáticamente: cada estado observado se copió explícitamente del respaldo y se verificó por GET. No se infirió facturación desde el workflow.

La configuración administrativa `recurring-jira-billing-field:2070001` registra el scope exacto de servicio, projectId 13114, projectKey CONSALOP02, fieldId y fecha de verificación. El lector acepta procedencia `created` o `linked` sólo con todas las cuotas vinculadas a ese Space. Un error de fuente o mapping no reactiva PSCSC4S. Lectura viva certificada: seis cuotas, tres facturadas UF585 y tres No facturado UF585; cero N/D, cero duplicados y fuente única CONSALOP02. Esto no acredita pago ni fecha/número de emisión que no estén documentados.

Las seis cuotas PMO conservan montos, moneda, fechas y estados locales; sólo se cambió `jiraIssueKey`. El corte es transaccional, respaldado, auditado e idempotente. El 4687 cerrado fue verificado contra su hash sin cambios.

## Operación preparada, aún no aplicada en este bloque

La matriz deriva del SoW adjunto: 24 controles mensuales conservando IDs, dos definiciones quincenales de 1-on-1/burn-rate y cinco verificaciones de preinicio/contrapartes. Las cadencias no se convierten en una agenda histórica inventada. Las seis aprobaciones quedan sin dueDate hasta recepción formal; otros objetivos observados se conservan sin llamarlos baseline contractual. No se completan tareas por el estado Facturado de un hito. No se generan SLA de incidentes, DR ni 24x7.

El dry-run del creador operacional pasó con 31 ítems y seis hitos canónicos. El script registra intent/receipt para cada creación y vínculo; ante incertidumbre sólo reusa un artefacto probado por etiqueta, sin repetir POST a ciegas. Aún falta configurar privacidad del portal, hacer visibles monto/período en Jira, aplicar las tareas y certificar readiness/UI y suite completa.

## Recuperación y evidencia privada

Respaldo completo: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-migration/2026-10-21T19-48-32-887Z`.

Journal nativo: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-native-move/journal.json`.

Corte PMO: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-billing-cutover`.

Activación operacional: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-activation`.

Un checkpoint de código no revierte Jira ni los datos. No se hará rollback automático del movimiento ni se borrarán originales o evidencia.
