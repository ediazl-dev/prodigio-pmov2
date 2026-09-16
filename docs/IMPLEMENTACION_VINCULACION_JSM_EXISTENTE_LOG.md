# Bitácora de implementación — Vinculación de Spaces JSM existentes

**Inicio:** 16 de septiembre de 2026  
**Autor:** Manus AI  
**Proyecto:** Prodigio PMO Platform

## J0 — Contrato canónico y alcance operativo

**Estado:** completado.

La implementación seguirá una relación uno-a-uno entre un servicio recurrente y un Space JSM. La identidad se compone del `projectId` de Jira y el `serviceDeskId` de JSM; `projectKey` y `projectName` se conservarán como referencias operativas revalidables.

La primera versión permitirá descubrir, diagnosticar y vincular un Space JSM existente. La vinculación persistirá únicamente datos en PMO y no importará tickets, no creará issues, no modificará configuración del Space y no cerrará automáticamente la etapa `jira_setup`.

Los roles `admin` y `pmo` podrán vincular, revalidar o desvincular cuando se cumplan las reglas de integridad. Los roles `pm` y `consulta` tendrán acceso de lectura. Una desvinculación quedará bloqueada mientras existan actividades o facturaciones con `jiraIssueKey` asociado.

El preflight será de solo lectura y tendrá estados explícitos para candidato válido, vínculo idempotente, conflicto con otro servicio, proyecto no JSM, falta de acceso, incompatibilidad de issue types, identidad modificada y error técnico.

### Gate R0

| Control                         | Resultado                                           |
| ------------------------------- | --------------------------------------------------- |
| Base                            | `a04a993`                                           |
| Rama                            | `main`                                              |
| Alineamiento `user_github/main` | `0/0`, sin divergencia                              |
| Árbol antes de J0               | Solo `todo.md`, correspondiente al backlog aprobado |
| Escrituras Jira/JSM             | Ninguna                                             |
| Bloque actual                   | J0 exclusivamente                                   |

### Criterios de salida J0

| Criterio                          | Resultado                            |
| --------------------------------- | ------------------------------------ |
| Cardinalidad uno-a-uno            | Confirmada                           |
| Importación automática de tickets | Fuera de alcance                     |
| Cierre automático de JSM Setup    | Prohibido                            |
| Política de desvinculación        | Bloqueada con issues asociados       |
| Fuente de verdad externa          | API de Service Desks + proyecto Jira |
| Autorización para ejecutar J1–J7  | Recibida del usuario                 |

## Próximo bloque

J1 implementará exclusivamente el modelo de datos e integridad: origen del vínculo, snapshot de nombre, URLs diferenciadas, metadatos de verificación, mapeos de issue types y corridas de preflight. La migración será aditiva y se revisará antes de aplicarla.

## J1 — Modelo de datos e integridad

**Estado:** completado.

Se amplió `recurring_services` con origen del vínculo, nombre del proyecto, URL de agente separada del portal, salud, fecha de verificación, fecha de asociación y actor. Se conservaron los campos existentes `jsmProjectKey`, `jsmProjectId`, `jsmServiceDeskId` y `jsmPortalUrl` para mantener compatibilidad.

Se añadieron índices únicos para `jsmProjectKey`, `jsmProjectId` y `jsmServiceDeskId`. La auditoría previa confirmó que no existían duplicados no nulos, por lo que la migración se aplicó sin modificar registros existentes.

| Entidad                                     | Propósito                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `recurring_service_jsm_link_runs`           | Corridas idempotentes de preflight, vínculo, revalidación y desvinculación |
| `recurring_service_jsm_issue_type_mappings` | Mapeos separados para plan de trabajo y facturación                        |

El contrato compartido se centralizó en `shared/jsmExistingSpace.ts` para que esquema, servidor y cliente utilicen los mismos valores.

### Evidencia J1

