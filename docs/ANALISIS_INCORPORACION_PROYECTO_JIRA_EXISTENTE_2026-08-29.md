# Incorporación de un proyecto Jira existente en Prodigio PMO

**Fecha:** 29 de agosto de 2026  
**Autor:** Manus AI  
**Estado:** Diagnóstico y propuesta; sin cambios funcionales aplicados

## Conclusión ejecutiva

**La plataforma ya dispone de una opción para vincular un proyecto existente en Jira, pero la capacidad actual es parcial.** Un usuario con rol `admin` o `pmo` puede ingresar a **Administración → Spaces JIRA**, seleccionar un proyecto Jira que todavía no esté administrado por Prodigio y crear su registro vinculado en PMO.

El flujo actual crea el proyecto, registra su Space Jira y genera las seis etapas obligatorias. Sin embargo, **no reconstruye automáticamente toda la historia documental y contractual del proyecto**. Tampoco importa en ese momento los hitos como baseline ejecutivo, los riesgos, el SoW, el backlog, las actas ni la asociación financiera. Esos elementos requieren procesos posteriores o configuración manual.

> La funcionalidad vigente sirve para incorporar rápidamente un proyecto Jira a la vista operativa de Prodigio, pero todavía no constituye un asistente completo de migración u onboarding desde Jira.

## Flujo disponible actualmente

La interfaz está disponible en `/admin/jira-spaces`, mediante la opción **Spaces JIRA** del menú de administración. El diálogo permite buscar proyectos accesibles en el tenant Jira, excluye los que ya están vinculados y solicita el cliente y el tipo de proyecto antes de crear el registro PMO.

| Paso | Comportamiento actual | Evidencia en código |
|---|---|---|
| Buscar proyecto Jira | Lista proyectos del tenant y permite buscar por nombre o key | `server/routers.ts`: `searchAvailableProjects` |
| Evitar duplicados | Excluye keys Jira ya administradas y valida nuevamente al confirmar | `server/routers.ts`: `getManagedJiraProjectKeys` |
| Crear proyecto PMO | Crea un proyecto activo con `origin = linked` y `currentStage = design` | `server/db.ts`: `createLinkedProject` |
| Crear seis etapas | Marca SoW, Jira, Riesgos y Planificación como completadas; Avance queda en progreso y Cierre bloqueado | `server/db.ts`: `createLinkedProject` |
| Registrar Space Jira | Persiste key, id, nombre, URL e issue types disponibles | `server/routers.ts`: `createJiraSpaceRecord` |
| Auditar | Registra el evento `link_jira_project` | `server/routers.ts`: `audit` |
| Abrir operación | El proyecto aparece directamente en la vista de Avance | Mensaje de `linkExistingProject` |

## Datos que se crean o sincronizan hoy

| Dominio | Situación actual |
|---|---|
| Identidad del proyecto | Se persisten nombre, cliente, tipo, key Jira, URL y responsable PMO que ejecutó la vinculación. |
| Estructura PMO | Se crean exactamente seis etapas. Las cuatro etapas previas se cierran administrativamente de forma automática, Avance queda activo y Cierre queda bloqueado. |
| Metadatos Jira | Se guardan el identificador, key, nombre, URL e issue types del proyecto Jira. |
| Estado operativo Jira | Los reportes vinculados pueden consultar Jira para mostrar avance, issues, épicas, hitos, riesgos y equipo. |
| Hitos ejecutivos | No se crean como parte de `linkExistingProject`. El baseline ejecutivo debe crearse posteriormente desde Jira o por el fallback del Dashboard Ejecutivo v2. |
| Estado y fechas de hitos | Una vez creados los hitos ejecutivos y vinculadas sus keys, el sincronizador puede actualizar estado Jira, fecha planificada, fecha real de cierre y estado semántico. |
| Datos financieros | No se importan desde Jira. La relación financiera continúa dependiendo del Deal y de la sincronización corporativa de Google Sheets. |
| Documentos contractuales | No se importan automáticamente. SoW, actas, minutas y evidencia deben cargarse o vincularse con trazabilidad. |
| Riesgos y backlog PMO | No se materializan en las tablas PMO durante la vinculación inicial; permanecen como evidencia consultada desde Jira hasta implementar una importación explícita. |

## Brechas respecto del objetivo solicitado

