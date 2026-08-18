# Dashboard Ejecutivo v2 — Piloto Tanner

## Estado del piloto

El piloto del Dashboard Ejecutivo v2 se habilitó exclusivamente para **[PMO Banco Tanner] — Implementación SFA — Deal 1934**. La nueva vista convive con el dashboard heredado y queda protegida por una bandera de disponibilidad de servidor; no modifica Jira ni sustituye el flujo actual de Avance.

> Baseline aprobado: **SoW v6**. El SoW define los pesos contractuales; Jira `PBTISD1` aporta exclusivamente el estado y las fechas operativas de cada hito asociado.

## Evidencia implementada

| Componente | Implementación validada |
|---|---|
| Fuente contractual versionada | Tabla `executive_project_sources`, con huella SHA-256 del SoW, versión, estado de aprobación y vínculo explícito con Deal 1934 y Jira. |
| Mapeo contractual-operativo | Tabla `executive_contract_milestones`, con diez hitos SoW-Jira y ponderación contractual que suma 100 %. |
| Motor determinista | Calcula avance contractual, atrasos y semáforo sin inferir porcentajes desde Jira. Normaliza estados nominales de Jira. |
| Evidencia financiera | Presenta presupuesto, uso, capacidad y margen desde Deal 1934 como evidencia financiera separada de la línea contractual. |
| Interfaz del comité | Muestra decisión ejecutiva, KPIs, tabla de evidencia, foco inmediato y alertas financieras. |
| Integridad operativa | Las consultas recuperan sólo los hitos del baseline aprobado y la eliminación administrativa contempla las dos nuevas entidades ejecutivas. |

## Validación realizada

La ruta del piloto es `/projects/180002/executive-dashboard-v2`. La revisión visual confirmó la lectura ejecutiva y la trazabilidad completa de los diez hitos. La suite completa finalizó con **406 pruebas aprobadas** y tres pruebas externas omitidas de forma intencional. Los registros de prueba generados por la suite se eliminaron mediante una limpieza auditada, sin afectar Tanner ni su baseline.

## Escalamiento propuesto

Antes de habilitar un segundo proyecto, debe completarse una auditoría F0 equivalente y registrar un nuevo baseline aprobado. La expansión debe conservar el feature flag como lista explícita de pilotos hasta aprobar un procedimiento PMO de onboarding, frecuencia de sincronización Jira, responsables de reconfirmación del SoW y reglas de actualización de evidencia financiera.