| Control                   | Resultado                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| Migración                 | `0043_sudden_jetstream.sql`, revisada y aplicada                                               |
| Prueba unitaria           | 1 de 1 aprobada                                                                                |
| Prueba persistente opt-in | 1 de 1 aprobada                                                                                |
| Unicidad de identidad JSM | Validada para proyecto y Service Desk                                                          |
| Unicidad de corrida       | Validada por `runId` y fingerprint por servicio                                                |
| Unicidad de mapping       | Validada por servicio y categoría                                                              |
| Limpieza de fixtures      | 0 servicios, corridas y mapeos residuales                                                      |
| Build                     | Exitoso                                                                                        |
| TypeScript                | Sin errores nuevos; permanecen cinco deudas heredadas en `jiraMilestoneSync.ts` y `routers.ts` |
| Escrituras Jira/JSM       | Ninguna                                                                                        |

El único vínculo JSM previo conserva sus datos sin inferencias. La recuperación de `serviceDeskId`, nombre y URLs faltantes se realizará mediante los lectores J2 y una revalidación explícita; no se completarán campos por suposición.

## Próximo bloque J2

Implementar lectores paginados y de detalle para Service Desks, proyecto Jira subyacente, permisos e issue types. Todas las operaciones serán de lectura y tendrán pruebas que impidan llamadas de escritura.

## J2 — Lectores JSM y preflight de solo lectura

**Estado:** completado.

Se incorporaron lectores para listar todos los Service Desks accesibles con paginación, obtener un Service Desk por ID, validar el proyecto Jira subyacente, consultar permisos efectivos y recuperar los tipos de issue disponibles. También se separó la construcción de la URL de agente y la URL del portal de clientes.

El evaluador puro `inspectJsmExistingSpace` clasifica candidatos válidos, proyectos no JSM, Spaces archivados, cambios de identidad, falta de acceso, falta de permiso para crear issues, conflictos con otro servicio, vínculo idempotente y mappings de issue types obsoletos.

### Evidencia J2

| Control                      | Resultado                                                   |
| ---------------------------- | ----------------------------------------------------------- |
| Pruebas focales J1–J2        | 7 aprobadas; 1 persistente opt-in omitida en batería normal |
| Integración real read-only   | 1 de 1 aprobada contra el tenant configurado                |
| Paginación                   | Validada en más de una página simulada                      |
| Método HTTP del catálogo JSM | Solo `GET`, afirmado por prueba                             |
| Tipo de proyecto             | Validación explícita `service_desk`                         |
| Permisos                     | `BROWSE_PROJECTS` y `CREATE_ISSUES` consultados             |
| Issue types                  | Recuperados por `projectId`                                 |
| Build                        | Exitoso                                                     |
| TypeScript                   | Sin errores nuevos; permanecen cinco deudas heredadas       |
| Escrituras Jira/JSM          | Ninguna                                                     |

## Próximo bloque J3

Persistir corridas de preflight, exponer listado/diagnóstico por API, asociar de forma transaccional e idempotente, revalidar y auditar, manteniendo Jira/JSM en modo de solo lectura.

## J3 — API, persistencia y asociación local segura

**Estado:** completado.

Se implementó un orquestador de vínculo que combina el evaluador puro J2 con persistencia local. El preflight vuelve a leer JSM, construye un fingerprint SHA-256 estable sin incluir la hora de inspección, persiste o reutiliza una corrida y clasifica el resultado como `ready`, `blocked` o `error`. El mismo `operationId` no puede reutilizarse para otra acción, servicio o candidato.

La confirmación exige una corrida de preflight `ready`, revalida el Service Desk contra Jira/JSM y compara el fingerprint nuevo con el aprobado. Si la identidad o el diagnóstico cambian, la operación queda bloqueada como `STALE_PREFLIGHT`. Solo después de esa comprobación se actualiza `recurring_services` dentro de una transacción local. La transacción impide tanto que otro servicio posea la identidad candidata como que el servicio actual cambie directamente desde un Space ya vinculado hacia otro.

| Operación API                | Acceso               | Efecto                                                                 |
| ---------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `listExistingJsmSpaces`      | `protectedProcedure` | Lista y filtra Service Desks accesibles; muestra vínculo PMO si existe |
| `getExistingJsmLinkState`    | `protectedProcedure` | Devuelve vínculo, mappings activos e historial de corridas             |
| `preflightExistingJsmSpace`  | `adminOrPmo`         | Diagnóstico GET-only y corrida auditable                               |
| `linkExistingJsmSpace`       | `adminOrPmo`         | Revalidación y vínculo únicamente en PMO                               |
| `revalidateExistingJsmSpace` | `adminOrPmo`         | Actualiza salud y metadatos verificados                                |
| `unlinkExistingJsmSpace`     | `adminOrPmo`         | Desvincula solo si no hay `jiraIssueKey`; exige motivo                 |

