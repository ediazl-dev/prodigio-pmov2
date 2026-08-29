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
