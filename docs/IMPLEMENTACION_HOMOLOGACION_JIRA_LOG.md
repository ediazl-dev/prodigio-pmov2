# Bitácora de implementación — Homologación de proyectos Jira

**Producto:** Prodigio PMO  
**Inicio:** 29 de agosto de 2026  
**Base recuperable:** `0acbbef0`  
**Estrategia:** incrementos verticales H0–H8, con checkpoint y prueba focal por bloque.

## H0 — Salvaguarda y contrato de homologación

El Gate R0 confirmó que la rama `main`, la referencia publicada y el repositorio conectado compartían la base `f401d9b5`. El único cambio previo al checkpoint fue el backlog aprobado en `todo.md`. El checkpoint recuperable anterior al código funcional es `0acbbef0`.

Se incorporó un contrato ejecutable que fija los siguientes invariantes: exactamente seis etapas (`sow`, `jira`, `risks`, `planning`, `design`, `closure`); únicamente cuatro roles (`admin`, `pmo`, `pm`, `consulta`); avance contractual por cardinalidad de hitos aceptados; faltantes explícitos; prohibición de que Jira complete etapas PMO; y baseline derivado solo de Jira en estado provisional hasta aprobación humana.

También se extrajo a una función pura el comportamiento heredado de `createLinkedProject`. El sistema todavía conserva temporalmente el resultado visible anterior —cuatro etapas autocerradas y Avance activo—, pero ahora existe una prueba que lo caracteriza explícitamente para reemplazarlo de forma controlada en H4. El fixture `PILOT` contiene payloads sanitizados y no crea registros en base de datos.

| Validación | Resultado |
|---|---|
| `jiraHomologation.test.ts` | 9 de 9 pruebas aprobadas |
| `linkedProjects.test.ts` | 31 de 31 pruebas aprobadas |
| Persistencia productiva | Sin escrituras de prueba |
| Jira | Sin escrituras ni transiciones |
| TypeScript oficial | Mantiene cinco errores previos fuera de H0: cuatro de iteración/target en `jiraMilestoneSync.ts` y uno de `invitations.estadoSII` en `routers.ts` |

> H0 no declara TypeScript limpio. Los errores indicados ya pertenecían a la base y se tratarán como deuda independiente; ninguna prueba focal de homologación falla por ellos.

## H1 — Modelo de datos para onboarding y trazabilidad

Se agregó una capa de orquestación separada del modelo canónico mediante cuatro tablas: `jira_project_onboarding`, `jira_entity_mapping`, `jira_sync_log` y `jira_import_exception`. El modelo conserva snapshots de origen, versiones de mapeo, claves de idempotencia, dirección de sincronización, resultados por ejecución y excepciones resolubles sin crear una séptima etapa PMO.

La migración `0034_living_firelord.sql` fue revisada y aislada antes de ejecutarse. La generación inicial detectó ocho tablas financieras que ya existían en la base, pero que no figuraban en el snapshot previo de Drizzle; por ello, esas operaciones se excluyeron de la migración H1. La ejecución final solo creó las cuatro tablas nuevas y sus índices únicos.

| Validación | Resultado |
|---|---|
| Tablas H1 creadas | 4 de 4 |
| Índices únicos | `jiraProjectKey`, `mappingKey` y `runId` verificados |
| Operaciones destructivas | Ninguna |
| Pruebas focales H0–H1 | 42 de 42 aprobadas |
| Registros productivos creados | Ninguno; solo estructura |

## H1 — Servicios idempotentes y auditoría

Se implementó un servicio de onboarding independiente de tRPC y de Jira, con repositorio intercambiable. Sus claves naturales permiten reanudar un proyecto por `jiraProjectKey`, actualizar un mapeo por `mappingKey`, reutilizar una ejecución por `runId` y conciliar excepciones por dominio, elemento de origen y motivo.

El servicio restringe las transiciones a la secuencia `draft → preflight → mapping → reconciliation → ready`, admite recuperación explícita desde `failed` y valida los siete pasos del asistente. La auditoría es best-effort: un fallo del registro no interrumpe la operación principal. Las cascadas administrativas eliminan primero mapeos, excepciones y ejecuciones por `onboardingId`, evitando huérfanos aunque el proyecto todavía no haya sido materializado.

