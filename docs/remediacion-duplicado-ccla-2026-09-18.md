# Remediación del proyecto duplicado CCLA — 18 de septiembre de 2026

## Decisión aplicada

Por instrucción del usuario, el proyecto **PMO-2670001** se mantiene como registro canónico y vigente. El proyecto **PMO-2280001** fue respaldado y eliminado por representar el mismo proyecto `[PMO] CCLA SRP MVP1 Deal 4728`.

No se reconciliaron montos, monedas ni fuentes financieras. Tampoco se realizaron escrituras en Jira/JSM.

## Respaldo del registro eliminado

La base conserva las tablas físicas con prefijo `backup_duplicate_2280001_20260918`. También se generó un respaldo JSON exportable fuera del repositorio.

| Tabla | Filas respaldadas y eliminadas |
|---|---:|
| `projects` | 1 |
| `project_stages` | 6 |
| `sow_documents` | 1 |
| `stage_approvals` | 1 |
| `stage_closures` | 1 |
| `stage_openings` | 1 |
| `uploaded_files` | 1 |
| `audit_logs` históricos | 4 |

## Registro preservado

El proyecto **PMO-2670001** permanece vinculado a `PMOCCLSRPM`. La verificación posterior confirmó que conserva 6 hitos ejecutivos, 38 mappings Jira, 8 excepciones documentadas, 12 corridas de sincronización, 2 documentos vinculados, 19 riesgos, 31 tareas WBS, su SoW aprobado y todas las etapas asociadas.

Se añadieron entradas de auditoría para la eliminación del duplicado y la preservación del registro canónico, ambas ligadas a la operación `remove-duplicate-project-2280001-20260918`.

## Prevención estructural de duplicados

La migración `0046_curious_falcon.sql` incorpora el índice único `projects_project_name_unique` sobre `projects.projectName`. La columna utiliza `utf8mb4_unicode_ci`, por lo que la restricción también impide variaciones sólo por mayúsculas, minúsculas o acentos. Antes de aplicar el índice se verificó que no quedaran colisiones y se respaldaron los 12 proyectos en `backup_project_name_uniqueness_20260918_projects`.

Las altas nativas, las altas vinculadas y las ediciones normalizan espacios exteriores e interiores, consultan si el nombre ya existe y devuelven un conflicto que identifica el registro vigente como `PMO-{id}`. El índice único actúa como segunda barrera ante carreras concurrentes.

Durante la homologación Jira, una coincidencia exacta de nombre sólo puede reutilizarse automáticamente si corresponde a un proyecto todavía en SoW o Jira y no tiene otra clave Jira. Un proyecto más avanzado o vinculado a otra clave provoca un conflicto explícito en lugar de crear una segunda entidad.

## Identificación visible

El identificador interno se presenta con el formato `PMO-{id}` en PMO Proyectos, proyectos recientes, encabezado del detalle, Consola de Gobierno —incluida la lista de cerrados—, Dashboard Ejecutivo V2 y dashboard heredado. Para CCLA, todas estas vistas muestran **PMO-2670001**.

## Certificación

La base rechazó con `ER_DUP_ENTRY` una inserción transaccional del mismo nombre con otra capitalización y dejó cero residuos. Las funciones backend de alta nativa, alta Jira y edición rechazaron la variante con espacios adicionales e identificaron `PMO-2670001`; un proyecto de control permaneció sin cambios. Las pruebas focales aprobaron **46/46**, el build productivo finalizó correctamente y la revisión autenticada confirmó un único CCLA entre 12 proyectos. Los cinco errores TypeScript heredados permanecen sin cambios y no pertenecen a esta remediación.

## Reversión

La reversión de la protección consiste en ejecutar `ALTER TABLE projects DROP INDEX projects_project_name_unique`. El proyecto eliminado sólo debe restaurarse desde las tablas `backup_duplicate_2280001_20260918_*` si existe una autorización explícita, porque su reintroducción volvería a crear la identidad duplicada.
