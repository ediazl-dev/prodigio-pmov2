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