| Validación | Resultado |
|---|---|
| Pruebas de servicio | 6 de 6 aprobadas |
| Pruebas focales acumuladas | 48 de 48 aprobadas |
| Idempotencia cubierta | Proyecto, mapeo, ejecución y excepción |
| Escrituras Jira | Ninguna |
| TypeScript | Sin errores nuevos; persisten los cinco errores preexistentes documentados en H0 |

## H2 — Preflight Jira de solo lectura

Se implementó un analizador que diagnostica duplicidad, alineamiento PPDC, tableros, tipos de issue, estados, inventario y calidad de fechas. El resultado distingue bloqueos de advertencias: una configuración Jira no corporativa puede continuar a mapeo; un proyecto ya gestionado queda bloqueado. Los datos faltantes se exponen como brechas y nunca se completan con estimaciones.

El runner consulta en paralelo las APIs de lectura `getJiraProject`, `getProjectBoards`, `getProjectStatuses` y `getJiraAdvanceReport`. Persiste un snapshot estable, un fingerprint y una ejecución `dry_run`; si la fuente no cambia, reutiliza onboarding, corrida y excepciones. La interfaz de Administración reemplazó temporalmente la vinculación directa por el diagnóstico previo, impidiendo materializar proyectos hasta implementar identidad y mapeo en H3.

| Validación | Resultado |
|---|---|
| Pruebas puras de diagnóstico | 4 de 4 aprobadas |
| Pruebas del runner | 2 de 2 aprobadas |
| Pruebas focales acumuladas | 54 de 54 aprobadas |
| Escrituras en Jira | Ninguna |
| Materialización de proyecto PMO | Ninguna |
| Interfaz | Inventario, PPDC, fechas, bloqueos, advertencias y control `dry-run` visibles |
| Regresión TypeScript | Ningún error nuevo; continúan los cinco errores heredados registrados en H0 |

## H3 — Identidad PMO y mapeo Jira

El preflight conserva ahora el inventario individual de issues Jira —incluidos hitos, riesgos, épicas, historias y tareas— con responsable, estado, fechas y propuesta de destino PMO. El asistente utiliza ese snapshot para exigir una decisión explícita por issue: homologarlo a una entidad canónica o excluirlo justificadamente. La dirección inicial es Jira → PMO; cualquier futura escritura PMO → Jira requerirá una acción explícita.

La identidad se confirma exclusivamente con datos reales: nombre, cliente y tipo; PM y Delivery entre usuarios activos no-`consulta`; y un Deal existente en `financial_data`. La identidad y los mapeos se guardan antes de materializar el proyecto y pueden reanudarse. Al aprobar el mapeo, el onboarding avanza a `reconciliation`, listo para H4, sin crear cierres artificiales.

| Validación | Resultado |
|---|---|
| Pruebas focales acumuladas | 62 de 62 aprobadas |
| Identidad | Validada contra usuarios activos y Deals sincronizados |
| Mapeo | Una decisión obligatoria por issue, versión inicial auditada |
| Reanudación | Estado, identidad y mapeos recuperables por `jiraProjectKey` |
| Materialización PMO | Ninguna; se difiere a H4 |
| Escrituras Jira | Ninguna |
| Verificación visual | Asistente abierto en sesión autenticada mediante deep link administrativo; búsqueda Jira cargada, fondo claro y contraste legible |
| Regresión TypeScript | Ningún error nuevo; continúan los cinco errores heredados registrados en H0 |

La respuesta de preflight expone explícitamente `onboarding.status` y está cubierta por la prueba del runner consumida por la interfaz. La máquina pura del wizard agrega cuatro pruebas para bloqueo, reanudación, corrección manual de mapeos y exclusiones sin sincronización. No se completó un onboarding real solo para probar la interfaz, evitando crear un proyecto, asignar personas o asociar un Deal sin decisión de piloto.

## H4 — Reconstrucción auditable de las seis etapas

La materialización vinculada dejó de crear cuatro etapas artificialmente completadas. Todo nuevo proyecto proveniente del onboarding H2–H3 se crea con exactamente seis etapas: `sow` en progreso y las cinco restantes bloqueadas. El proyecto conserva `origin='linked'`, pero comparte el mismo pipeline canónico y las mismas transiciones secuenciales del alta nativa.

