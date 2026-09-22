# Corrección general del Portafolio de Proyectos con fuentes Jira y financieras

**Fecha de certificación:** 18–19 de septiembre de 2026  
**Alcance:** 12 proyectos PMO, incluidos proyectos nativos y vinculados a Jira  
**Principio rector:** separar cada concepto operativo y mostrar `N/D` cuando no existe evidencia válida.

## 1. Resumen ejecutivo

La vista anterior del Portafolio utilizaba el cursor del pipeline PMO local como si fuera la fase operacional de Jira. Esto generaba conclusiones incorrectas: un proyecto vinculado podía aparecer en “Análisis y Diseño” aunque la ejecución real estuviera en construcción, y la ausencia de apertura de una etapa PMO se presentaba como si implicara falta de avance del proyecto.

La corrección incorpora un snapshot Jira local, idempotente y de sólo lectura, y construye cada fila mediante reglas deterministas. El Portafolio ahora distingue **fase Jira**, **pipeline PMO**, **avance e hitos Jira**, **plazo PMO**, **ciclo de vida**, **salud**, **PM**, **riesgos** y **monto contratado**. Ningún campo se completa por inferencia cuando falta su fuente.

## 2. Causa raíz

| Problema | Causa | Corrección |
|---|---|---|
| Fase operacional incorrecta | `currentStage` representa el pipeline PMO, no la fase Jira | La fase operacional proviene del snapshot Jira; `currentStage` se conserva como pipeline PMO |
| “Plazo sin apertura” ambiguo | Se mezclaba el plazo administrativo PMO con el avance Jira | Se muestra **Sin apertura PMO** y la aclaración **No mide avance Jira** |
| “Activo sin medir” ambiguo | Ciclo de vida y salud se mostraban como un solo concepto | Se separan **Activo/Completado/Pausado/Cancelado** y **Salud Jira** |
| PM ausente en proyectos vinculados | Sólo se consideraba el PM local | Se aplica prioridad PMO local → Jira → datos financieros |
| Riesgos ausentes | Sólo se consideraban riesgos PMO confirmados | Se usa Jira cuando no existen riesgos PMO confirmados |
| Monto contratado incompleto | No existía jerarquía consolidada por Deal | Se aplica prioridad financiera → ficha → hitos en una sola moneda → `N/D` |

## 3. Arquitectura implementada

La tabla `jira_portfolio_snapshots` mantiene una fila por `projectId`. El proceso de refresco obtiene información con operaciones Jira **GET-only**, normaliza los datos y hace UPSERT local. `lastSuccessAt` preserva la última evidencia utilizable incluso si una corrida posterior queda parcial.

El motor `server/executivePortfolio.ts` permanece puro y determinista. `server/executivePortfolioSource.ts` carga proyectos, cumplimiento PMO, datos financieros y snapshots Jira; luego entrega un único read model a la UI. `ProjectTable.tsx` presenta las fuentes sin sustituir el pipeline PMO existente.

| Componente | Responsabilidad |
|---|---|
| `drizzle/schema.ts` / `0047_perfect_sentinels.sql` | Tabla aditiva e idempotente de snapshots Jira |
| `server/jiraClient.ts` | Lecturas GET-only de fase, salud, avance, PM, hitos y riesgos |
| `server/jiraPortfolioSnapshot.ts` | Refresco focal y batch, reintentos acotados y persistencia local |
| `server/jiraReconciliationSchedule.ts` | Extiende el job Jira existente sin crear un cron nuevo |
| `server/executivePortfolioSource.ts` | Carga consolidada de las fuentes |
| `server/executivePortfolio.ts` | Resolución determinista y trazable de cada fila |
| `client/src/pages/projects/*` | Filtros, orden y tabla con semántica separada |

## 4. Jerarquía de fuentes

| Dato | Prioridad | Regla de ausencia |
|---|---|---|
| Deal | Campo directo → patrón `Deal ####` en el nombre | `N/D` |
| Fase, avance, salud e hitos | Snapshot Jira reciente | `N/D` o evidencia parcial |
| Pipeline PMO | `currentStage` y cierres PMO reales | Nunca se reemplaza con Jira |
| Plazo PMO | Apertura/cierre y plazo configurado de la etapa local | **Sin apertura PMO** o no aplica |
| Project Manager | PM local → snapshot Jira → financiero | `N/D` |
| Riesgos | Riesgos PMO confirmados, si existen → snapshot Jira | `N/D` |
| Monto contratado | `financial_data` por Deal → ficha del proyecto → suma de hitos si todos comparten moneda | `N/D`; nunca suma monedas distintas |

Los montos de hitos se usan exclusivamente como fallback del **contratado**. Esta regla no transforma hitos planificados en facturación realizada ni altera las métricas de cobro.

## 5. Resultado de cobertura

