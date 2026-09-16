# Backlog de implementación: vinculación de Spaces JSM existentes

**Fecha:** 16 de septiembre de 2026  
**Autor:** Manus AI  
**Producto:** Prodigio PMO Platform  
**Módulo:** Servicios Recurrentes — etapa JSM Setup

## 1. Resumen ejecutivo

El requerimiento es viable y debe implementarse como una ampliación de la etapa **JSM Setup**. El usuario podrá elegir entre **crear un nuevo Space JSM** o **vincular un Space JSM existente** al servicio recurrente. La asociación se hará dentro del contexto del servicio, mientras que una vista administrativa complementaria permitirá consultar el inventario de Spaces JSM y sus vínculos.

La solución reutilizará el patrón de diagnóstico y confirmación de **Administración > Spaces Jira**, pero no debe reutilizar sin cambios su onboarding de seis etapas. Un Space JSM existente necesita un contrato propio: identidad dual de proyecto Jira y Service Desk, permisos de la cuenta técnica, compatibilidad con los tipos de issue usados por Servicios Recurrentes, unicidad del vínculo y protección frente a duplicados.

> **Recomendación funcional:** implementar un vínculo uno-a-uno entre servicio recurrente y Space JSM. La vinculación será local y de solo lectura respecto de Jira/JSM; no importará tickets, no creará issues y no cerrará la etapa automáticamente.

## 2. Situación actual

La etapa JSM Setup ya permite seleccionar la plataforma `prodigio` o `cliente`. Para `prodigio`, únicamente ofrece **Crear Proyecto en JIRA**. La mutación `createJsmProject` crea un proyecto `service_desk` y, si Jira responde exitosamente, guarda `jsmProjectKey`, `jsmProjectId` y `jsmPortalUrl` en `recurring_services`.

El modelo ya posee `jsmServiceDeskId`, pero el flujo actual de creación no lo completa. La base no tiene índices únicos para `jsmProjectKey`, `jsmProjectId` o `jsmServiceDeskId`. Además, la URL almacenada como `jsmPortalUrl` corresponde hoy a la vista de agente `/jira/servicedesk/projects/{key}/boards`, no al portal de clientes.

La sincronización posterior crea actividades y facturación como issues de tipo `Task`. Por ello, un Space JSM existente no puede considerarse compatible solo por ser `service_desk`: el preflight también debe comprobar permisos y disponibilidad de un tipo de issue configurable para cada categoría.

| Capacidad | Estado actual | Brecha |
|---|---|---|
| Crear un JSM nuevo | Disponible | Falta preflight de identidad e idempotencia |
| Vincular un JSM existente | No disponible | Requiere descubrimiento, diagnóstico y confirmación |
| Identidad de proyecto Jira | Parcial | Se guardan clave e ID, sin snapshot de nombre ni verificación |
| Identidad de Service Desk | Campo disponible | `jsmServiceDeskId` no se completa en el flujo actual |
| Unicidad local | No garantizada | Solo existe la clave primaria de `recurring_services` |
| Compatibilidad de issue types | No validada | La sincronización asume que existe `Task` |
| Auditoría de vínculo | Solo creación exitosa | Faltan preflight, vínculo, fallo, revalidación y desvinculación |
| Cierre de JSM Setup | Validación parcial | La UI exige todo sincronizado, pero el servidor solo exige al menos una actividad sincronizada y omite facturación |

## 3. Arquitectura objetivo

Atlassian expone los Service Desks accesibles mediante `GET /rest/servicedeskapi/servicedesk`; la respuesta es paginada e incluye `id`, `projectId`, `projectName` y `projectKey`.[1] El proyecto Jira subyacente debe validarse como `projectTypeKey = service_desk` mediante la API de proyectos.[2]

La relación canónica será:

| Entidad | Identificador canónico | Uso |
|---|---|---|
| Servicio recurrente PMO | `recurring_services.id` | Propietario local del vínculo |
| Proyecto Jira | `projectId` | Identidad estable del proyecto subyacente |
| Space Jira visible | `projectKey` y `projectName` | Referencia operativa y snapshot legible |
| Service Desk JSM | `serviceDeskId` | Identidad específica de Jira Service Management |

Los IDs serán canónicos; nombre y clave se tratarán como snapshots revalidables. La API JSM solo devuelve los Service Desks visibles para la identidad autenticada, por lo que un Space ausente puede significar falta de permisos y no inexistencia.[1] [3]

## 4. Flujo funcional recomendado

