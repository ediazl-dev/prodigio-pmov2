# Limpieza controlada de datos de prueba — 18 de septiembre de 2026

## Resumen ejecutivo

Se ejecutó una limpieza controlada de los registros inequívocamente de prueba encontrados en la plataforma PMO. El gate de sincronismo confirmó que `main`, `origin/main` y `user_github/main` estaban alineados en el checkpoint base `be752523`, con el árbol de trabajo limpio antes de iniciar.

El inventario identificó **10 proyectos de prueba**, todos creados el 29 de agosto de 2026, con cliente `Cliente de prueba`, origen `platform`, sin clave Jira y en etapas iniciales `sow` o `jira`. Se respaldaron y eliminaron esos proyectos junto con sus dependencias. No se realizaron operaciones contra Jira ni JSM.

El mismo inventario confirmó que los **3 servicios recurrentes existentes son productivos** y tienen Deals reales. Por lo tanto, no se eliminó ningún servicio recurrente.

## Alcance eliminado

| ID | Proyecto | Etapa previa |
|---:|---|---|
| 2490001 | Prueba planificación determinista 1788035330640 | SoW |
| 2490002 | Avance DOCX 1788035333645 | SoW |
| 2490003 | Prueba contingencia planificación 1788035337081 | SoW |
| 2490004 | Prueba de cierre 1788035338927 | Jira |
| 2490005 | Prueba aprobación SoW 1788035342507 | Jira |
| 2640001 | Prueba planificación determinista 1788041766388 | SoW |
| 2640002 | Avance DOCX 1788041768484 | SoW |
| 2640003 | Prueba contingencia planificación 1788041769537 | SoW |
| 2640004 | Prueba de cierre 1788041770127 | Jira |
| 2640005 | Prueba aprobación SoW 1788041772616 | Jira |

## Respaldo

Antes del borrado se crearon diez tablas físicas con prefijo `backup_test_cleanup_20260918`: nueve copias de datos y un manifiesto. También se generó un respaldo exportable JSON fuera del repositorio.

| Tabla de origen | Filas respaldadas |
|---|---:|
| `projects` | 10 |
| `billing_milestones` | 12 |
| `jira_spaces` | 2 |
| `lessons_learned` | 2 |
| `project_stages` | 60 |
| `sow_documents` | 4 |
| `stage_closures` | 2 |
| `wbs_tasks` | 24 |
| `audit_logs` | 30 |

Cada copia fue verificada contra el conteo de su tabla de origen antes de comenzar la transacción de borrado. El archivo `backup.json` tiene SHA-256 `7bd48aa104a513d00fdfeda7ade7cf83b5dcbbdac7b04f78a28339e985f60a89`.

## Resultado de la eliminación

La transacción eliminó **10 proyectos**, **106 filas dependientes** y preservó las 30 entradas históricas de auditoría dentro del respaldo. Luego registró 10 nuevas entradas `delete_test_project`, una por proyecto, con el identificador de operación `cleanup-test-data-20260918` y la referencia al respaldo.

| Control posterior | Resultado |
|---|---:|
| Proyectos totales antes | 23 |
| Proyectos totales después | 13 |
| Proyectos candidatos restantes | 0 |
| Dependencias de los IDs eliminados | 0 |
| Servicios recurrentes antes | 3 |
| Servicios recurrentes después | 3 |
| Servicios recurrentes candidatos | 0 |
| Entradas de auditoría de limpieza | 10 |

Los conteos de huérfanos preexistentes en tablas históricas no aumentaron como consecuencia de esta intervención. Esos residuos anteriores no formaron parte del alcance y no se alteraron.

## Servicios recurrentes preservados

| ID | Servicio | Cliente | Deal | Vínculo JSM |
|---:|---|---|---:|---|
| 2040001 | Deal 4687_Servicio Staffing | Consalud | 4687 | Sin vínculo confirmado |
| 2070001 | Deal 4727_Servicio Staffing_Aquitectura | Consalud | 4727 | Sin vínculo confirmado |
| 2100001 | Deal 2383_Soporte y Evolutivo Camanchaca | Camanchaca | 2383 | `CAMANSOP02` / Service Desk `365` |

## Controles aplicados

La selección se realizó mediante una lista cerrada de IDs y nombres. El ejecutor abortaba si cambiaba cualquier identidad, si el cliente dejaba de ser `Cliente de prueba`, si aparecía una clave Jira, si el proyecto avanzaba a una etapa protegida, si surgía un servicio candidato o si aparecía una dependencia no contemplada. El borrado de datos operativos se ejecutó dentro de una única transacción. La validación posterior fue realizada por un proceso de solo lectura independiente.