Se extendió el cierre formal existente con modo de cierre, onboarding, fuente, referencia, fecha de evidencia y metadatos de reconciliación. Una etapa solo puede homologarse si está en progreso, las anteriores están completadas, existe evidencia identificable y un usuario Admin/PMO confirma explícitamente la acción. Cerrar Jira no equivale a cerrar PMO ni a aceptación del cliente.

Los proyectos vinculados históricos no fueron reescritos. Su detalle identifica los estados completados heredados como `evidencia [PENDIENTE]` y permite que Admin/PMO seleccione cada brecha para conciliarla con evidencia real. La conciliación crea o completa el cierre formal, preserva el estado existente y no desbloquea etapas. La ejecución productiva por lotes continúa reservada para el piloto H8.

| Validación | Resultado |
|---|---|
| Pruebas focales acumuladas | 71 de 71 aprobadas; 2 persistentes opt-in aprobadas |
| Etapas por proyecto nuevo | Exactamente 6 |
| Autocierres al materializar | 0 |
| Cierre homologado | Secuencial, idempotente y con evidencia obligatoria |
| Reconciliación histórica | Evidencia obligatoria, estado preservado y cero desbloqueos |
| Prueba persistente | Materialización, 6 cierres, 5 desbloqueos, cierre final y limpieza completa |
| Proyectos productivos históricos | Sin cambios de estado ni cierres nuevos durante la validación |
| Limpieza de pruebas | 0 proyectos, 0 onboardings y 0 Spaces transitorios restantes |
| Verificación visual | Tanner muestra 4 brechas heredadas seleccionables y 0 etapas falsamente homologadas |
| Regresión TypeScript | Ningún error nuevo; continúan los cinco errores heredados registrados en H0 |

## H5 — Baseline provisional, hitos y sincronización inicial

Se eliminó el fallback que aprobaba automáticamente un baseline derivado de Jira. La importación inicial utiliza únicamente los issues aprobados como hitos en H3, crea o reutiliza una fuente `draft` y mantiene separados `baselineDate`, `jiraDueDate`, `jiraClosedDate` y la aceptación del cliente. Cuando Jira no aporta fecha, el baseline queda `[PENDIENTE]`; no se inventan pesos financieros y el avance contractual continúa calculándose por cardinalidad de hitos aceptados.

Admin, PMO o el PM asignado pueden crear la propuesta, editar sus fechas y aprobarla. La aprobación requiere que no existan fechas pendientes y una nota humana de al menos diez caracteres; una propuesta aprobada anteriormente pasa al estado válido `superseded`. Solo después de esta aprobación el onboarding transita idempotentemente a `ready`.

La ejecución `initial_import` reutiliza `runId` y fingerprint, persiste sus resultados en `jira_sync_log` y registra como excepciones resolubles los hitos Jira sin fecha. La sincronización observa estado, planificación y cierre Jira, pero no sobrescribe el baseline contractual ni crea aceptación del cliente.

| Validación | Resultado |
|---|---|
| Pruebas focales H5 finales | 16 de 16 aprobadas, incluidas 3 guardias contra autoaprobación |
| Regresión focal seleccionada H0–H5 | 54 de 54 aprobadas; pruebas persistentes opt-in omitidas por defecto |
| Prueba persistente H5 | 1 de 1 aprobada: draft, edición, aprobación, transición `ready`, reintento idempotente y limpieza |
| Auditoría de rutas productivas | Sin símbolos `createExecutiveBaselineWithMilestones`, `jira-auto-v1` ni aprobador `Sistema` |
| Dashboard Ejecutivo v2 | La lectura no crea ni aprueba fuentes; la propuesta y su aprobación son operaciones separadas |
| Índices de idempotencia | Versión por proyecto e issue Jira por fuente verificados |
| Roles de operación | Admin, PMO o PM asignado |
| Avance contractual | Cardinalidad de hitos aceptados; sin ponderación financiera |
| Datos transitorios restantes | 0 proyectos, 0 onboardings, 0 fuentes y 0 hitos H5, verificado por SQL |
| Servidor tras reinicio | Inicia correctamente; 0 errores de importación posteriores al reinicio H5 |
| Verificación visual | Tanner conserva su baseline humano aprobado; fechas contractuales y Jira permanecen separadas |
| Regresión TypeScript | Ningún error nuevo; continúan los cinco errores heredados registrados en H0 |

## H6 — Riesgos, WBS, documentos y asociación financiera

