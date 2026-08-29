# Manual funcional y operativo

## Homologación de proyectos Jira en Prodigio PMO — H0 a H7

| Campo | Valor |
|---|---|
| Documento | Manual de homologación de proyectos Jira existentes |
| Versión | 1.0 |
| Fecha | 29 de agosto de 2026 |
| Autor | Manus AI |
| Aplicación | [Prodigio PMO](https://pmo.prodigio.tech) |
| Versión funcional descrita | Checkpoint publicado `4eb4480c` |
| Alcance | H0–H7; H8 no está ejecutado |

## 1. Resumen ejecutivo

La mejora implementada permite tomar un proyecto que **ya existe en Jira** y prepararlo para que sea gestionado bajo el mismo modelo canónico de Prodigio PMO. El proceso ya no crea un proyecto vinculado y marca etapas como terminadas artificialmente. En su lugar, exige diagnóstico, identidad, mapeo, materialización de seis etapas, baseline provisional con aprobación humana, importación controlada de dominios y sincronización posterior Jira → PMO.[1] [2]

> **Principio rector:** Jira aporta observaciones operativas; Prodigio PMO conserva el gobierno contractual, la evidencia, la aceptación del cliente y el avance oficial.

La funcionalidad está publicada desde H0 hasta H7. Sin embargo, **los proyectos vinculados existentes no fueron migrados automáticamente** al nuevo onboarding. La consulta operativa realizada al preparar este manual encontró nueve proyectos con origen `linked`, pero ninguna fila activa en `jira_project_onboarding`. Por tanto, el software está disponible, pero cada proyecto real aún debe pasar por el asistente o por el piloto controlado de H8 antes de usar la conciliación continua.

| Capacidad | Estado |
|---|---|
| Diagnóstico Jira de solo lectura | Implementado |
| Asistente de identidad y mapeo | Implementado |
| Pipeline canónico de seis etapas | Implementado |
| Baseline Jira provisional con aprobación humana | Implementado |
| Importación de hitos, riesgos y WBS | Implementado |
| Documentos reales en S3 y actas por hito | Implementado |
| Asociación financiera por Deal confirmado | Implementado |
| Sincronización manual Jira → PMO | Implementado |
| Conciliación diaria a las 04:00 UTC | Activa |
| Piloto real y migración gradual de proyectos existentes | Pendiente, H8 |

## 2. Qué problema resuelve

Antes de esta mejora, el alta de un proyecto vinculado a Jira podía dejar etapas PMO cerradas sin evidencia equivalente a la exigida a un proyecto creado desde cero. También existía riesgo de confundir fechas Jira con fechas contractuales, cierres Jira con aceptación del cliente o datos financieros con avance físico.[1]

El nuevo diseño separa esas responsabilidades y hace explícito qué dato proviene de cada fuente.

| Concepto | Fuente autorizada | Regla aplicada |
|---|---|---|
| Estructura de seis etapas | Prodigio PMO | Nunca se agregan ni eliminan etapas |
| Baseline contractual | Gantt/contrato aprobado | No puede ser sobrescrito por una replanificación Jira |
| Fecha planificada Jira | Jira | Se conserva como observación operativa separada |
| Fecha real de cierre Jira | Jira | No equivale a aceptación del cliente |
| Aceptación del hito | Acta o evidencia del cliente | Es la base del avance contractual |
| Avance contractual | Prodigio PMO | Hitos aceptados ÷ total de hitos; no usa pesos financieros |
| Deal financiero | Identidad confirmada + `financial_data` | Coincidencia exacta; nunca se infiere por nombre |
| Documentos | Archivos reales almacenados en S3 | No se crean URLs ni evidencias ficticias |

## 3. Componentes implementados por fase

| Fase | Implementación entregada | Resultado operativo |
|---|---|---|
| H0 | Contrato canónico, invariantes y pruebas de caracterización | Fijó seis etapas, cuatro roles, avance cardinal y prohibición de autocierre |
| H1 | Onboarding, mappings versionados, logs y excepciones | Cada incorporación puede reanudarse y auditarse |
| H2 | Preflight Jira de solo lectura | Diagnostica duplicados, PPDC, tipos, estados, fechas y calidad sin crear proyectos |
| H3 | Asistente de identidad y mapeo | Permite decidir, issue por issue, qué representa cada elemento Jira |
| H4 | Materialización canónica | Crea las seis etapas abiertas y exige evidencia para cerrarlas |
| H5 | Baseline e hitos provisionales | Jira propone; una persona autorizada revisa y aprueba |
| H6 | Riesgos, WBS, documentos y Deal | Importa a entidades existentes con UPSERT idempotente y faltantes explícitos |
| H7 | Conciliación manual y diaria | Actualiza observaciones Jira sin loops ni escrituras de retorno |

Las reglas ejecutables de etapas, estados de onboarding y mapeos se encuentran centralizadas en los servicios de homologación, no dispersas en la interfaz.[2] [3]

## 4. Roles y permisos

Prodigio conserva exactamente cuatro roles: `admin`, `pmo`, `pm` y `consulta`. La homologación administrativa no crea roles nuevos.[1]

| Acción | Admin | PMO | PM asignado | Consulta |
|---|---:|---:|---:|---:|
| Ejecutar preflight | Sí | Sí | No | No |
| Guardar identidad y mappings | Sí | Sí | No | No |
| Materializar proyecto Jira | Sí | Sí | No | No |
| Ejecutar importación inicial H6 | Sí | Sí | No | No |
| Editar/aprobar baseline provisional | Sí | Sí | Sí, si está asignado | No |
| Cargar documentos del proyecto | Sí | Sí | Sí, si está asignado | No |
| Ejecutar “Sincronizar ahora” | Sí | Sí | No | No |
| Consultar detalle e historial | Sí | Sí | Lectura | Lectura |
| Cerrar una etapa | Según permiso y secuencia | Según permiso y secuencia | Según asignación | No |

La interfaz oculta o deshabilita las acciones no autorizadas, pero la protección principal está en el backend. La conciliación manual está restringida explícitamente a Admin/PMO y exige un proyecto materializado de origen `linked`.[11]

## 5. Estados del onboarding

El onboarding es reanudable. Guardar o volver a abrir un proyecto no debe crear otro proceso para la misma clave Jira.[3]

| Estado | Significado | Siguiente paso habitual |
|---|---|---|
| `draft` | Registro iniciado | Ejecutar diagnóstico |
| `preflight` | Diagnóstico Jira disponible | Completar identidad |
| `mapping` | Identidad guardada | Revisar y aprobar mappings |
| `reconciliation` | Proyecto materializado y baseline pendiente | Revisar propuesta contractual |
| `ready` | Baseline aprobado y proyecto habilitado | Importar/sincronizar dominios |
| `failed` | Ocurrió un error recuperable | Corregir causa y reanudar |

Un onboarding `ready` no retrocede automáticamente. Los errores y datos incompletos se registran como excepciones o corridas parciales; no se “arreglan” inventando información.[3]

## 6. Procedimiento para homologar un proyecto existente

### 6.1 Preparación

La operación debe realizarla un usuario Admin o PMO. Antes de comenzar deben existir la clave Jira correcta, usuarios reales para PM y Delivery y, cuando corresponda, un Deal confirmado que ya esté presente en los datos financieros sincronizados. No es necesario crear manualmente el proyecto PMO antes de usar el asistente.

### 6.2 Abrir el asistente

Desde **Administración → Spaces Jira**, se selecciona el proyecto Jira y se inicia la opción de homologación. La pantalla muestra cuatro pasos: **Diagnóstico**, **Identidad PMO**, **Mapeo Jira** y **Activación**.[4] [5]

### 6.3 Paso 1 — Diagnóstico

El botón de preflight consulta Jira en modo lectura y guarda un snapshot. El diagnóstico revisa identidad del proyecto, tipos de issues, estados, fechas, configuración PPDC, duplicidad y calidad mínima. En este paso **no se crea un proyecto PMO y no se escribe en Jira**.[4]

| Resultado | Interpretación |
|---|---|
| Aprobado | Se puede continuar a identidad |
| Con advertencias | Se puede revisar la información faltante antes de avanzar |
| Duplicado/bloqueante | Debe resolverse antes de materializar |
| Error de conectividad | No se pierde el estado; el flujo puede reanudarse |

### 6.4 Paso 2 — Identidad PMO

Se confirma el nombre del proyecto, PM, Delivery, cliente y Deal, además de los datos de identidad disponibles. El asistente utiliza catálogos reales; no crea personas o Deals ficticios.[5]

Si no existe un Deal válido, se conserva **`[POR CONFIRMAR]`**. El sistema no busca coincidencias por texto ni por similitud del nombre.

### 6.5 Paso 3 — Mapeo Jira

Cada issue candidato se clasifica explícitamente en uno de los destinos permitidos.[3] [5]

| Destino | Uso en Prodigio |
|---|---|
| `milestone` | Hito contractual/ejecutivo provisional |
| `risk` | Riesgo canónico |
| `epic` | Elemento WBS de nivel épica |
| `task` | Historia o tarea del WBS |
| `user` | Referencia de usuario que requiere conciliación |
| `document` | Documento, solo si existe archivo S3 real |
| `stage_evidence` | Evidencia de etapa, solo si existe referencia real |
| `ignored` | Elemento Jira que no debe incorporarse |

El mapping queda versionado y debe estar `approved`. La sincronización posterior solo considera mappings aprobados con dirección `jira_to_pmo`; los descartados no se importan.[5] [8]

### 6.6 Paso 4 — Activación

La activación materializa el proyecto con las seis etapas canónicas. Ninguna etapa se marca completada por el hecho de que Jira tenga issues cerrados.[6]

| Orden | Código | Etiqueta de negocio |
|---:|---|---|
| 1 | `sow` | SoW |
| 2 | `jira` | Configuración Jira |
| 3 | `risks` | Riesgos |
| 4 | `planning` | Planificación |
| 5 | `design` | Avance Proyecto |
| 6 | `closure` | Cierre |

Cada cierre debe respetar la secuencia y aportar evidencia explícita. La conciliación histórica puede explicar estados heredados, pero no desbloquea etapas ni fabrica cierres.[6]

## 7. Baseline e hitos

Después de la activación, los issues mapeados como hitos generan una **propuesta `draft`**. Jira no aprueba automáticamente el baseline.[7]

La propuesta separa cuatro fechas que no deben mezclarse:

| Fecha | Significado |
|---|---|
| Baseline contractual | Compromiso aprobado originalmente |
| Fecha planificada Jira | Plan vigente o replanificado en Jira |
| Fecha de cierre Jira | Momento en que Jira registró el issue como terminado |
| Fecha de aceptación | Momento respaldado por acta del cliente |

Admin, PMO o el PM asignado revisan la propuesta, corrigen lo necesario y ejecutan la aprobación humana. Solo después de esa aprobación el onboarding pasa a `ready`. La sincronización continua podrá actualizar fechas y estados Jira, pero nunca la fecha contractual aprobada ni la aceptación.[7] [9]

> **Regla de avance:** `avance contractual = hitos aceptados con evidencia ÷ total de hitos`. Los pesos o montos financieros no forman parte de la fórmula.

## 8. Importación inicial H6

Cuando el onboarding está `ready`, Admin/PMO puede ejecutar la importación inicial desde la tarjeta **“Homologación y sincronización Jira”** del detalle del proyecto.[8] [11]

La operación procesa únicamente el snapshot y los mappings aprobados.

| Dominio | Qué importa | Cómo evita duplicados |
|---|---|---|
| Riesgos | Clave, resumen y metadatos Jira observados | UPSERT por proyecto + issue Jira |
| WBS | Épicas, historias/tareas y padre Jira real | UPSERT por proyecto + issue Jira |
| Deal | Identificador confirmado | Validación exacta contra `financial_data` |
| Documentos | Solo referencias S3 reales | UPSERT por proyecto + tipo + clave S3 |

Si Jira no aporta una clasificación PMO, el valor se conserva como `por_confirmar`. Un reintento actualiza observaciones de origen, pero preserva las clasificaciones que una persona ya confirmó en Prodigio.[8]

La jerarquía WBS solo se crea cuando el `parentKey` existe realmente y está mapeado. Si falta, el sistema registra una excepción; no inventa el padre.

## 9. Documentos y actas

Los archivos no se guardan como bytes en la base de datos. Se cargan al almacenamiento S3 y la base conserva metadatos y referencia segura.[1] [8]

| Tipo de evidencia | Entidad responsable | Regla |
|---|---|---|
| SoW y Gantt | `linked_project_documents` | Archivo real cargado al proyecto |
| Evidencia general del proyecto | `linked_project_documents` | No duplicar por clave S3 |
| Acta de aceptación | `executive_milestone_acceptances` | Siempre asociada al hito correspondiente |

Un texto o enlace observado en Jira no se transforma automáticamente en un documento. Si un mapping `document` o `stage_evidence` no contiene una referencia S3 real, se genera una excepción documental visible.

## 10. Sincronización manual

La tarjeta **“Homologación y sincronización Jira”** muestra el estado del onboarding, Deal, riesgos y WBS importados, documentos, actas, última ejecución, faltantes, excepciones e historial reciente.[11]

Admin y PMO pueden pulsar **“Sincronizar ahora”** cuando el onboarding está `ready`. La acción:

1. Lee únicamente las claves Jira aprobadas.
2. Actualiza el snapshot guardado.
3. Concilia observaciones de hitos, riesgos y WBS.
4. Registra conteos, estado y excepciones.
5. No escribe nada en Jira.

El botón permanece deshabilitado si el onboarding no está listo. Los reintentos usan un identificador de operación y no duplican efectos.[9] [11]

## 11. Conciliación diaria

H7 dejó activo un job durable llamado `jira-homologation-sync-daily`. Se ejecuta todos los días a las **04:00 UTC** mediante `POST /api/scheduled/syncJiraHomologated`.[10]

La hora local de Chile puede variar por horario de verano; la referencia estable es 04:00 UTC.

| Control | Comportamiento |
|---|---|
| Autenticación | Solo acepta identidad cron válida |
| Identidad durable | Verifica el `taskUid` guardado en configuración |
| Selección | Solo onboardings `ready` y materializados |
| Límite | Batch acotado para terminar dentro de la ventana del servidor |
| Falla parcial | Continúa con los demás proyectos |
| Reintento | Reutiliza la operación diaria; no duplica efectos |
| Jira | Lectura exclusiva |

La ejecución controlada de validación respondió HTTP 200 y encontró cero candidatos elegibles. Esto confirmó autenticación y ruteo sin modificar datos. También demuestra la situación actual: el job está operativo, pero no procesará los nueve proyectos `linked` heredados hasta que tengan onboarding `ready`.[10]

## 12. Qué se actualiza y qué está protegido

| Dominio | Puede actualizar Jira → PMO | Nunca se modifica automáticamente |
|---|---|---|
| Hitos | Estado Jira, categoría, fecha Jira planificada y cierre Jira | Baseline contractual, aceptación, acta |
| Riesgos | Resumen, estado y responsable observados | Categoría, probabilidad e impacto PMO confirmados |
| WBS | Resumen, estado, responsable y padre real | Fase, story points y planificación PMO confirmados |
| Documentos | Referencias S3 ya aprobadas | Creación de archivos o evidencia desde texto |
| Finanzas | Ninguna resincronización en H7 | Deal confirmado y datos financieros |
| Pipeline | Ninguna | Estado/cierre de las seis etapas |

Esta separación es el principal control anti-loop: la automatización solo escribe campos de observación Jira en PMO y no dispara cambios de retorno.[8] [9]

## 13. Historial, estados y excepciones

Cada corrida por proyecto se registra en `jira_sync_log`.[3] [9]

| Fuente | Significado |
|---|---|
| `preflight` | Diagnóstico inicial |
| `initial_import` | Importación H6 |
| `manual` | Acción “Sincronizar ahora” |
| `scheduled` | Conciliación diaria |
| `retry` | Reintento controlado |

| Estado | Interpretación |
|---|---|
| `running` | Ejecución en curso |
| `dry_run` | Evaluación sin aplicación |
| `applied` | Aplicación completada |
| `partial` | Aplicación con excepciones |
| `error` | Ejecución fallida y reintentable |

Las excepciones se guardan en `jira_import_exception`. Si la causa desaparece, pueden resolverse; si vuelve a aparecer, se reabren. La tarjeta muestra faltantes y excepciones en vez de ocultarlos.[3] [11]

## 14. Significado de `[PENDIENTE]` y `[POR CONFIRMAR]`

Estos rótulos son controles de calidad, no errores visuales.

| Rótulo | Uso |
|---|---|
| `[PENDIENTE]` | Existe una actividad o evidencia que todavía debe completarse |
| `[POR CONFIRMAR]` | La fuente no aportó un dato confiable o falta validación humana |

No deben reemplazarse por valores estimados. Para resolverlos se debe corregir Jira, cargar la evidencia real, confirmar el mapping o completar el dato gobernado en PMO, según corresponda.

## 15. Solución de problemas

| Síntoma | Causa probable | Acción recomendada |
|---|---|---|
| No aparece la tarjeta | El proyecto no es `linked` | Revisar el origen del proyecto |
| Botón deshabilitado | Onboarding inexistente o distinto de `ready` | Completar asistente y aprobar baseline |
| Deal “por confirmar” | Deal ausente o no encontrado exactamente | Confirmar identidad y sincronizar finanzas por el flujo específico |
| Riesgo/WBS no importado | Mapping no aprobado o issue ausente | Revisar mapping y diagnóstico |
| WBS sin padre | `parentKey` real ausente o no mapeado | Corregir jerarquía en Jira/mapping; no crearla manualmente sin evidencia |
| Documento pendiente | No existe archivo S3 real | Cargar el archivo mediante la interfaz |
| Corrida parcial | Una o más excepciones resolubles | Abrir historial, corregir causa y reintentar |
| Job diario no procesa proyectos | No hay onboardings `ready` | Ejecutar H8/piloto y homologar proyectos reales |

## 16. Auditoría y trazabilidad

La solución utiliza entidades canónicas y tablas de gobierno ya publicadas.[1] [12]

| Entidad | Propósito |
|---|---|
| `jira_project_onboarding` | Estado, snapshots e identidad de la homologación |
| `jira_entity_mapping` | Decisiones issue → entidad PMO, con versión y aprobación |
| `jira_sync_log` | Historial de preflight, importación y conciliaciones |
| `jira_import_exception` | Faltantes y conflictos resolubles |
| `stage_closures` | Evidencia de cierres nativos/homologados |
| `risks` | Matriz de riesgos canónica |
| `wbs_tasks` | WBS/backlog canónico |
| `linked_project_documents` | Metadatos de documentos S3 del proyecto |
| `executive_milestone_acceptances` | Actas y aceptación por hito |

## 17. Estado de validación

| Validación | Resultado |
|---|---|
| H6 focal | 76 pruebas aprobadas; persistentes omitidas por defecto |
| H6 persistente | UPSERTs, Deal, documentos y limpieza aprobados |
| H7 focal más reciente | 155 pruebas aprobadas; persistentes omitidas por defecto |
| H7 persistente | Idempotencia scheduled, baseline protegido y limpieza aprobados |
| Interfaz | Revisada con fixture `ready` en escritorio y móvil |
| Callback diario | Ejecución real HTTP 200; cero candidatos y cero errores |
| TypeScript | Persisten cinco errores heredados fuera de H6/H7 |
| Suite global | Conserva un fallo externo conocido de UF del Banco Central |

La batería focal H0–H7 está aprobada. La tarea de cierre formal H7 quedó detenida antes de registrar su último checkpoint porque se detectó un loop de validación alrededor del fallo externo de UF. Esto no despublicó las funciones: el último checkpoint funcional es `4eb4480c`.

## 18. Qué falta

H8 continúa pendiente. Su objetivo es ejecutar un piloto real, reconciliar resultados y migrar gradualmente los proyectos vinculados existentes. Esta fase es necesaria para que la programación diaria tenga candidatos reales y para verificar mappings con información de negocio efectiva.[1]

| Pendiente | Resultado esperado |
|---|---|
| Seleccionar proyecto piloto | Un proyecto real controlado, sin afectar el resto |
| Ejecutar onboarding completo | Proyecto en estado `ready` |
| Comparar Jira vs. PMO | Conteos, fechas, riesgos, WBS y excepciones reconciliados |
| Validar con PM/PMO | Aprobación humana de baseline y mappings |
| Migrar por lotes | Incorporación gradual de los demás proyectos `linked` |
| Cerrar deuda técnica | Resolver cinco errores TypeScript y aislar prueba UF externa |

No se deben modificar las fechas pendientes de Consalud Apigee `PCIAD4-11`, `PCIAD4-12` y `PCIAD4-13` hasta recibir evidencia explícita.

## 19. Checklist operativo

Antes de homologar, confirme que existe una clave Jira válida, que Admin/PMO está autenticado, que PM y Delivery son usuarios reales y que el Deal —si aplica— ya existe en `financial_data`.

Durante la homologación, complete diagnóstico, identidad y mappings; materialice las seis etapas; revise el baseline `draft`; apruébelo humanamente; ejecute la importación inicial; cargue documentos y actas reales; y revise faltantes/excepciones.

Después de la homologación, use “Sincronizar ahora” para validaciones controladas, revise el historial y permita que el job diario mantenga observaciones Jira. Nunca use el estado Jira como sustituto de cierre de etapa, baseline contractual o aceptación del cliente.

## Referencias

[1]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/docs/IMPLEMENTACION_HOMOLOGACION_JIRA_LOG.md "Bitácora de implementación H0–H7"
[2]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/server/jiraHomologation.ts "Contrato canónico de homologación"
[3]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/server/jiraOnboardingService.ts "Estados, mappings, corridas y excepciones"
[4]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/server/jiraPreflight.ts "Diagnóstico Jira de solo lectura"
[5]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/client/src/pages/admin/JiraSpaces.tsx "Asistente de Spaces Jira"
[6]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/server/jiraOnboardingMaterialization.ts "Materialización de seis etapas y evidencia"
[7]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/server/jiraBaselineProposal.ts "Baseline provisional y fechas separadas"
[8]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/server/jiraDomainImportRunner.ts "Importación canónica H6"
[9]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/server/jiraReconciliationRunner.ts "Conciliación manual y scheduled H7"
[10]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/server/jiraReconciliationSchedule.ts "Callback y batch diario H7"
[11]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/client/src/components/JiraHomologationStatusCard.tsx "Tarjeta de homologación y sincronización"
[12]: https://github.com/ediazl-dev/prodigio-pmov2/blob/4eb4480/drizzle/schema.ts "Esquema canónico de persistencia"
