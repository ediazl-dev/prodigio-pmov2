# Dashboard gerencial Clásico de servicios recurrentes v3

**Fecha de actualización:** 28-sep-2026
**Base anterior:** checkpoint `9fd2a8c9`
**Rama:** `feat/recurring-management-dashboard-v2`
**Alcance:** lectura gerencial consolidada, estado operacional de facturación desde Jira y análisis financiero histórico desde la planilla corporativa.

## Objetivo

Responder por servicio y con fuente trazable:

- qué está programado contractualmente;
- qué hitos están marcados facturados o no facturados en Jira;
- qué monto contractual se atribuye a cada hito;
- qué estados son N/D o ambiguos;
- cuál es la evolución esperada versus facturada por mes contractual;
- qué cobertura existe para incidentes, SLA, entregables, documentos y multas.

## Frontera de fuentes

| Pregunta | Fuente | Regla |
|---|---|---|
| ¿Este hito o cuota está facturado? | Jira `Estado de Facturación` | Prevalece cuando el campo está informado. |
| ¿Un ticket mensual recurrente está facturado? | Estado del ticket Jira identificado inequívocamente como facturación | `done` permite `Facturado según Jira`; no se aplica a issues genéricos. |
| ¿Cuál es el monto del hito o cuota? | Hito contractual, calendario recurrente o venta × peso | Jira aporta estado, no altera monto ni moneda contractual. |
| ¿Cuál es el histórico financiero consolidado? | Planilla financiera sincronizada | Mantiene ventas, costos, margen, devengo, facturas, caja y series históricas. |
| ¿Existe factura tributaria o pago? | No acreditado por Jira | La UI no llama factura SII ni cobro al estado Jira. |

La planilla y `financial_billing_items` no se eliminan ni se reescriben. Se conservan como fuente histórica y de análisis financiero. Jira gobierna la lectura operacional por hito.

## Reglas de conciliación Jira

1. El campo Jira `Estado de Facturación` prevalece sobre el workflow general.
2. En servicios recurrentes sin ese campo, sólo se permite fallback por estado cuando el issue está identificado inequívocamente como ticket de facturación.
3. El cierre de un entregable genérico no implica facturación.
4. La coincidencia explícita `jiraIssueKey` prevalece; luego Deal + mes/código; luego mes con fuente coherente.
5. Los duplicados se agrupan y no se suman.
6. Si falta estado Jira, la lectura queda `N/D`; no se interpreta como facturado ni no facturado.
7. Monedas distintas no se suman ni convierten.
8. La fecha `updated` de Jira es fecha de evidencia, no fecha de factura.
9. Toda integración Jira es GET-only.

## Integración implementada

### Proyectos

- `jira.projectBillingEvidence` entrega estado, monto, moneda, fuente de monto, issue y duplicados por hito.
- El resumen ejecutivo compacto y el Dashboard Ejecutivo V2 muestran `Facturación operacional por hito`.
- El bloque financiero existente se rotula `Análisis financiero histórico — planilla consolidada`.

### Servicios recurrentes

- `recurringServices.jiraBillingEvidence` entrega la lectura por cuota.
- El detalle muestra `Programación contractual y estado Jira`; sus estados y total facturado se recalculan desde Jira sin alterar montos ni fechas locales.
- Ejecución usa el mismo panel Jira y deja de presentar el estado local como evidencia operacional.
- Clásico recibe un portafolio Jira único para las tres fichas y calcula:
  - facturado según Jira;
  - no facturado según Jira;
  - estado Jira N/D;
  - brecha sólo cuando el estado es comparable;
  - tendencia por mes contractual;
  - duplicados y excepciones.

## Lectura real al 28-sep-2026

| Caso | Resultado Jira | Monto atribuible |
|---|---|---:|
| Camanchaca Deal 2383 | 3/6 facturados; 3/6 no facturados | UF 282 facturado de UF 564 |
| Consalud Deal 4727 | 2 hitos facturados observados | UF 390 facturado |
| Consalud Deal 4687 | 0 facturados; 2 no facturados; 1 N/D | UF 320 no facturado; UF 160 N/D |
| Cartera recurrente | 2/3 servicios con hitos facturados | UF 672 facturado según Jira |
| Programación al corte | 3 servicios | UF 1.152 |
| Programación futura | Separada del corte | UF 1.062 |

### Hallazgo Camanchaca

CAMANSOP01 contiene tres familias de tickets para los mismos seis meses. El read model selecciona un candidato canónico por mes y muestra **seis grupos con duplicados**. Los candidatos adicionales permanecen visibles en la advertencia y nunca se suman. El resultado conservador es UF 282 facturado según Jira y UF 282 aún no facturado.

### Hallazgo de proyectos

Tanner PBTISD1 muestra 8 de 10 hitos facturados según el campo Jira, equivalentes a UF 6.970 de UF 8.200 usando monto contractual directo o venta × peso. Los dos hitos restantes suman UF 1.230 y aparecen no facturados según Jira.

## Lectura gerencial complementaria

- SLA configurado, JSM vinculado, muestra medida y cumplimiento permanecen separados.
- Un denominador cero produce N/D.
- Los snapshots JSM se presentan como stock, no como flujo mensual resuelto.
- Presencia documental no equivale a validación.
- Entregables sin fecha permanecen como brecha de planificación.
- El ciclo recurrente termina en Facturado; no expone Cobrado ni CxC.

## Archivos principales

- `server/jiraBillingEvidence.ts`
- `server/jiraBillingEvidence.test.ts`
- `server/recurringManagementDashboard.ts`
- `server/recurringServicesDashboardV2.ts`
- `server/recurringServicesRouter.ts`
- `server/routers.ts`
- `client/src/components/JiraBillingEvidencePanel.tsx`
- `client/src/components/ProjectExecutiveSummary.tsx`
- `client/src/pages/stages/ExecutiveDashboardV2.tsx`
- `client/src/pages/stages/ExecutiveFinancialAxis.tsx`
- `client/src/pages/RecurringServiceDetail.tsx`
- `client/src/pages/recurring/RSExecutionStage.tsx`
- `client/src/pages/recurring/ClassicManagementDashboard.tsx`
- `client/src/pages/recurring/serviceDetailViewModel.ts`

## Certificación final

- 61 pruebas focales aprobadas para read model Jira, dashboard recurrente, Clásico, resumen de proyecto y plan de cuotas.
- 1.095 pruebas deterministas aprobadas y 19 omitidas; se excluyó únicamente `server/ufService.test.ts` porque depende del servicio externo de UF.
- Build productivo exitoso.
- Validación real GET-only de Camanchaca, Consalud y Tanner.
- Validación visual autenticada de proyecto, servicio y Clásico en escritorio; móvil sin desbordamiento visible.
- TypeScript conserva únicamente los cinco errores heredados en `jiraMilestoneSync.ts` y `routers.ts`.