| Paso | Experiencia de usuario | Escritura externa |
|---|---|---|
| 1 | En JSM Setup, elegir **Plataforma Prodigio (JSM)** | Ninguna |
| 2 | Elegir **Crear nuevo Space** o **Vincular Space existente** | Ninguna |
| 3 | Buscar por nombre o clave entre Service Desks accesibles | Ninguna |
| 4 | Seleccionar un resultado y ejecutar diagnóstico | Ninguna |
| 5 | Revisar identidad, permisos, issue types, conflictos y advertencias | Ninguna |
| 6 | Confirmar explícitamente la asociación | Solo persistencia en PMO |
| 7 | Revisar el resumen del vínculo y ejecutar una simulación de sincronización | Ninguna |
| 8 | Sincronizar o mapear issues mediante una acción separada | Escritura Jira explícita |
| 9 | Cerrar manualmente JSM Setup cuando todos los elementos estén vinculados o sincronizados | Persistencia PMO |

La asociación nunca debe crear issues, importar tickets, cambiar permisos, modificar configuraciones del Service Desk ni cerrar la etapa automáticamente.

## 5. Reglas de negocio

| Regla | Definición |
|---|---|
| RN-01 | Solo `admin` y `pmo` pueden vincular, cambiar o desvincular un Space JSM |
| RN-02 | `pm` y `consulta` pueden visualizar la asociación y su estado, pero no modificarla |
| RN-03 | El flujo aplica inicialmente solo a `jsmPlatform = prodigio`, es decir, al tenant configurado en `JIRA_BASE_URL` |
| RN-04 | El candidato debe existir simultáneamente como proyecto Jira y Service Desk JSM accesible |
| RN-05 | El proyecto debe declarar `projectTypeKey = service_desk`; un proyecto `business` o `software` queda bloqueado |
| RN-06 | Un servicio recurrente puede tener como máximo un vínculo JSM activo |
| RN-07 | Un `projectId` o `serviceDeskId` no puede vincularse a más de un servicio recurrente |
| RN-08 | Repetir la confirmación del mismo vínculo debe devolver éxito idempotente, no crear duplicados |
| RN-09 | La confirmación debe revalidar el candidato; no puede confiar únicamente en el resultado previo de la interfaz |
| RN-10 | El vínculo no sincroniza ni importa issues automáticamente |
| RN-11 | Los issues existentes solo podrán asociarse por clave mediante un flujo explícito; nunca por coincidencia de título |
| RN-12 | La primera sincronización debe ejecutar un dry-run y verificar el issue type configurado |
| RN-13 | La desvinculación se bloquea si existen actividades o facturaciones con `jiraIssueKey`, salvo un procedimiento administrativo posterior con evidencia |
| RN-14 | El cierre de JSM Setup seguirá siendo manual y exigirá que todos los elementos aplicables estén sincronizados o vinculados, incluyendo facturación |
| RN-15 | No se modificará ni se intentará convertir el Space JSM seleccionado |

## 6. Estados del preflight

| Estado | Significado | Resultado |
|---|---|---|
| `ready` | Service Desk accesible, tipo válido, sin conflicto local y con configuración compatible | Habilita confirmación |
| `already_linked_same_service` | El mismo vínculo ya pertenece al servicio actual | Éxito idempotente; no vuelve a escribir |
| `linked_to_other_service` | El proyecto o Service Desk ya está asociado a otro servicio | Bloqueo |
| `not_service_desk` | La clave corresponde a un proyecto Jira no JSM | Bloqueo |
| `service_desk_not_accessible` | El proyecto existe, pero la cuenta técnica no ve el Service Desk | Bloqueo con instrucción de permisos |
| `missing_create_issue_permission` | La cuenta puede ver el Space, pero no crear los issues requeridos | Bloqueo para sincronización |
| `missing_issue_type_mapping` | No existe o no se seleccionó un tipo compatible para actividades/facturación | Requiere mapeo |
| `archived_or_inactive` | El proyecto no admite operación normal | Bloqueo |
| `identity_changed` | La identidad cambió desde el preflight | Exige repetir diagnóstico |
| `error` | Jira o PMO no pudieron completar la lectura | No habilita confirmación |

## 7. Backlog de implementación

### Fase J0 — Contrato canónico y decisiones

| ID | Prioridad | Tarea | Evidencia de término |
|---|---|---|---|
| J0-01 | P0 | Documentar la relación `servicio recurrente ↔ proyecto Jira ↔ Service Desk JSM` | Contrato aprobado con IDs canónicos |
| J0-02 | P0 | Confirmar cardinalidad uno-a-uno para la primera versión | Regla registrada y validada |
| J0-03 | P0 | Confirmar que el vínculo inicial no importará tickets existentes | Alcance y fuera de alcance registrados |
| J0-04 | P0 | Definir catálogo de estados de preflight y errores accionables | Contrato TypeScript/Zod revisado |
| J0-05 | P0 | Definir política de desvinculación y re-vinculación | Casos permitidos y bloqueados documentados |

