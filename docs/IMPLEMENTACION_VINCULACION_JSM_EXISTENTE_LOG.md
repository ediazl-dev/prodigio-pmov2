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

| Control | Resultado |
|---|---|
| Base | `a04a993` |
| Rama | `main` |
| Alineamiento `user_github/main` | `0/0`, sin divergencia |
| Árbol antes de J0 | Solo `todo.md`, correspondiente al backlog aprobado |
| Escrituras Jira/JSM | Ninguna |
| Bloque actual | J0 exclusivamente |

### Criterios de salida J0

| Criterio | Resultado |
|---|---|
| Cardinalidad uno-a-uno | Confirmada |
| Importación automática de tickets | Fuera de alcance |
| Cierre automático de JSM Setup | Prohibido |
| Política de desvinculación | Bloqueada con issues asociados |
| Fuente de verdad externa | API de Service Desks + proyecto Jira |
| Autorización para ejecutar J1–J7 | Recibida del usuario |

## Próximo bloque

J1 implementará exclusivamente el modelo de datos e integridad: origen del vínculo, snapshot de nombre, URLs diferenciadas, metadatos de verificación, mapeos de issue types y corridas de preflight. La migración será aditiva y se revisará antes de aplicarla.

## J1 — Modelo de datos e integridad

**Estado:** completado.

Se amplió `recurring_services` con origen del vínculo, nombre del proyecto, URL de agente separada del portal, salud, fecha de verificación, fecha de asociación y actor. Se conservaron los campos existentes `jsmProjectKey`, `jsmProjectId`, `jsmServiceDeskId` y `jsmPortalUrl` para mantener compatibilidad.

Se añadieron índices únicos para `jsmProjectKey`, `jsmProjectId` y `jsmServiceDeskId`. La auditoría previa confirmó que no existían duplicados no nulos, por lo que la migración se aplicó sin modificar registros existentes.

| Entidad | Propósito |
|---|---|
| `recurring_service_jsm_link_runs` | Corridas idempotentes de preflight, vínculo, revalidación y desvinculación |
| `recurring_service_jsm_issue_type_mappings` | Mapeos separados para plan de trabajo y facturación |

El contrato compartido se centralizó en `shared/jsmExistingSpace.ts` para que esquema, servidor y cliente utilicen los mismos valores.

### Evidencia J1

| Control | Resultado |
|---|---|
| Migración | `0043_sudden_jetstream.sql`, revisada y aplicada |
| Prueba unitaria | 1 de 1 aprobada |
| Prueba persistente opt-in | 1 de 1 aprobada |
| Unicidad de identidad JSM | Validada para proyecto y Service Desk |
| Unicidad de corrida | Validada por `runId` y fingerprint por servicio |
| Unicidad de mapping | Validada por servicio y categoría |
| Limpieza de fixtures | 0 servicios, corridas y mapeos residuales |
| Build | Exitoso |
| TypeScript | Sin errores nuevos; permanecen cinco deudas heredadas en `jiraMilestoneSync.ts` y `routers.ts` |
| Escrituras Jira/JSM | Ninguna |

El único vínculo JSM previo conserva sus datos sin inferencias. La recuperación de `serviceDeskId`, nombre y URLs faltantes se realizará mediante los lectores J2 y una revalidación explícita; no se completarán campos por suposición.

## Próximo bloque J2

Implementar lectores paginados y de detalle para Service Desks, proyecto Jira subyacente, permisos e issue types. Todas las operaciones serán de lectura y tendrán pruebas que impidan llamadas de escritura.

## J2 — Lectores JSM y preflight de solo lectura

**Estado:** completado.

Se incorporaron lectores para listar todos los Service Desks accesibles con paginación, obtener un Service Desk por ID, validar el proyecto Jira subyacente, consultar permisos efectivos y recuperar los tipos de issue disponibles. También se separó la construcción de la URL de agente y la URL del portal de clientes.

El evaluador puro `inspectJsmExistingSpace` clasifica candidatos válidos, proyectos no JSM, Spaces archivados, cambios de identidad, falta de acceso, falta de permiso para crear issues, conflictos con otro servicio, vínculo idempotente y mappings de issue types obsoletos.

### Evidencia J2