Las operaciones registran acciones explícitas en `audit_logs`: `jsm_existing_preflight`, `jsm_existing_link`, `jsm_existing_revalidate` y `jsm_existing_unlink`. Los errores de dominio y de unicidad se convierten en respuestas `BAD_REQUEST` legibles; los errores desconocidos no se ocultan. La desvinculación deja los mappings en estado `superseded` y conserva en la corrida la identidad anterior para trazabilidad.

### Evidencia J3

| Control                       | Resultado                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Pruebas focales J2–J3         | 16 de 16 aprobadas                                                                             |
| Prueba persistente opt-in J3  | 1 de 1 aprobada contra la base real                                                            |
| Limpieza de fixtures          | 0 servicios, corridas, mappings, actividades y facturaciones residuales                        |
| Idempotencia                  | Validada por fingerprint y `operationId`; colisiones incompatibles rechazadas                  |
| Cardinalidad                  | Bloqueo de identidad ocupada y de segundo Space sobre el mismo servicio                        |
| Desvinculación                | Bloqueada con `jiraIssueKey` en plan de trabajo o facturación; permitida sin asociaciones      |
| Métodos Jira/JSM de escritura | Ninguno invocado por J3                                                                        |
| Cierre de `jira_setup`        | No se ejecuta ni se modifica                                                                   |
| Build                         | Exitoso                                                                                        |
| TypeScript                    | Sin errores nuevos; permanecen cinco deudas heredadas en `jiraMilestoneSync.ts` y `routers.ts` |

## Próximo bloque J4

Configurar mappings explícitos para `work_plan` y `billing`, sustituir la dependencia fija de `Task`, incorporar un dry-run de sincronización, impedir asociaciones por título y alinear la regla de cierre de `jira_setup` entre servidor e interfaz. J4 seguirá siendo una acción separada del vínculo y será el primer bloque autorizado para crear issues únicamente mediante confirmación explícita.

## J4 — Mappings explícitos, dry-run y sincronización confirmada

**Estado:** completado.

Se incorporó un contrato de sincronización independiente del vínculo. Cada servicio configura exactamente dos mappings activos, `work_plan` y `billing`, seleccionando únicamente tipos no-subtask disponibles en el proyecto Jira real. Los nombres se resuelven desde Jira; la API no acepta nombres suministrados por el cliente ni aplica el fallback histórico a `Task`.

El dry-run construye un plan determinista con fingerprint SHA-256 sobre identidad JSM, mappings, elementos locales y asociaciones vigentes. Clasifica cada elemento como `create`, `already_linked` o `blocked`. La búsqueda de duplicados usa una etiqueta técnica estable (`pmo-rs-{serviceId}-{category}-{entityId}`), nunca título. Si encuentra un issue existente, no lo enlaza automáticamente: bloquea ese elemento y exige asociación explícita por clave validando proyecto y tipo.

| Operación API                | Acceso               | Efecto                                                                            |
| ---------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `getJsmSyncConfiguration`    | `protectedProcedure` | Lee proyecto, issue types, mappings, historial y readiness                        |
| `saveJsmIssueTypeMappings`   | `adminOrPmo`         | Valida los tipos contra Jira y reemplaza mappings activos                         |
| `dryRunJsmSync`              | `adminOrPmo`         | Ejecuta solo lecturas Jira/JSM y persiste el plan local                           |
| `confirmJsmSync`             | `adminOrPmo`         | Recalcula fingerprint, toma la corrida una sola vez y recién entonces crea issues |
| `associateExistingJiraIssue` | `adminOrPmo`         | Vincula por clave tras validar proyecto, tipo y unicidad local                    |