La importación inicial H6 consume exclusivamente el snapshot Jira persistido por H2/H3 y mappings con estado `approved`. Los transformadores puros solo aceptan destinos canónicos: `risk` para `risks`, y `epic`, `story` o `task` para `wbs_tasks`. Cada fila conserva su `jiraIssueKey`, estado, categoría de estado y responsable observados en Jira; cuando un atributo PMO obligatorio no existe en la fuente se utiliza `por_confirmar`, sin clasificar, ponderar ni completar por inferencia.

Los UPSERTs usan la clave natural proyecto + issue Jira. Un reintento actualiza únicamente los campos observables de origen y preserva clasificaciones PMO ya confirmadas, como categoría/probabilidad/impacto del riesgo, fase, story points y otros atributos gobernados en Prodigio. La jerarquía WBS solo se conserva cuando el `parentKey` real también está presente y aprobado; un padre faltante produce una excepción resoluble y nunca una relación inventada.

El runner `initial_import` exige proyecto materializado y onboarding `ready`, calcula una huella estable versionada, permite reintentar corridas fallidas y registra resultados y excepciones en `jira_sync_log` y `jira_import_exception`. La asociación financiera toma únicamente el `dealId` confirmado en la identidad H3, valida coincidencia exacta en `financial_data` y actualiza `projects.dealId`; si falta o no existe, conserva `[POR CONFIRMAR]`. H6 no ejecuta una sincronización financiera y no busca coincidencias por nombre.

La política documental mantiene SoW y Gantt en `linked_project_documents`, con bytes en S3 y metadatos en base de datos, mientras que las actas permanecen asociadas a su hito en `executive_milestone_acceptances`. La carga reutiliza el flujo existente y aplica UPSERT por proyecto + tipo + clave S3. Los mappings `document` y `stage_evidence` sin una referencia S3 real quedan como excepciones documentales auditables; no se crean archivos, URLs o evidencias ficticias y un cierre Jira no se interpreta como aceptación del cliente.

La API expone una ejecución H6 restringida a Admin/PMO y una consulta de estado para usuarios autorizados. La carga de documentos queda disponible para Admin/PMO y para el PM asignado al proyecto; `consulta` conserva acceso de solo lectura. El detalle de proyectos vinculados muestra Deal, riesgos/WBS importados versus mapeados, SoW/Gantt/actas reales, última corrida, faltantes y excepciones abiertas. El botón de importación se deshabilita de forma visible cuando el onboarding no está `ready`.

| Validación | Resultado |
|---|---|
| Batería cerrada H0–H6 | 76 de 76 pruebas aprobadas; 4 persistentes opt-in omitidas por defecto |
| Prueba persistente H6 | 1 de 1 aprobada: create/update sin duplicados, preservación PMO, Deal exacto, documento idempotente y limpieza |
| Limpieza SQL posterior | 0 proyectos, 0 Deals, 0 riesgos, 0 WBS y 0 documentos H6 transitorios |
| Suite completa | 579 pruebas aprobadas, 7 omitidas y 1 fallo externo ajeno a H6: Banco Central devolvió `Codigo=-5` en `ufService.test.ts` |
| TypeScript | Ningún error nuevo de H6; permanecen cuatro errores heredados de iteración/target en `jiraMilestoneSync.ts` y uno de `invitations.estadoSII` en `routers.ts` |
| Verificación visual | Tarjeta H6 revisada en escritorio y móvil sobre un proyecto vinculado real, sin ejecutar importación ni modificar datos productivos |
| Escrituras Jira | Ninguna; H6 solo consume snapshot y mappings persistidos |
| Sincronización financiera | Ninguna; solo validación exacta contra `financial_data` existente |

Los checkpoints incrementales de H6 fueron: `7aab40b5` (índices riesgos/WBS), `8be488da` (`projects.dealId`), `515ba597` (valores pendientes e idempotencia documental), `20ef1668` (observaciones Jira), `84e95acf` (transformadores puros), `a0f7f7bb` (persistencia, runner y Deal), `460330f0` (API, permisos y documentos) y `1efd14df` (interfaz y validación visual). No se ejecutaron migraciones destructivas ni importaciones masivas sobre proyectos productivos.

## Incidente 2026-09-01 — Preflight de proyecto Jira existente

