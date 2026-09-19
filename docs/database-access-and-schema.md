# Acceso seguro a base de datos y mapa de esquema

## Propósito

Este documento permite que nuevas tareas y módulos reutilicen la base de datos existente sin copiar credenciales ni crear conexiones paralelas. **La cadena real `DATABASE_URL` es un secreto de runtime y nunca debe escribirse en documentación, código, logs, commits, tickets o mensajes.**

## Acceso autorizado

La plataforma recibe `DATABASE_URL` por inyección segura del entorno de ejecución. El código de aplicación debe obtener la conexión mediante `getDb()` en `server/db.ts` y trabajar con los modelos de Drizzle definidos en `drizzle/schema.ts`. No se deben crear archivos `.env` versionados ni incluir la URL en scripts persistentes.

Para operaciones administrativas puntuales, un script temporal puede leer `process.env.DATABASE_URL`, siempre que no imprima su valor. Antes de ejecutarlo se debe aplicar un gate de identidad, generar respaldo, limitar el conjunto de filas y verificar el resultado. Los scripts temporales no deben incluir secretos literales.

## Fuente de verdad del esquema

| Artefacto | Uso |
|---|---|
| `drizzle/schema.ts` | Definición TypeScript vigente de tablas, columnas y enums |
| `drizzle/relations.ts` | Relaciones de Drizzle |
| `drizzle/*.sql` | Migraciones SQL versionadas |
| `server/db.ts` | Helpers de persistencia y operaciones de dominio |
| `server/executivePortfolioSource.ts` | Lectura consolidada del Portafolio |

## Tablas principales

| Dominio | Tablas relevantes | Observación |
|---|---|---|
| Proyectos | `projects`, `project_stages`, `stage_openings`, `stage_closures`, `stage_approvals` | `projects.currentStage` es pipeline PMO, no fase Jira |
| Jira | `jira_spaces`, `jira_onboarding_records`, `jira_portfolio_snapshots` | Los snapshots de portafolio son locales; la sincronización es GET-only |
| Riesgos | `risks`, `risk_versions` | El portafolio prioriza riesgos PMO confirmados |
| Planificación | `wbs_tasks`, `gantt_uploads`, `design_documents` | Evidencia contractual y planificación |
| Finanzas | `financial_data`, `billing_milestones`, `financial_sync_logs` | Nunca sumar monedas distintas; hitos planificados no equivalen a facturación |
| Ejecutivo | `executive_project_sources`, `executive_contract_milestones`, `executive_verdicts` | Fuentes y análisis ejecutivo |
| Auditoría | `audit_logs` | Registrar operaciones administrativas y sincronizaciones |
| Servicios recurrentes | `recurring_services` y tablas `recurring_service_*` | Dominio separado del portafolio de proyectos |

## Reglas para nuevas migraciones

Toda migración debe ser aditiva e idempotente cuando sea posible. Antes de aplicar cambios se debe verificar rama, refs, divergencia, árbol de trabajo y checkpoint. Después se debe confirmar que `drizzle/schema.ts` y la base física coinciden, ejecutar pruebas focales, build, `git diff --check` y escaneo de secretos.

Las operaciones de borrado requieren identificación exacta de filas, respaldo previo, cascada controlada y auditoría. Las sincronizaciones Jira/JSM usadas por el Portafolio deben permanecer en modo GET-only: escribir snapshots y auditoría locales está permitido; crear, editar o transicionar issues no lo está.

## Diagnóstico sin revelar secretos

Se puede comprobar disponibilidad con `Boolean(process.env.DATABASE_URL)` o intentando `getDb()`. Nunca se debe imprimir `process.env.DATABASE_URL`. Para revisar tablas, use Drizzle o consultas como `SHOW COLUMNS FROM <tabla>` y `INFORMATION_SCHEMA`, evitando exportar datos personales o secretos innecesarios.
