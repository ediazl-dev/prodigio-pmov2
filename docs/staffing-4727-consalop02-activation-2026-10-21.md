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

## Actualización: operación aplicada — 21-oct-2026, 17:16 Chile

La corrida operacional terminó con código 0. CONSALOP02 contiene 37 issues: seis hitos originales trasladados y 31 tareas únicas (CONSALOP02-8 a CONSALOP02-38). Son 24 controles mensuales, dos definiciones quincenales y cinco verificaciones de inicio. Las definiciones quincenales no constituyen reuniones realizadas ni tienen fechas ficticias.

GET confirmó 31 claves únicas, cero tareas cerradas, cero customer request type asignado y cero participantes de solicitudes en las tareas creadas. Los registros son internos; esto no equivale a ocultar sus tipos del catálogo del portal. Ese control todavía no quedó certificado: ambos tipos aparecen en el grupo de portal 462. La ruta de restricciones del navegador se detuvo al volverse repetitiva, sin afirmar que hubiese guardado una restricción.

Las filas financieras se conservaron íntegramente; los reportes y la evidencia financiera no se modificaron. El respaldo inicial se preserva en reanudaciones y el journal registra cada intención antes del POST. La lectura financiera mantiene UF585 facturados según campo explícito y UF585 No facturado, cero N/D y cero duplicados. El 4687 permanece cerrado e idéntico a su snapshot.

Revalidación oficial `staffing4727-revalidate-20261021-after-activation`: mismo servicio/Space, cero bloqueadores/advertencias, healthy y procedencia created preservada. Readiness: 31 elementos aplicables, cero sin vincular. QA: 1.180 pruebas aprobadas, 20 omitidas; build exitoso; cinco errores TypeScript heredados.

Se detectó un defecto de presentación: JSM Setup todavía muestra Facturación (0) y Jira externo, al excluir las seis referencias existentes de la lista. Se corregirá sin tratarlas como seis nuevas creaciones ni cambiar la compuerta de 31 actividades.

## Presentación corregida — JSM Setup

La vista previa ahora muestra Actividades (31) y Facturación (6). Las seis cuotas existentes se exponen como referencias de consulta, excluidas del contador de nuevas creaciones y de pendientes de sincronización. La compuerta permanece en 31/31 y cero pendientes. Se retiró la etiqueta engañosa «Facturación en Jira externo» y se explica que los hitos existentes pueden estar en el mismo CONSALOP02. El enum técnico external_reference conserva su función de no recrear hitos y no expresa que la facturación esté en otro Space.

No se declaró el plan completo: quedan pendientes ocultar/restringir ambos tipos en el catálogo del portal y configurar monto/período como campos Jira adicionales. Las tareas creadas no tienen customer request type ni participantes; esos registros internos no equivalen a una restricción certificada del catálogo. Los montos contractuales están disponibles en PMO y se preservan sus seis cuotas; no se los convierte ni se deriva dinero desde texto Jira.

La causa del bucle fue insistir con controles de restricciones que cambiaban de referencia o quedaban cubiertos en el navegador integrado. Se detuvo esa ruta y se completó la creación con la API, un único journal, progreso finito por tarea y verificación por GET. No se reenviaron a ciegas creaciones inciertas.

## Certificación de la versión final

La suite final exacta terminó con código 0: 1.183 pruebas aprobadas, 20 omitidas, 169 archivos aprobados; se excluyó la prueba live `ufService.test.ts` ajena a esta corrección. Build exitoso, cinco errores TypeScript heredados, diff íntegro y secret scan correcto. La regresión antigua se actualizó al nuevo texto conservando el enum external_reference; se añadieron tres pruebas para referencias existentes, compatibilidad y deduplicación de consulta.

La comprobación de vista previa confirmó Actividades (31), Facturación (6), compuerta 5/5, 31/31 aplicables y cero pendientes. No se modificó la etapa de Ejecución ni se declaró cumplido el SoW. El estado de entrega de reportes continúa sujeto a evidencia real. Los cambios de Jira y de datos PMO ya están aplicados; la última corrección de texto/lista en la aplicación debe publicarse desde su checkpoint para llevarla al dominio productivo. No se confunde guardar con publicar.

El plan no se marca completo: P1 conserva los dos pendientes administrativos indicados arriba. La creación operacional y la migración de facturación están ejecutadas y verificadas, no pendientes de otro dry-run.
