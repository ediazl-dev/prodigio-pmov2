# Claro Ecuador 2397 — JSM Setup cerrado y Ejecución habilitada

**Fecha:** 21 de octubre de 2026. **PMO:** 3090001. **Deal:** 2397. **Base:** cc09bac8.

## Resultado aplicado

Se cerró `jira_setup` mediante el procedimiento nativo `recurringServices.closeJiraSetupStage`, con readiness válido, sin saltar sus validaciones. El servicio permanece **activo**, pasa a **ejecucion**, esa etapa está **in_progress** y `cierre` permanece **locked**. No se completaron actividades ni se dio por terminado el contrato.

Se preservaron las 32 actividades existentes de **MDSCE2937-1 a -32** y sus tipos heterogéneos. Se asociaron las 12 cuotas a los originales financieros existentes **MDS2937-56 a -67**, en correspondencia mensual 1–12. Esos hitos están en el proyecto Jira histórico MDS2937; no fueron movidos a MDSCE2937. La plataforma los reutiliza como referencias, sin exigir que se creen copias en el Space operativo.

Ambas categorías quedaron en `external_reference`: reutilización de registros ya existentes, no abandono de gestión. Los mappings anteriores de creación se conservaron como superseded. El listado de consulta ahora incluye tanto actividades como hitos referenciados. La compuerta quedó sin bloqueadores ni elementos por crear/vincular.

## Causa del bloqueo

El mapping de trabajo exigía `Email request`, pero 12 actividades previamente creadas tenían otro tipo legítimo. El mapping financiero `Purchase request with approval` no permitía establecer `duedate`; el intento anterior devolvió HTTP400 para las 12 cuotas. Repetir el dry-run o cambiar tipos al azar no resolvía el origen.

Antes de crear otra serie se encontraron 12 hitos del mismo Deal ya existentes en MDS2937, sin propietarios en las tablas de cuotas/actividades PMO. Se verificaron sus claves, proyecto, Deal y mes mediante GET autenticado.

## Preservación y evidencia

No se realizó ningún POST, PUT o DELETE Jira. No se reconciliaron los importes o fechas históricos de Jira con la programación PMO. Se preservaron cuotas, montos, monedas, estados, plan, documentos, artefactos y decisiones de validación. La programación PMO conserva USD145.500, doce cuotas de USD12.125 y sus fechas vigentes.

Los textos históricos de Jira contienen cifras que no son uniformes entre resumen y descripción; no se sustituyeron por el monto PMO ni se tomaron como prueba fiscal. Las 12 cuotas permanecen **N/D en emisión**: ninguna tiene estado financiero explícito acreditado. `FINALIZADA` no equivale a factura. El cierre técnico de Setup tampoco acredita entrega, aceptación, pago o cumplimiento de SLA.

## Trazabilidad y certificación

- Script selectivo/idempotente: `scripts/readyClaro2397.ts`; actor PMO administrador verificado.
- Respaldo privado: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-claro-2397-ready/before.json`, SHA-256 verificado; resultado `after.json` con conservación aprobada.
- Auditoría: política JSM, cierre de etapa nativo y `claro2397_setup_ready_existing_references`.
- 1.241 pruebas aprobadas y 20 omitidas; build exitoso; los mismos cinco errores TypeScript heredados, sin deuda nueva.
- Staffing 4687 cerrado conserva su huella y datos intactos.
- Vista previa: cabecera «Etapa 4 de 5 · Ejecución», «JSM Setup Cerrada 21-10-2026» y botón «Continuar Ejecución».

La revisión del dashboard detectó un análisis del 30 de septiembre que afirmaba incorrectamente cero facturación y cuotas vencidas sin facturar. Se invalida su uso vigente y su reutilización desde cache cuando es anterior a `jsmSyncPolicyUpdatedAt`, con una regla pura cubierta por cuatro regresiones. La historia no se borra y no se generó un nuevo análisis. La verificación API confirma `obsolete=true`, un análisis histórico conservado y ningún abstract/dimensión antiguos devueltos como vigentes. La pantalla de Ejecución permanece accesible para operar; N/D no se convierte en deuda o cero facturado.

El cambio de datos ya fue aplicado en la base compartida. El ajuste de listado de actividades referenciadas se entrega en checkpoint WebDev; publicación mediante su UI cuando corresponda.