**Checkpoint J0:** diseño aprobado, sin cambios funcionales ni escrituras Jira.

### Fase J1 — Modelo de datos e integridad

| ID | Prioridad | Tarea | Evidencia de término |
|---|---|---|---|
| J1-01 | P0 | Completar en `recurring_services` el origen del vínculo: `created` o `linked` | Migración aditiva aplicada |
| J1-02 | P0 | Añadir snapshot del nombre del proyecto y fecha/usuario de vinculación | Campos disponibles y tipados |
| J1-03 | P0 | Separar URL de agente/proyecto y URL de portal cliente | URLs no ambiguas y navegación correcta |
| J1-04 | P0 | Añadir índices únicos para `jsmProjectId` y `jsmServiceDeskId`, permitiendo múltiples `NULL` | Duplicados preexistentes validados; índices activos |
| J1-05 | P1 | Añadir `jsmLastVerifiedAt` y estado de salud del vínculo | Revalidación observable |
| J1-06 | P0 | Crear una entidad liviana de corridas de preflight con `operationId` único, snapshot, fingerprint, actor y resultado | Trazabilidad reanudable e idempotente |
| J1-07 | P0 | Auditar y completar `jsmServiceDeskId` en vínculos creados previamente, sin inferir si Jira no confirma identidad | Backfill controlado y reporte de pendientes |

**Checkpoint J1:** esquema y migración aplicados después de revisar SQL; cero modificaciones en Jira/JSM.

### Fase J2 — Cliente Jira/JSM de solo lectura

| ID | Prioridad | Tarea | Evidencia de término |
|---|---|---|---|
| J2-01 | P0 | Implementar `listJsmServiceDesks` sobre `/rest/servicedeskapi/servicedesk` con paginación completa | Todos los Service Desks accesibles retornados una vez |
| J2-02 | P0 | Implementar `getJsmServiceDesk(serviceDeskId)` | Detalle e identidad obtenidos |
| J2-03 | P0 | Reutilizar el lector de proyecto Jira para validar `projectId`, clave, nombre y `projectTypeKey` | Proyecto confirmado como `service_desk` |
| J2-04 | P0 | Consultar permisos efectivos del usuario técnico para visualizar y crear issues | Diagnóstico distingue acceso de capacidad operativa |
| J2-05 | P0 | Obtener issue types disponibles del proyecto | Catálogo listo para mapeo |
| J2-06 | P1 | Normalizar errores `401`, `403`, `404`, timeout y rate limit | Mensajes internos tipados y sanitizados |
| J2-07 | P0 | Probar que todos los métodos de preflight usan únicamente `GET` | Cero escrituras externas en pruebas |

Atlassian pagina las colecciones JSM con `start`, `limit`, `size` e `isLastPage`; el cliente debe recorrerlas y no asumir una única página.[3]

**Checkpoint J2:** lectores JSM probados; sin cambios en servicios ni en Jira.

### Fase J3 — Servicio de preflight y asociación

| ID | Prioridad | Tarea | Evidencia de término |
|---|---|---|---|
| J3-01 | P0 | Crear un servicio puro que evalúe identidad, tipo, acceso, conflicto y compatibilidad | Resultado determinista para el mismo snapshot |
| J3-02 | P0 | Generar fingerprint del candidato y `operationId` acotado | Reintentos seguros y trazables |
| J3-03 | P0 | Implementar `listExistingJsmSpaces` con búsqueda por clave/nombre y paginación | Selector consume solo Service Desks accesibles |
| J3-04 | P0 | Implementar `preflightExistingJsmSpace` | Diagnóstico persistido sin escritura Jira |
| J3-05 | P0 | Implementar `linkExistingJsmSpace` con revalidación servidor y transacción local | Asociación atómica e idempotente |
| J3-06 | P0 | Rechazar vínculos ocupados por otro servicio | Integridad protegida |
| J3-07 | P0 | Registrar auditoría de preflight, confirmación, éxito y fallo | Historial completo por servicio y actor |
| J3-08 | P1 | Implementar `revalidateJsmLink` | Cambios de nombre, clave, acceso o estado visibles |
| J3-09 | P1 | Implementar desvinculación solo cuando no existan issues PMO asociados | Operación segura, con motivo obligatorio y auditoría |