El preflight de `PMOCCLSRPM` fallaba antes de finalizar el diagnóstico porque `jira_sync_log.runId` estaba definido como `varchar(64)`, mientras que el runner construía el identificador auditable `preflight:<clave Jira>:<SHA-256 completo>`. Para una clave de diez caracteres, el valor resultante mide 85 caracteres. La base rechazaba la inserción; no existía una corrida registrada, no se materializaba un proyecto PMO y no se efectuaban escrituras en Jira.

La corrección amplió `runId` a `varchar(191)` mediante la migración aditiva `0041_workable_brood.sql`, conservó el índice único y mantuvo el identificador completo, sin truncamiento. El servicio ahora normaliza el valor y emite un error explícito si está vacío o supera el contrato persistente. Durante la prueba contra la base real se detectó además un segundo bloqueo latente: el runner enviaba `domain: "project"` a `jira_import_exception`, pero el enum canónico no admite ese valor. Las observaciones de preflight se registran ahora bajo el dominio válido `jira`.

| Validación | Resultado |
|---|---|
| Contrato físico | `runId` en `varchar(191)`, `NOT NULL`, índice único conservado |
| Regresión `PMOCCLSRPM` | Identificador completo de 85 caracteres y reutilización idempotente |
| Pruebas focales | 25 aprobadas; 2 persistentes opt-in omitidas por defecto |
| Prueba persistente controlada | 2 de 2 aprobadas contra la base real |
| Preflight E2E controlado | Dos ejecuciones, una corrida `dry_run`, un onboarding en paso 2 y cero duplicados |
| Lecturas/escrituras Jira | Dependencias Jira simuladas; ninguna llamada ni modificación Jira |
| Limpieza SQL | 0 logs, 0 onboardings y 0 excepciones temporales restantes |
| Build de producción | Exitoso |
| TypeScript | Ningún error nuevo; permanecen los cinco errores heredados documentados |

El onboarding real de `PMOCCLSRPM` se mantuvo sin reintento ni alteración durante el diagnóstico. El usuario puede volver a ejecutar **Diagnosticar y preparar vínculo** después de publicada esta corrección.

## Cierre H7–H8 — 17 de septiembre de 2026

El piloto real `PMOCCLSRPM`, onboarding `180001` y proyecto PMO `2670001`, permanece `ready` en el paso 7. Conserva una fuente contractual aprobada, seis hitos con baseline completo, 19 riesgos, 31 tareas WBS, dos documentos y las seis etapas canónicas. La vista productiva muestra `ONBOARDING LISTO`, el botón **Sincronizar ahora**, separación entre baseline y plan Jira, historial de diez corridas y excepciones trazables.

La certificación final ampliada ejecutó 155 pruebas H0–H8 en 27 archivos: 155 aprobaron y siete pruebas opt-in permanecieron omitidas por diseño. La prueba persistente H7 sí se ejecutó y dejó cero proyectos, onboardings, corridas o mappings transitorios. Se agregó además una regresión de lote con cuatro proyectos `ready`: dos aplicados, uno parcial y uno con error aislado. El segundo disparo con la misma operación diaria reutilizó los tres resultados terminales y sólo reintentó el proyecto fallido, demostrando continuidad, reintento acotado y no duplicidad más allá del piloto único.

| Control H8 por lotes | Resultado |
|---|---|
| Elegibilidad | Sólo onboardings `ready` enumerados por el repositorio |
| Tamaño máximo | 50 proyectos por corrida; exceso reportado como diferido |
| Continuidad | Un error de proyecto no interrumpe los siguientes |
| Parciales | Se contabilizan por proyecto y mantienen resultados válidos |
| Reintento diario | `operationId` estable por fecha UTC |
| No duplicidad | Resultados terminales reutilizados por proyecto/onboarding |
| Seguridad | Callback autenticado y `taskUid` durable |
| Escrituras Jira | Ninguna; dirección Jira → PMO |

La ampliación productiva continúa siendo deliberadamente gradual: cada proyecto debe completar preflight, mapeo, aprobación humana y primera conciliación antes de entrar al lote diario. La evidencia operativa y rollback están en `docs/cierre-h7-h8-homologacion-jira-2026-09-17.md`.

El cierre técnico fue publicado en el checkpoint `9c3e5a7e`. Esa versión contiene la prueba multi-proyecto, el manual de cierre, la evidencia del piloto y el backlog H7–H8 validado.