La principal brecha es que el alta actual **declara completadas las etapas SoW, Jira, Riesgos y Planificación sin reconstruir sus evidencias**. Esto permite que el proyecto entre a Avance, pero no garantiza que Prodigio disponga de una estructura histórica completa y auditable.

También falta una sincronización inicial controlada que detecte y clasifique los issues Jira antes de crear hitos ejecutivos, riesgos o backlog PMO. Los proyectos Jira pueden usar tipos, estados y convenciones diferentes; por ello, una importación automática sin revisión podría clasificar información incorrectamente. La asociación con datos financieros es otra decisión separada y debe validarse mediante Deal, cliente y moneda, no deducirse únicamente del nombre.

## Flujo objetivo recomendado

Se recomienda evolucionar la opción existente a un asistente denominado **“Incorporar proyecto desde Jira”**, conservando la vinculación actual como base técnica.

| Fase | Resultado esperado | Control obligatorio |
|---|---|---|
| A. Preflight | Seleccionar el proyecto Jira y obtener resumen de issue types, estados, boards, hitos, riesgos, épicas, responsables y calidad de fechas | No escribir datos; mostrar advertencias y duplicados |
| B. Identidad PMO | Confirmar nombre, cliente, tipo, PM, Delivery, Deal financiero y fecha de corte | Confirmación humana antes de crear |
| C. Estructura de seis etapas | Crear las seis etapas y distinguir `importada`, `en progreso`, `bloqueada` o `[PENDIENTE]` | No marcar una etapa completada sin evidencia |
| D. Mapeo Jira | Proponer qué issues son hitos, riesgos, épicas y tareas; permitir correcciones | Vista previa y aceptación explícita |
| E. Baseline ejecutivo | Crear hitos versionados con baseline contractual, fecha Jira replanificada y fecha real separadas | Nunca reemplazar la fecha contractual con `duedate` replanificada |
| F. Sincronización inicial | Aplicar UPSERT idempotente por `issueKey` y registrar resultado por proyecto | Sin duplicados; log con creados, actualizados, omitidos y errores |
| G. Operación continua | Permitir “Sincronizar ahora” y mostrar última sincronización | No bloquear la interfaz si Jira no responde |

## Backlog propuesto

| Prioridad | Ítem | Criterio de aceptación |
|---|---|---|
| P0 | Crear preflight de Jira sin escritura | Muestra cobertura de hitos, `duedate`, estados, tipos y duplicados antes de confirmar |
| P0 | Incorporar estados de etapa `importada` o equivalente auditable | Las etapas históricas no se presentan como completadas sin evidencia |
| P0 | Crear mapeo revisable de issues a hitos ejecutivos | Cada hito conserva `issueKey`, baseline, `jiraDueDate`, `jiraClosedDate` y estado |
| P0 | Ejecutar sincronización inicial idempotente | Repetir el proceso no crea duplicados ni elimina evidencia |
| P1 | Mapear riesgos y backlog Jira a la estructura PMO | El usuario confirma clasificación antes de persistir |
| P1 | Asociar Deal financiero de forma explícita | La plataforma propone coincidencias, pero exige confirmación |
| P1 | Agregar historial de sincronizaciones Jira | Incluye fecha, proyecto, creados, actualizados, omitidos y errores |
| P1 | Incorporar controles de permisos | `admin` y `pmo` incorporan; `pm` puede sincronizar proyectos asignados si se aprueba la política |
| P2 | Permitir importación documental asistida | Los documentos mantienen fuente, fecha y trazabilidad; nunca se generan evidencias ficticias |
| P2 | Añadir conciliación de responsables Jira–PMO | Las asignaciones ambiguas quedan como `[POR CONFIRMAR]` |

## Recomendación

La opción actual puede utilizarse **desde ahora** si el objetivo inmediato es registrar un proyecto Jira en Prodigio y visualizarlo en Avance. Para proyectos activos con historia previa, recomiendo implementar primero los cuatro ítems P0, porque resuelven la trazabilidad, evitan cierres administrativos sin evidencia y aseguran que la sincronización de hitos sea coherente con el Dashboard Ejecutivo.

No se aplicó ningún cambio funcional durante este análisis. La evolución debe comenzar únicamente después de aprobar el alcance, especialmente la regla para tratar las cuatro etapas previas de un proyecto importado.