**Checkpoint J3:** API de asociación validada con Jira simulado y base aislada.

### Fase J4 — Mapeo de tipos y sincronización segura

| ID | Prioridad | Tarea | Evidencia de término |
|---|---|---|---|
| J4-01 | P0 | Sustituir la dependencia fija de `issueTypeName = Task` por IDs configurados | Compatible con JSM existentes y localizados |
| J4-02 | P0 | Permitir elegir issue type para actividades y facturación | Dos mappings explícitos y persistidos |
| J4-03 | P0 | Implementar dry-run de sincronización | Cantidades a crear, omitir, bloquear o mapear visibles |
| J4-04 | P0 | Añadir identidad externa estable por elemento PMO | Reintentos no duplican issues |
| J4-05 | P0 | Mantener `jiraIssueKey` como vínculo explícito y no autoasociar por título | Cero falsos positivos |
| J4-06 | P1 | Permitir mapear manualmente una actividad/facturación a un issue existente mediante clave validada | Adopción controlada de issues previos |
| J4-07 | P0 | Corregir la regla servidor de cierre para exigir todos los elementos aplicables, incluida facturación | UI y backend aplican la misma regla |

**Checkpoint J4:** sincronización reintentable y cierre consistente, sin duplicados.

### Fase J5 — Experiencia en JSM Setup

| ID | Prioridad | Tarea | Evidencia de término |
|---|---|---|---|
| J5-01 | P0 | Presentar dos acciones: **Crear nuevo Space JSM** y **Vincular Space JSM existente** | Alternativas claramente diferenciadas |
| J5-02 | P0 | Construir selector con búsqueda, paginación, carga, vacío y error | Navegación usable con catálogos grandes |
| J5-03 | P0 | Mostrar tarjeta del candidato con nombre, clave, IDs, acceso, issue types y estado de vínculo | Identidad verificable antes de confirmar |
| J5-04 | P0 | Mostrar diagnóstico por controles: identidad, tipo, acceso, unicidad y compatibilidad | Bloqueos y advertencias comprensibles |
| J5-05 | P0 | Exigir confirmación explícita antes de vincular | Sin asociación accidental |
| J5-06 | P0 | Mostrar resumen persistente del vínculo y origen `Vinculado existente` | Estado visible tras recargar |
| J5-07 | P1 | Incorporar revalidación y desvinculación controlada según permisos | Operación mantenible |
| J5-08 | P0 | Mantener el cierre manual de JSM Setup | Sin autocierre |
| J5-09 | P0 | Validar diseño en escritorio y móvil, contraste, teclado y estados de foco | Revisión visual aprobada |

**Checkpoint J5:** flujo completo disponible dentro del servicio recurrente.

### Fase J6 — Administración > Spaces JSM

| ID | Prioridad | Tarea | Evidencia de término |
|---|---|---|---|
| J6-01 | P1 | Crear la ruta `/admin/jsm-spaces` reutilizando el lenguaje visual de Spaces Jira | Vista accesible desde Administración |
| J6-02 | P1 | Listar Service Desks accesibles con estado `vinculado`, `disponible`, `requiere atención` o `sin acceso` | Inventario operativo |
| J6-03 | P1 | Mostrar servicio recurrente asociado, cliente, origen del vínculo y última verificación | Trazabilidad contextual |
| J6-04 | P1 | Incorporar filtros por estado, cliente, clave y nombre | Búsqueda eficiente |
| J6-05 | P1 | Permitir iniciar la vinculación solo después de seleccionar un servicio recurrente elegible | No se crean vínculos huérfanos |
| J6-06 | P1 | Restringir las acciones a `admin` y `pmo` | RBAC consistente |

**Checkpoint J6:** inventario administrativo operativo sin duplicar la lógica de negocio del backend.

### Fase J7 — Pruebas, migración y salida controlada

| ID | Prioridad | Tarea | Evidencia de término |
|---|---|---|---|
| J7-01 | P0 | Probar paginación JSM, respuestas vacías y errores de permisos | Cobertura de descubrimiento |
| J7-02 | P0 | Probar proyecto `business`, JSM inaccesible, candidato ocupado y candidato válido | Matriz de preflight cubierta |
| J7-03 | P0 | Probar reintento del mismo vínculo y concurrencia | Una sola asociación local |
| J7-04 | P0 | Probar que preflight y vínculo no llaman endpoints Jira de escritura | Garantía observacional |
| J7-05 | P0 | Probar mapeo de issue types y dry-run | Sin dependencia fija de `Task` |
| J7-06 | P0 | Probar desvinculación bloqueada cuando existen issues asociados | Protección de integridad |
| J7-07 | P0 | Ejecutar prueba persistente opt-in con fixture aislado y limpieza en `finally` | Cero residuos en base |
| J7-08 | P0 | Ejecutar Vitest focal, `pnpm check`, build y revisión visual | Sin regresiones nuevas |
| J7-09 | P0 | Publicar manual de uso y operación | Flujo documentado para Admin/PMO |

