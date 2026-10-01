# Remediación de facturación y SLA — Staffing Deal 4687

**Fecha de corte:** 1 de octubre de 2026. **Servicio PMO:** 2040001. **Estado:** corrección implementada; emisión de facturas aún no acreditada.

## Problema y fuente

La cabecera clasificaba tres cuotas UF 160 como vencidas sin facturar, mientras el panel inferior mostraba hitos Jira en estado *Completed*. Ninguno de esos dos estados demuestra la emisión de factura. El campo Jira «Estado de Facturación» de los tres hitos originales no entrega una confirmación inequívoca. Había además tickets de facturación generados por el PMO y cuatro reglas SLA de incidentes heredadas, no aplicables al contrato Staffing.

## Regla corregida

- La programación contractual conserva tres cuotas por **UF 480**. Su monto y vencimiento no cambian.
- La facturación operativa usa **exclusivamente estado de facturación Jira explícito** por hito original. El workflow *Completed* y tickets duplicados generados por PMO no acreditan factura.
- Sin evidencia explícita, las tres cuotas muestran **N/D · verificar emisión**, no «facturada», «sin facturar», «vencida sin facturar» ni UF 0 como conclusión financiera. Tampoco se infiere ausencia de mora.
- Un servicio Staffing no integra el denominador SLA de incidentes, DR ni cobertura 24x7. Los tickets administrativos en JSM no son incidentes para el indicador. Su etiqueta contractual es **No aplica**.
- El término contractual vencido con ficha todavía activa genera una alerta **de gobierno separada**; no acredita una deuda de factura ni incumplimiento SLA.
- El análisis histórico de la planilla consolidada sigue intacto, separado de la evidencia operativa Jira. El ciclo recurrente termina en Facturado; no hay Cobrado/CxC.

## Cambios y trazabilidad

Se creó respaldo previo selectivo del servicio 2040001 en `/home/ubuntu/backups/prodigio-pmo/2026-10-01-staffing-4687/before.json` con checksum; la corrección transaccional retiró sólo cuatro reglas SLA heredadas e incorporó auditoría. No se eliminaron cuotas, documentos, hitos ni issues Jira, ni se modificó la planilla. El script de saneamiento es idempotente y conserva guardrails por servicio, tipo y conjunto de IDs.

El read model de Jira excluye los tickets artificiales PMO, desactiva inferencias de emisión por workflow y reconoce los hitos originales. Cabecera, Torre de Control, Clásico, plan del detalle y Ejecución comparten la misma distinción entre **facturado**, **no facturado explícito** y **N/D**. En el detalle, el refresco actualiza conjuntamente cabecera y panel Jira. Los análisis IA Staffing anteriores a esta regla quedan marcados obsoletos (sin borrar su historial); una regeneración usa la política nueva y excluye SLA de incidentes.

## Verificación real

Al 1-oct-2026, los hitos seleccionados son [CONSALOP01-20](https://apiservice2.atlassian.net/browse/CONSALOP01-20), [CONSALOP01-21](https://apiservice2.atlassian.net/browse/CONSALOP01-21) y [CONSALOP01-22](https://apiservice2.atlassian.net/browse/CONSALOP01-22): **3/3 N/D** de facturación. La cabecera queda en **Atención**, señal `BILLING_STATUS_UNCONFIRMED` y señal independiente `CONTRACT_TERM_ELAPSED_ACTIVE`, sin `OVERDUE_BILLING`; SLA e incidentes de Staffing figuran **No aplica**. El grupo de M01 conserva una advertencia de duplicado no sumado.

**Acción pendiente de negocio:** confirmar en Jira el estado de emisión de cada factura, con evidencia y vínculo canónico del hito correcto. No se ha cambiado ninguno de esos tres estados ni borrado el candidato duplicado.

## Certificación

- **1.118 pruebas deterministas aprobadas**, 20 omitidas; se excluyó únicamente la prueba UF dependiente de una fuente externa. Build productivo aprobado.
- `pnpm check` conserva exactamente **cinco errores TypeScript preexistentes**: cuatro en `jiraMilestoneSync.ts` y uno en `routers.ts` (`estadoSII`); ninguno procede de esta remediación.
- Respaldo SHA-256 comprobado; base: **0** reglas SLA de Staffing 4687 y **1** registro de auditoría del saneamiento. Relectura Jira: tres hitos originales con estado de facturación **N/D**. Cambios revisados con `git diff --check` y análisis de secretos sin hallazgos.
- Verificación autenticada del detalle y Clásico en escritorio; el encabezado compartido se ajustó y revisó a 390 px para evitar desbordamiento de controles. No se afirmó evidencia de emisión ni se escribió en Jira/JSM.