La corrida Jira real y repetida sobre los 12 proyectos vinculados dejó **12 snapshots para 12 `projectId` distintos**, confirmando idempotencia. El resultado fue **11 `success`**, **1 `partial`** y **0 errores**. El proyecto PMO-390001 (PAI) permanece parcial con código `JIRA_PROGRESS_ISSUE_MISSING`; no se inventan fase, salud ni PM.

En la lectura consolidada final hay 12 filas, 11 con fase operacional Jira, 10 con PM resuelto, 12 con riesgos, 8 con monto contratado y 12 con hitos. Los cuatro montos faltantes y los dos PM faltantes se muestran como `N/D`. Ningún snapshot estaba vencido al momento de la certificación.

## 6. Caso Tanner PMO-180002

| Campo | Resultado certificado | Fuente |
|---|---|---|
| Fase operacional | Construcción + QA | Jira |
| Pipeline PMO | Avance Proyecto, 4/6 etapas completadas | `project_stages` local |
| Avance | 31% | Jira |
| Hitos | 8/10 cerrados | Jira |
| Plazo PMO | Sin apertura PMO; 10 días hábiles configurados; no mide avance Jira | Configuración y aperturas PMO |
| Ciclo de vida | Activo | PMO local |
| Salud | Rojo \| Crítico | Jira |
| Project Manager | Eduardo Mercado | Jira |
| Riesgos | 23 abiertos, 12 altos | Jira |
| Contratado | UF 8.200 | `financial_data`, Deal1934 |

## 7. Operación

El botón **Actualizar Jira** está disponible para roles Admin y PMO. Ejecuta el batch GET-only, espera su respuesta, invalida la lectura del portafolio y notifica éxitos, parciales y errores. Este botón no crea, edita ni transiciona issues Jira.

El job existente `jira-homologation-sync-daily`, programado a las 04:00 UTC, fue extendido para actualizar estos snapshots. No se creó ni duplicó ningún schedule. El lote está acotado a 50 proyectos y aplica reintentos controlados.

## 8. Certificación

| Control | Resultado |
|---|---|
| Suite focal del Portafolio | 74/74 pruebas aprobadas |
| Guard de autolimpieza de fixtures | 5/5 pruebas aprobadas; el total de proyectos permaneció en 12 |
| Suite amplia determinista | 783/783 pruebas aprobadas; 19 omitidas por configuración |
| Build productivo | Exitoso |
| `git diff --check` | Sin errores |
| Escaneo de secretos en el diff | Sin hallazgos |
| TypeScript | Permanecen exactamente 5 errores heredados; no se añadieron errores |
| Validación visual | Escritorio 1440×1000 y móvil 375×812 |
| Datos posteriores a certificación | 12 proyectos y 12 snapshots distintos |

La suite integral sin exclusiones detectó dos dependencias externas no relacionadas: Banco Central devolvió código `-5` y una prueba de servicios recurrentes no pudo conectar con Pipedrive. Durante esa ejecución, pruebas heredadas crearon 15 fixtures en la base activa. La certificación se detuvo, se respaldaron proyectos y dependencias, se eliminaron sólo los IDs 2820001–2820015 mediante la cascada administrativa y se registró `cleanup_test_fixtures` en auditoría. Las cinco pruebas que originaban esos registros ahora ejecutan `deleteProjectAdmin` desde `afterEach`, incluso cuando una aserción falla. Una corrida específica de las cinco pruebas aprobó 5/5 y dejó el total inalterado en 12 proyectos.

## 9. Limitaciones conocidas

Los campos `N/D` son brechas explícitas de fuente, no fallas de cálculo. PMO-390001 seguirá parcial hasta que Jira disponga del issue operacional esperado. Cuatro proyectos seguirán sin monto mientras no exista `financial_data`, monto en ficha o hitos de una moneda única. La deuda TypeScript heredada se concentra en `server/jiraMilestoneSync.ts` y `server/routers.ts`; no forma parte de esta corrección.

### Ajuste del 19 de septiembre de 2026

Se detectó que el conteo `0/6` se calculaba exclusivamente desde `getComplianceMetrics()`. Ese cálculo requiere una fila en `stage_openings`, por lo que descartaba etapas que ya estaban físicamente `completed` en `project_stages` durante la materialización de proyectos vinculados. El read model ahora cuenta el estado físico de las seis etapas y reserva `stage_openings` para medir tiempo. En Tanner esto produce **4/6 etapas completadas**, cursor **Avance Proyecto** y plazo **configurado en 10 días hábiles**, pero mantiene días usados en `N/D` porque no existe una fecha de apertura verificable. No se inventó ninguna fecha.

## 10. Rollback

El checkpoint anterior a la corrección general es `c9b4297c`. La migración de snapshots es aditiva, por lo que un rollback de aplicación puede dejar la tabla sin afectar el modelo anterior. No se debe eliminar la tabla ni sus filas sin un respaldo explícito. Los snapshots son evidencia local y su eliminación no modifica Jira.