**Checkpoint J7:** versión publicada y lista para una vinculación piloto autorizada.

## 8. Matriz mínima de pruebas de aceptación

| Escenario | Resultado esperado |
|---|---|
| Space JSM accesible y libre | Preflight `ready`; confirmación persiste IDs y URLs |
| Mismo Space y mismo servicio | Resultado idempotente; no duplica corrida ni vínculo |
| Space vinculado a otro servicio | Bloqueo con identificación del servicio propietario |
| Clave de proyecto `business` | Bloqueo `not_service_desk` |
| Proyecto JSM no visible en Service Desk API | Bloqueo por acceso, no por inexistencia |
| Issue type `Task` ausente | Solicita mapping; no sincroniza |
| Cambio entre preflight y confirmación | Bloqueo por fingerprint obsoleto |
| PM intenta vincular | Acción denegada; visualización permitida |
| Vínculo exitoso | No crea ni importa issues y no cierra la etapa |
| Todos los elementos sincronizados o mapeados | Cierre manual habilitado |
| Existe al menos un elemento pendiente | Cierre bloqueado en UI y servidor |

## 9. Archivos previstos

| Área | Archivos principales |
|---|---|
| Esquema | `drizzle/schema.ts`, nueva migración y metadatos Drizzle |
| Integración Jira/JSM | `server/jiraClient.ts`, nuevo servicio `server/jsmExistingSpaceService.ts` |
| Persistencia | `server/recurringServicesDb.ts` y helpers específicos de vínculo |
| API | `server/recurringServicesRouter.ts` |
| JSM Setup | `client/src/pages/recurring/RSJsmSetupStage.tsx` y componentes reutilizables |
| Administración | `client/src/pages/admin/JsmSpaces.tsx`, `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx` |
| Pruebas | Specs unitarios, de router, persistencia opt-in y UI focal |
| Documentación | Manual de usuario y bitácora técnica del módulo recurrente |

## 10. Dependencias y riesgos

| Riesgo | Tratamiento |
|---|---|
| La cuenta técnica no ve todos los Service Desks | Mostrar `sin acceso` cuando el proyecto sea conocido y documentar el permiso requerido |
| Un JSM existente usa issue types distintos | Mapeo obligatorio por ID antes de sincronizar |
| Duplicación de issues al adoptar un JSM operativo | No importar ni emparejar por título; dry-run y vínculo explícito por clave |
| Dos servicios intentan usar el mismo JSM | Índices únicos y validación transaccional |
| URLs ambiguas entre agente y portal | Persistir URLs separadas y derivarlas desde IDs confirmados |
| Diferencia entre validación UI y servidor | Servidor como autoridad y pruebas de contrato compartido |
| Cambios Jira después del vínculo | Revalidación manual y estado de salud, sin sobrescribir datos PMO |

## 11. Fuera de alcance de la primera entrega

La primera versión no importará el historial completo de tickets, SLAs, colas, organizaciones ni clientes de JSM. Tampoco configurará automáticamente request types, workflows, esquemas, permisos o automatizaciones del Space existente. Estas capacidades pueden abordarse posteriormente sobre un vínculo estable y validado.

## 12. Recomendación de ejecución

Se recomienda ejecutar **J0 a J5** como alcance funcional mínimo. J6 puede desarrollarse a continuación como vista administrativa global. J4 no debe omitirse: sin mapeo de issue types y dry-run, vincular un Space existente puede llevar a fallos o duplicados cuando la PMO intente crear actividades y facturación.

Para el primer piloto se debe usar un servicio recurrente y un Space JSM no productivos o expresamente autorizados. La secuencia será preflight de solo lectura, confirmación local, dry-run y una única sincronización controlada.

## Referencias

[1]: https://developer.atlassian.com/cloud/jira/service-desk/rest/api-group-servicedesk/ "Atlassian Developer — Service desk API"
[2]: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/ "Atlassian Developer — Jira Cloud Projects API"
[3]: https://developer.atlassian.com/cloud/jira/service-desk/rest/intro/ "Atlassian Developer — Jira Service Management REST API introduction"
