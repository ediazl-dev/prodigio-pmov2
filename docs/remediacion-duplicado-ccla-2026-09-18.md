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