| Control | Resultado |
|---|---|
| Pruebas focales J1–J2 | 7 aprobadas; 1 persistente opt-in omitida en batería normal |
| Integración real read-only | 1 de 1 aprobada contra el tenant configurado |
| Paginación | Validada en más de una página simulada |
| Método HTTP del catálogo JSM | Solo `GET`, afirmado por prueba |
| Tipo de proyecto | Validación explícita `service_desk` |
| Permisos | `BROWSE_PROJECTS` y `CREATE_ISSUES` consultados |
| Issue types | Recuperados por `projectId` |
| Build | Exitoso |
| TypeScript | Sin errores nuevos; permanecen cinco deudas heredadas |
| Escrituras Jira/JSM | Ninguna |

## Próximo bloque J3

Persistir corridas de preflight, exponer listado/diagnóstico por API, asociar de forma transaccional e idempotente, revalidar y auditar, manteniendo Jira/JSM en modo de solo lectura.

## J3 — API, persistencia y asociación local segura

**Estado:** completado.

Se implementó un orquestador de vínculo que combina el evaluador puro J2 con persistencia local. El preflight vuelve a leer JSM, construye un fingerprint SHA-256 estable sin incluir la hora de inspección, persiste o reutiliza una corrida y clasifica el resultado como `ready`, `blocked` o `error`. El mismo `operationId` no puede reutilizarse para otra acción, servicio o candidato.

La confirmación exige una corrida de preflight `ready`, revalida el Service Desk contra Jira/JSM y compara el fingerprint nuevo con el aprobado. Si la identidad o el diagnóstico cambian, la operación queda bloqueada como `STALE_PREFLIGHT`. Solo después de esa comprobación se actualiza `recurring_services` dentro de una transacción local. La transacción impide tanto que otro servicio posea la identidad candidata como que el servicio actual cambie directamente desde un Space ya vinculado hacia otro.

| Operación API | Acceso | Efecto |
|---|---|---|
| `listExistingJsmSpaces` | `protectedProcedure` | Lista y filtra Service Desks accesibles; muestra vínculo PMO si existe |
| `getExistingJsmLinkState` | `protectedProcedure` | Devuelve vínculo, mappings activos e historial de corridas |
| `preflightExistingJsmSpace` | `adminOrPmo` | Diagnóstico GET-only y corrida auditable |
| `linkExistingJsmSpace` | `adminOrPmo` | Revalidación y vínculo únicamente en PMO |
| `revalidateExistingJsmSpace` | `adminOrPmo` | Actualiza salud y metadatos verificados |
| `unlinkExistingJsmSpace` | `adminOrPmo` | Desvincula solo si no hay `jiraIssueKey`; exige motivo |

Las operaciones registran acciones explícitas en `audit_logs`: `jsm_existing_preflight`, `jsm_existing_link`, `jsm_existing_revalidate` y `jsm_existing_unlink`. Los errores de dominio y de unicidad se convierten en respuestas `BAD_REQUEST` legibles; los errores desconocidos no se ocultan. La desvinculación deja los mappings en estado `superseded` y conserva en la corrida la identidad anterior para trazabilidad.

### Evidencia J3

| Control | Resultado |
|---|---|
| Pruebas focales J2–J3 | 16 de 16 aprobadas |
| Prueba persistente opt-in J3 | 1 de 1 aprobada contra la base real |
| Limpieza de fixtures | 0 servicios, corridas, mappings, actividades y facturaciones residuales |
| Idempotencia | Validada por fingerprint y `operationId`; colisiones incompatibles rechazadas |
| Cardinalidad | Bloqueo de identidad ocupada y de segundo Space sobre el mismo servicio |
| Desvinculación | Bloqueada con `jiraIssueKey` en plan de trabajo o facturación; permitida sin asociaciones |
| Métodos Jira/JSM de escritura | Ninguno invocado por J3 |
| Cierre de `jira_setup` | No se ejecuta ni se modifica |
| Build | Exitoso |
| TypeScript | Sin errores nuevos; permanecen cinco deudas heredadas en `jiraMilestoneSync.ts` y `routers.ts` |

## Próximo bloque J4

Configurar mappings explícitos para `work_plan` y `billing`, sustituir la dependencia fija de `Task`, incorporar un dry-run de sincronización, impedir asociaciones por título y alinear la regla de cierre de `jira_setup` entre servidor e interfaz. J4 seguirá siendo una acción separada del vínculo y será el primer bloque autorizado para crear issues únicamente mediante confirmación explícita.
