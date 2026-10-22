# NEXOS SFA Multitenant — acta de configuración interna

**Proyecto:** PMO-4470001 · NEXOS_SFA_Multitenant. **Space Jira:** PMOPRONEX. **Fecha:** 21 de octubre de 2026, hora de Chile. **Base anterior del repositorio:** 27941a07.

## Resultado

El proyecto está clasificado explícitamente como **interno, sin ingresos ni facturación**. Conserva sus costos disponibles, historial, etapas y responsables. Tiene 19 actividades calendarizadas, cinco épicas y cuatro entregables ejecutivos visibles en la Gantt y el Dashboard Ejecutivo v2. Los 18 riesgos quedaron en Jira como **propuestas pendientes de revisión**, en **Identificado**, sin confirmación automática ni cierre de etapas.

Los datos PMO y los riesgos Jira están aplicados. La interfaz está certificada en vista previa y se entrega mediante el checkpoint final para publicación. **No se publicó automáticamente.**

## Fuente y calendario

Se conserva el Excel original `Plan_Multitenant_NEXOS_SFA_BCI.xlsx` y su copia en el expediente del proyecto, pendiente de revisión documental. SHA-256: `a9a8a3b0cff94a8abbe7bbb67e82aa1231578b41df289cab37eb2e6d7a9d6834`.

El CEO confirmó el **lunes 19 de octubre de 2026** como Día 1. Se calendarizaron los 15 días hábiles del Excel hasta el **6 de noviembre de 2026**. El calendario configurado no agregó feriados dentro de esta ventana. Es una línea base interna, no contractual.

| Entregable ejecutivo | Día | Línea base interna | Due Jira conservado | Jira existente |
|---|---:|---|---|---|
| G1 — revisión de especificación | 3 | 21-oct-2026 | 23-oct-2026 | PMOPRONEX-8 |
| Infra — evidencia de aislamiento | 5 | 23-oct-2026 | 26-oct-2026 | PMOPRONEX-15 |
| G2 — backlog revisado | 6 | 26-oct-2026 | 28-oct-2026 | PMOPRONEX-11 |
| G3 — pruebas, hallazgos y go/no-go | 15 | 6-nov-2026 | 10-nov-2026 | PMOPRONEX-24 |

Las fechas Jira no se reemplazaron por las del Excel. Se muestran separadas, con su deriva de planificación. Ningún gate tiene acta registrada ni aceptación inferida. La palabra «aprobada» en ciertos títulos describe el entregable esperado del Excel, no su estado actual.

## Configuración y finanzas

La migración aditiva `0054_projects_financial_mode.sql` y `projects.financialMode` separan `internal` de `commercial`, sin reutilizar el tipo tecnológico. Los proyectos legados conservan su clasificación comercial; sólo PMO-4470001 se reclasificó.

Se reutilizaron **los 24 issues originales: 19 actividades y cinco épicas**. La WBS tiene 24 filas estructurales, no 24 actividades del Excel. Los cuatro entregables ejecutivos tienen peso económico cero; **hay cero hitos de facturación**. La fuente ejecutiva persistida es `2010002`, versión `internal-plan-2026-10-19-v1`.

Los lectores financieros excluyen los proyectos internos de ingresos y facturación operacional. El dashboard muestra **Ingresos y facturación: No aplica**; omite montos en los gates y el panel de factura. Los costos sin fuente siguen siendo **N/D**, no cero. El historial financiero no se borró ni reconcilió.

La importación transaccional conservó las etapas y la matriz de riesgos. El primer intento falló al insertar auditoría e hizo rollback total, comprobado antes de corregir el campo y aplicar. La comprobación posterior devolvió `already_applied`, sin duplicación.

## Riesgos propuestos

La autorización fue explícita: **«Sí, cargarlos como propuestos, sin aprobarlos»**. Se alinearon descripción, mitigación y contingencia al plan autorizado, conservando IDs PMO, responsables, probabilidad, impacto, categoría, tipo, costo, fechas y evaluación.

**R001–R018** (IDs PMO **600003–600020**) quedaron vinculados uno a uno a **PMOPRONEX-25–PMOPRONEX-42**, respectivamente. Los 18 son **Riesgos PMO**, estado **Identificado**, con etiqueta individual `pmo-risk-<id>` y etiqueta `pmo-risk-proposed`. Cada issue señala que es una propuesta pendiente de revisión. Todos conservan **`confirmed=false`**.

La operación utilizó respaldo previo, intención/receipt y journal resumible. Los 18 registros están verificados, sin duplicados ni POST de creación repetidos. Se comprobaron los hashes de `before.json`, `after.json` y `verification.json`. El verificador realiza sólo SELECT/consultas Jira; sus únicas escrituras son archivos locales de evidencia.

**No se aprobó ningún riesgo, no se cerró ninguna etapa y no se acreditó ninguna entrega o factura.** El cierre Jira nunca acredita aceptación documental.

## Certificación final

- **Pruebas:** 1.235 aprobadas, 20 omitidas, cero fallos. Se excluyeron las suites externas `server/ufService.test.ts`, `server/jira.test.ts`, `server/pipedriveClient.test.ts`, `server/externalCredentials.test.ts` y `server/googleDriveToken.test.ts`. Las pruebas LIVE opt-in permanecieron omitidas.
- **Build de producción:** exitoso, Vite y esbuild.
- **TypeScript:** exactamente cinco errores heredados, cuatro en `server/jiraMilestoneSync.ts` y uno sobre `estadoSII` en `server/routers.ts`; cero nuevos. El type-check completo no está limpio.
- **Datos:** 19 actividades, cinco épicas comprobadas en WBS y Jira, cuatro gates, 18 riesgos propuestos y 42 issues totales. Los 24 originales preservan ID, texto, fechas, estado, responsable, etiquetas y fecha de actualización.
- **Vista previa autenticada:** 19 actividades y cuatro gates sin columna monetaria; Excel/Jira separados; costos N/D y facturación No aplica. `advance.getExecutiveDashboardV2` devuelve HTTP 200, modo `internal` y observación Jira `available`.
- **Accesibilidad:** CTO es la única perspectiva interna; selección, foco y panel usan la misma referencia, y las flechas no recorren perspectivas financieras ocultas. La prueba existente de accesibilidad quedó aprobada.
- **Integridad:** proyecto, etapas y WBS intactos durante la carga de riesgos; respaldos SHA-256, diff correcto y escaneo de secretos sin coincidencias. Script temporal UI retirado; respaldos y auditorías conservados.

La revisión humana de riesgos, las actas de entrega y los costos pendientes siguen siendo decisiones o evidencias de negocio; la configuración técnica no los reemplaza.
