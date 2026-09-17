# Cierre H7–H8 — Homologación Jira de proyectos existentes

## Alcance certificado

La certificación valida la conciliación Jira→PMO idempotente y el piloto real de homologación de un proyecto existente. Jira continúa siendo la fuente de verdad operacional; PMO conserva la estructura canónica, documentos, baseline contractual, aprobaciones y auditoría. Ningún flujo automático escribe en Jira.

## Proyecto piloto

| Campo | Evidencia |
|---|---|
| Proyecto Jira | `PMOCCLSRPM` — `[PMO] CCLA SRP MVP1 Deal 4728` |
| Proyecto PMO | `2670001` |
| Onboarding | `180001` |
| Estado | `ready`, paso 7 |
| Activación | 8 de septiembre de 2026 |
| Mappings aprobados | 6 hitos, 7 épicas y 24 tareas |
| Elementos excluidos | 1, sin sincronización |
| Baseline contractual | 1 fuente aprobada y 6 hitos completos |
| Dominios materializados | 19 riesgos y 31 tareas WBS |
| Pipeline canónico | 3 etapas completadas, 1 en progreso y 2 bloqueadas |

La vista productiva confirma `ONBOARDING LISTO`, acceso al Dashboard Ejecutivo V2, botón **Sincronizar ahora**, baseline separado del plan Jira, evidencia documental e historial de las últimas diez corridas. La etapa Planificación permanece en progreso y Avance/Cierre continúan bloqueadas; el piloto no saltó ni eliminó etapas.

## Conciliación e idempotencia

Las últimas corridas programadas procesaron 37 issues, actualizaron 31 y omitieron 6. El resultado `partial` corresponde a excepciones de datos y permite conservar los dominios válidos. No se observaron duplicados de mappings ni pérdida de baseline aprobado.

| Control | Resultado |
|---|---|
| Preflight y dry-run | Validado |
| Mapeo aprobado/excluido | Validado |
| Bloqueos estrictos | Validados |
| Reintentos e idempotencia | Validados |
| Resultado parcial por item | Validado |
| Autorización cron/task UID | Validada |
| Persistencia H7 aislada | Validada con limpieza total |
| Matriz H0–H8 ampliada | 155 pruebas aprobadas; 7 opt-in omitidas |
| Residuos del test persistente | 0 |
| Estabilización multi-proyecto | 4 candidatos: 2 aplicados, 1 parcial y 1 error aislado |
| Reintento del mismo día | 3 resultados terminales reutilizados; sólo el error volvió a intentarse |

## Excepciones y faltantes

Existen diez advertencias históricas abiertas. La vista actual presenta dos excepciones accionables de backlog: Jira no informa una clave de padre para esos issues, por lo que la jerarquía permanece **POR CONFIRMAR**. Estas advertencias no bloquean la integridad del piloto, pero deben revisarse antes de declarar completa la estructura funcional.

El Deal financiero permanece **POR CONFIRMAR** y no debe inferirse desde Jira. Los hitos cuyo plan Jira no está disponible mantienen esa ausencia explícita; la fecha contractual sigue proviniendo del baseline aprobado.

## Operación gradual

Cada nuevo proyecto debe pasar por búsqueda del Space, preflight GET-only, mapeo explícito, revisión de bloqueos, dry-run, confirmación humana y primera conciliación. Sólo después puede activarse la sincronización diaria. La existencia del piloto no autoriza una migración masiva automática.

El lote diario procesa únicamente onboardings `ready`, hasta un máximo de 50 por corrida. Si existe exceso, lo informa como diferido; si un proyecto falla, continúa con los siguientes. Los resultados aplicados o parciales se reutilizan al repetir el mismo `operationId` diario, mientras un error aislado puede reintentarse sin duplicar los proyectos ya conciliados.

## Rollback

Ante una regresión se debe pausar la tarea programada del proyecto, conservar las filas de auditoría y restaurar el checkpoint de aplicación anterior. La eliminación de un onboarding o de sus mappings requiere respaldo físico y autorización explícita; no debe eliminarse el proyecto Jira ni escribirse en sus issues. Si una corrida parcial contiene datos válidos, se corrige la excepción y se reintenta el mismo flujo idempotente en vez de borrar lo ya homologado.