La confirmación rechaza dry-runs bloqueados, obsoletos o ya tomados. Una toma atómica evita ejecuciones concurrentes; la unicidad `(serviceId, fingerprint)` deduplica planes equivalentes. Cada issue creado incluye las etiquetas `pmo-recurring`, `pmo-service-{serviceId}` y el identificador externo técnico. Los resultados se guardan como `applied` o `partial`, de modo que un fallo individual no oculta el resultado del resto.

Las rutas heredadas `syncJsmTasks` y `resyncJsmTasks` quedaron bloqueadas con un mensaje de migración para impedir que clientes antiguos omitan el dry-run. La regla de cierre `jira_setup` ahora es común para backend e interfaz: exige Space o URL cliente, mappings de las categorías aplicables y `jiraIssueKey` para todas las actividades y mensualidades de facturación. No existe cierre automático.

La pantalla JSM Setup permite seleccionar tipos reales, guardar mappings, ejecutar el dry-run, revisar totales/bloqueos y confirmar por separado. También muestra estados de carga con texto y errores recuperables. El flujo de creación de un Space ahora persiste `jsmLinkSource=created`, projectId, serviceDeskId cuando está disponible, URLs separadas, salud, fecha y actor del vínculo; si la lectura posterior a la creación no encuentra todavía el Service Desk, conserva el proyecto con salud `warning` para revalidación, sin repetir el POST.

### Evidencia J4

| Control                       | Resultado                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Pruebas focales J2–J4         | 25 de 25 aprobadas                                                                             |
| Prueba persistente opt-in J4  | 1 de 1 aprobada contra la base real                                                            |
| Integración real read-only J4 | 1 de 1 aprobada sobre el servicio 2100001                                                      |
| Limpieza de fixtures          | 0 servicios, corridas, mappings, actividades y facturaciones residuales                        |
| Dry-run                       | Cero llamadas a creación de issues antes de confirmar                                          |
| Idempotencia                  | Fingerprint único, `operationId` protegido y toma atómica de corrida                           |
| Asociación                    | Solo por `jiraIssueKey`, con validación de proyecto/tipo y unicidad global local               |
| Cierre                        | Incluye plan de trabajo, facturación y mappings aplicables                                     |
| Migración                     | `0044_woozy_korvac.sql` aplicada; solo agrega `recurring_service_jsm_sync_runs` e índices      |
| Build                         | Exitoso                                                                                        |
| TypeScript                    | Sin errores nuevos; permanecen cinco deudas heredadas en `jiraMilestoneSync.ts` y `routers.ts` |

## Próximo bloque J5

Construir en JSM Setup la elección explícita **Crear nuevo Space** o **Vincular Space existente**, con búsqueda, preflight visible, confirmación informada, estado de vínculo, revalidación y desvinculación controlada. J5 reutilizará las APIs J3/J4 y no ampliará permisos ni modificará las reglas de seguridad ya publicadas.

## J5 — Flujo Crear o Vincular en JSM Setup

**Estado:** completado.

La etapa JSM Setup ahora presenta una decisión explícita entre **Crear nuevo Space** y **Vincular Space existente**. Seleccionar una alternativa no ejecuta cambios. La creación conserva su diálogo confirmado y advierte que sí realizará una escritura; el vínculo existente utiliza exclusivamente las operaciones GET-only de descubrimiento y preflight publicadas en J3.

El modo de vínculo incorpora búsqueda por nombre, project key, Project ID o Service Desk ID, con estados diferenciados de carga, vacío y error recuperable. Cada resultado identifica el Service Desk y muestra si ya pertenece a otro servicio recurrente. Seleccionar un candidato invalida cualquier diagnóstico anterior y exige ejecutar un preflight nuevo.

El resultado del preflight expone estado, permisos Browse/Create, tipo de proyecto, número de issue types, bloqueos y advertencias. La confirmación solo queda habilitada para Admin/PMO cuando existe una corrida linkable. Antes de persistir, el backend vuelve a inspeccionar Jira/JSM y rechaza un diagnóstico obsoleto. La confirmación únicamente vincula metadatos en PMO: no importa tickets, no crea issues y no cierra `jira_setup`.

