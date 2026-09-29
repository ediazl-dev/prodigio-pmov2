# Política contractual y remediación Staffing 4727

**Fecha:** 29-sep-2026  
**Servicio:** `2070001` — Deal `4727` — Consalud — Staffing Arquitectura  
**Principio:** la aplicabilidad se deriva del tipo de servicio y de la evidencia contractual; nunca de una plantilla genérica.

## Decisión funcional

Para este servicio Staffing:

- **Sí aplican:** gestión de capacidad y horas, actividades asignadas por el cliente, reporte mensual, ventana de revisión/aprobación y feedback/NPS de gestión.
- **No aplican:** SLA de incidentes, tiempos de respuesta/resolución, DR, cobertura 24x7, parcheo y on-call.
- **Facturación:** permanece en el plan contractual de seis cuotas UF 195 y se observa desde los hitos Jira ya existentes. No se replica como actividad del plan ni se crean hitos duplicados en `CONSALOP02`.
- **JSM:** plan y facturación quedan como `external_reference`; el Space puede conservarse como vínculo, pero no exige mappings ni creación masiva.

## Corrección aplicada

| Dimensión | Antes | Después |
|---|---:|---:|
| Actividades del plan | 31 | 24 |
| SLA configurados | 4 | 0 |
| Mappings JSM activos | 2 | 0 |
| Cuotas contractuales | 6 × UF 195 | 6 × UF 195, sin cambios |
| Creación Jira/JSM ejecutada | 0 | 0 |

El plan corregido contiene cuatro controles por cada uno de los seis meses:

1. Consolidación de horas y capacidad.
2. Reporte mensual de servicio.
3. Revisión y aprobación del reporte.
4. Feedback/NPS como control de calidad, explícitamente separado de SLA.

Los plazos del reporte y de revisión se calculan en días hábiles. Para futuras regeneraciones, el sistema extrae ambos valores del SoW y **falla cerrado** si no logra verificarlos.

## Guardrails permanentes

- Un alta o cambio a `staffing` deja plan y facturación como referencias externas por defecto.
- JSM Setup permite definir por categoría `create_in_linked_space` o `external_reference` con justificación auditable.
- Sólo las categorías activas exigen mapping y participan del dry-run.
- Un ítem `facturacion` dentro del plan se excluye si ya existe un plan de cuotas.
- En Staffing se rechazan ítems manuales de facturación, SLA o cobertura y se rechaza persistir SLA no vacío.
- La regeneración Staffing exige SoW adjunto, valida sus cláusulas y reemplaza plan + SLA en una transacción.
- La remediación de datos es idempotente, requiere `--apply` y registra auditoría.

## Verificación real

- Tipo: `staffing`.
- Plan: 24 ítems, meses 1–6, sólo `tarea_programada` e `informe_mensual`.
- Controles prohibidos detectados: 0.
- SLA: 0.
- Mappings activos: 0.
- Readiness JSM: `canClose=true`, `totalApplicable=0`, `totalUnsynced=0`.
- Facturación Jira: seis períodos encontrados; estado leído desde los hitos existentes, sin escritura Jira.
- `CONSALOP02`: sin issues creados por esta remediación.
- Respaldo previo: `/home/ubuntu/backups/prodigio-pmo/2026-09-29-staffing-4727-remediation/` con checksum SHA-256.

## Certificación

- 35 pruebas focales de política, sincronización y compuerta aprobadas; el bloque ampliado de router/UI aprobó 90 pruebas.
- Suite determinista integral: **1.105 aprobadas, 19 omitidas**.
- Build productivo: exitoso.
- TypeScript: permanecen sólo los cinco errores heredados ya conocidos; esta remediación no agregó errores.
- Validación visual: Plan de Trabajo y JSM Setup revisados en escritorio y móvil.
- Integridad: checksum del respaldo válido, un único registro de auditoría de remediación y cero patrones de secretos en el diff.
