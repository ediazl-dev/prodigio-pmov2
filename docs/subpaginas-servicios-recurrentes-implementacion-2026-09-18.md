# Implementación de subpáginas de Servicios Recurrentes

**Fecha:** 18 de septiembre de 2026  
**Rama de trabajo:** `feat/subpaginas-servicios-recurrentes`  
**Alcance:** detalle del servicio recurrente y etapa JSM Setup

## Resultado

Se integró el diseño entregado para las páginas interiores sin cambiar los contratos tRPC, el esquema de base de datos ni las reglas financieras, documentales o JSM existentes. El trabajo se ejecutó por checkpoints sobre la línea base sincronizada y mantuvo las vistas Torre V2, Clásico y Lista.

## Detalle del servicio

El detalle se reorganizó como una ficha operativa única. Conserva el resumen contractual, señales accionables, pipeline de cinco etapas, plan de cobro y pestañas de evidencia. Las acciones de señales ahora navegan a la etapa correspondiente y el botón de cada cuota se identifica como revisión, no como edición directa.

Las métricas financieras permanecen separadas por moneda y por concepto: contratado, programado, facturado, cobrado, pendiente y vencido. Una cuota sin fecha se marca como falta de evidencia de fecha, independientemente de su estado financiero. Los documentos muestran nombre, tipo, estado, vigencia y validación disponibles; la mera existencia del archivo no se interpreta como validación.

La página expone errores de carga, permite reintentar lecturas y actualiza de manera coordinada el servicio y el dashboard consolidado. Los controles de edición continúan limitados a los roles autorizados.

## JSM Setup

JSM Setup se convirtió en una compuerta ordenada por decisión. El servidor sigue siendo la fuente de verdad mediante `readiness.canClose` y `readiness.blockers`. La derivación local sólo presenta los mismos requisitos; si existe discrepancia, la interfaz muestra literalmente los bloqueos del servidor.

Se preservaron las seis mutaciones existentes:

1. selección de plataforma;
2. creación explícita de proyecto JSM;
3. guardado de mappings;
4. ejecución de dry-run;
5. confirmación explícita de creación de issues;
6. cierre de la etapa.

Ninguna mutación se ejecuta automáticamente. El dry-run continúa sin crear issues y la creación sólo ocurre mediante confirmación explícita. La página conserva el flujo de creación o vinculación de Space existente, preflight, revalidación, desvinculación local, historial y enlaces de consulta.

El estado real de Camanchaca se presenta sin ocultar degradación: Space `CAMANSOP02`, Service Desk `365`, salud `warning`, 27 de 33 elementos vinculados y 6 cuotas pendientes. La falta de permisos SLA permanece como evidencia parcial; no se fabrican métricas.

## Compatibilidad y validación

| Control | Resultado |
|---|---:|
| Pruebas frontend recurrentes | 64 aprobadas |
| Pruebas backend JSM focales | 19 aprobadas |
| Matriz final combinada | 83 aprobadas |
| Build de producción | Exitoso |
| Errores TypeScript nuevos | 0 |
| Errores TypeScript heredados | 5, sin cambio |
| Mutaciones JSM preservadas | 6 hooks / 6 invocaciones explícitas |
| Escrituras Jira/JSM durante certificación | 0, confirmado en `audit_logs` |
| Esquema o migraciones | Sin cambios |

La revisión visual se efectuó con datos reales de Camanchaca en escritorio y móvil. El detalle no presenta recortes horizontales; el plan de cobro cambia a tarjetas en móvil. JSM Setup muestra guiones mientras carga para evitar métricas transitorias falsas, y luego presenta 2/5 pasos listos, 27/33 vinculados y 6 pendientes. La gestión del Space se puede colapsar sin perder acceso a sus acciones.

## Límites preservados

- No se reconcilian ni transforman montos.
- No se suman monedas distintas.
- No se interpreta una cuota programada como facturada.
- No se interpreta ausencia de evidencia como cumplimiento.
- No se escriben tickets de Jira/JSM automáticamente.
- El cierre depende exclusivamente de la validación backend.