Cuando existe un vínculo, la pantalla muestra origen, salud, project key, Project ID, Service Desk ID, fecha de verificación y accesos separados a vista de agentes y portal de clientes. Los registros heredados sin origen se identifican expresamente y, si falta Service Desk ID, la interfaz explica por qué no pueden revalidarse todavía.

Admin y PMO pueden revalidar o solicitar la desvinculación. Esta última exige un motivo de al menos diez caracteres y advierte que cualquier `jiraIssueKey` asociado bloqueará la operación. PM y consulta reciben la misma información en modo de solo lectura, sin controles de mutación.

### Evidencia J5

| Control | Resultado |
|---|---|
| Pruebas focales J2–J5 | 29 de 29 aprobadas |
| Permisos de interfaz | Admin/PMO modifican; PM/consulta solo lectura |
| Confirmación | Deshabilitada sin permiso, corrida, resultado linkable o durante una operación pendiente |
| Build de producción | Exitoso |
| Revisión visual | Aprobada en servicio vinculado heredado 2100001 y servicio sin vínculo 2070001 |
| Consola y red | Sin errores nuevos; consulta de estado JSM respondió HTTP 200 |
| TypeScript | Sin errores nuevos; permanecen cinco deudas heredadas en `jiraMilestoneSync.ts` y `routers.ts` |
| Escrituras Jira/JSM de validación | Ninguna |

## Próximo bloque J6

Crear **Administración > Spaces JSM** como inventario operativo con filtros, vínculo visible, origen, salud, trazabilidad y acceso al servicio relacionado. Las acciones de modificación seguirán restringidas a Admin/PMO y reutilizarán las APIs controladas ya publicadas.

## J6 — Inventario administrativo de Spaces JSM

**Estado:** completado.

Se incorporó la ruta **Administración > Spaces JSM** al menú lateral. Admin, PMO, PM y consulta pueden revisar el inventario; únicamente Admin/PMO reciben acciones de revalidación. La página reutiliza el catálogo GET-only y no crea, modifica, archiva ni sincroniza elementos en Jira/JSM.

El inventario cruza los Service Desks visibles en Jira con los metadatos persistidos en PMO. Para cada Space muestra nombre, project key, Project ID, Service Desk ID, estado de vínculo, servicio recurrente asociado, cliente, etapa, origen, salud, fecha de vínculo y última verificación. Los vínculos históricos sin `jsmLinkSource` se identifican como **Vínculo heredado** en vez de inferir un origen inexistente.

| Filtro o indicador | Comportamiento |
|---|---|
| Búsqueda | Nombre, key, IDs, servicio o cliente |
| Estado de vínculo | Todos, vinculados o disponibles |
| Condición | Saludable, advertencia, bloqueado o pendiente |
| Origen | Creado por PMO, vinculado existente o heredado |
| KPIs | Total, vinculados, disponibles, saludables y requieren atención |

La API aplica filtros y paginación en servidor y devuelve contadores del universo consultado. La interfaz incluye actualización manual, estados de carga, error con reintento, vacío filtrado, paginación, enlaces separados a vista de agentes y portal de clientes, acceso al servicio relacionado y botón **Revalidar** solo cuando corresponde.

### Evidencia J6

| Control | Resultado |
|---|---|
| Pruebas focales J2–J6 | 30 de 30 aprobadas |
| Catálogo real GET-only | 15 Service Desks; HTTP 200 en 2,6–2,7 segundos |
| Filtros y métricas | Validados con catálogo simulado y datos reales |
| Permisos | Lectura para los cuatro roles; acción solo Admin/PMO |
| Vista escritorio | Validada con datos reales y 15 tarjetas |
| Vista móvil | Validada a 390 × 844 px con filtros apilados y tarjetas legibles |
| Consola/servidor | Sin errores nuevos durante navegación y carga |
| Build de producción | Exitoso |
| TypeScript | Sin errores nuevos; permanecen cinco deudas heredadas en `jiraMilestoneSync.ts` y `routers.ts` |
| Escrituras Jira/JSM | Ninguna |

## Próximo bloque J7

Ejecutar la validación integral de J0–J6, consolidar documentación y manual operativo, verificar reglas no negociables, revisar el flujo completo con datos controlados y publicar la versión final sin asociar ningún Space productivo durante las pruebas.
