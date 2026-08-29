# H7 — Auditoría de sincronización Jira y actualización periódica

## Decisión aprobada

H7 implementará **sincronización manual más conciliación diaria determinista**. El flujo automático será exclusivamente **Jira → Prodigio PMO**; no se usarán webhooks, polling por minuto, temporizadores en proceso, agentes programados ni escrituras Jira implícitas.

## Hallazgos del estado actual

| Componente | Estado actual | Decisión H7 |
|---|---|---|
| `jiraMilestoneSync.ts` | Lee Jira y actualiza solo observaciones de hitos, pero opera fuera del onboarding, mappings e historial H1. | Reutilizar su semántica pura de estado/fechas; no usar su barrido global como orquestador H7. |
| `jiraDomainImportRunner.ts` | Reutiliza snapshot y mappings aprobados para riesgos/WBS/Deal, con UPSERTs e historial; la fuente está fija en `initial_import`. | Extraer/reutilizar sus transformadores y persistencia dentro de una corrida `manual` o `scheduled` basada en snapshot fresco. |
| `jiraPreflightRunner.ts` | Puede refrescar el snapshot de un onboarding `ready` sin retroceder su estado, pero además consulta diagnóstico, boards y reporte y registra `preflight`. | No usarlo como sincronizador periódico; H7 leerá únicamente issues aprobados y persistirá un snapshot actualizado. |
| `jira_sync_log` | Ya soporta fuentes `manual`, `scheduled` y `retry`, estado, conteos, detalle, error y duración. | Reutilizarlo; no crear una tabla de historial paralela. |
| `admin_settings` | Permite configuración clave/valor durable. | Guardar allí el `task_uid`, cron UTC y estado de la programación del job de proyecto. |
| Heartbeat actual | Existe solo `financial-sync-daily` a las 03:00 UTC. | Crear un job Jira separado después de publicar el callback, inicialmente a las 04:00 UTC para evitar solapamiento. |
| Registro de callbacks | `captureHealthSnapshot` quedó anidado accidentalmente dentro del handler financiero y no se monta al iniciar el servidor. | Corregir el anidamiento como precondición del slice de infraestructura, con prueba de registro de rutas. |

## Contrato del motor H7

El motor seleccionará únicamente onboardings `ready`, con proyecto materializado y mappings vigentes `approved` cuyo `syncDirection` sea `jira_to_pmo`. Consultará en Jira las claves mapeadas, actualizará el snapshot persistido y conciliará las entidades canónicas.

| Dominio | Campos observables actualizables | Campos protegidos |
|---|---|---|
| Hitos | estado Jira, categoría Jira, fecha Jira planificada/replanificada y fecha de cierre Jira | baseline contractual, aceptación del cliente, acta, progreso por cardinalidad |
| Riesgos | resumen y metadatos Jira observados | categoría, probabilidad, impacto y clasificación PMO ya confirmadas |
| WBS | resumen, estado, responsable y parent Jira real | fase, story points y planificación PMO ya confirmados |
| Documentos | solo referencias S3 reales ya aprobadas | no crear archivos, URLs, evidencias ni actas desde texto Jira |
| Finanzas | ninguna resincronización | `dealId` confirmado y datos de `financial_data`; no inferir ni sobrescribir |

Cada ejecución tendrá un identificador de operación. Para el job diario, la clave incluirá la fecha UTC, de modo que los reintentos de la plataforma reutilicen la misma corrida por proyecto y no dupliquen efectos. Una falla parcial no detendrá los demás proyectos. La respuesta reportará procesados, omitidos, diferidos, errores y conteos por dominio.

## Seguridad y límites operativos

El callback será `POST /api/scheduled/syncJiraHomologated`, se registrará antes del fallback Vite/static y exigirá `sdk.authenticateRequest(req)`, `user.isCron === true`, `user.taskUid` y coincidencia exacta con el identificador durable guardado. El trabajo será acotado a menos de dos minutos y no leerá identificadores de negocio desde `req.body`.

La ejecución manual quedará restringida a **Admin/PMO**. Los roles PM y consulta podrán leer el historial de proyectos autorizados, pero no disparar corridas globales. Ninguna ruta H7 cerrará etapas, aprobará baseline, aceptará hitos, adjuntará actas o escribirá en Jira.

## Programación activada

El callback se publicó antes de crear la programación. El job durable `jira-homologation-sync-daily` quedó habilitado con `task_uid` `85htkuVocAmvfXwUV7CTa5`, cron `0 0 4 * * *` y ruta `POST /api/scheduled/syncJiraHomologated`. Su identificador se guardó en `admin_settings.jira_reconciliation_daily_task_uid`, que el callback compara con la identidad cron autenticada.

Para validar el circuito real, el cron se ajustó temporalmente a una ventana por minuto y luego se restauró inmediatamente a las **04:00 UTC**. La ejecución `SDT2Fn25s5U4YuLhqw8FCc` terminó con HTTP 200 en 1.524 ms y respondió `candidateCount: 0`, `processedCount: 0`, `errorCount: 0`; por lo tanto, demostró autenticación, ruteo y batch sin modificar proyectos ni Jira. La próxima ejecución regular quedó fijada para `2026-08-30T04:00:00Z`.
