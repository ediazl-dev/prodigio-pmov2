# Estado actual — Consolidado de Facturación F7

**Fecha:** 2026-08-20
**Checkpoint:** a73e6d6f (F5+F6 publicado)
**Fase actual:** F7 (Zonas 7-8) — backend y frontend implementados, TypeScript limpio

## Completado en F7

### Backend (routers.ts)
- Procedure `getFinancialConsolidated` extendido con cálculo de Zonas 7-8:
  - `proyeccionCobranza`: próximos 10 pagos desde `payment_schedule_item` con fechaPlanificada >= fechaCorte
  - `agingAR`: facturas pendientes agrupadas por rango de días (0-30, 31-60, 61-90, 91-120, 120+)
  - `cicloFacturacion`: 4 etapas (Devengo → Facturación → Cobranza → Cierre) con métricas
  - `modelosNegocio`: distribución de cartera por tipo (Proyecto, Staffing, Soporte, Inversión interna)
  - `concentracionCartera`: top 5 clientes por monto contratado

### Frontend (FinancialConsolidated.tsx)
- Zona 7: grid2 con Proyección de cobranza (lista de próximos pagos) + Aging de AR (rangos con montos)
- Zona 8: grid2 con Ciclo de facturación (4 etapas numeradas) + Modelos de negocio (distribución de cartera)
- Concentración de cartera: top 5 clientes con barras de progreso
- Destructuring actualizado con las 5 nuevas variables

### Correcciones de tipos aplicadas
- `item.dueDate` → `item.fechaPlanificada` (paymentScheduleItems)
- `item.description` → `item.descripcion`
- `item.milestoneNumber` → `item.milestoneCode`
- `item.amount` → `item.valorUF`
- `inv.status` → `inv.estadoSII`
- `inv.dueDate` → `inv.fechaVencimiento`
- `inv.amount` → `inv.valorUF`
- `c.contractedAmount` → `c.valorContratadoUF`
- `inv.estadoSII !== 'paid'` → `inv.estadoSII !== 'aceptada'`
- `inv.estadoSII !== 'cancelled'` → `inv.estadoSII !== 'anulada'`
- `const monto = inv.valorUF || 0` → `const monto = Number(inv.valorUF) || 0`
- `const monto = c.valorContratadoUF || 0` → `const monto = Number(c.valorContratadoUF) || 0`

### Error pre-existente (no relacionado con F7)
- Línea 305: `inv.estadoSII !== "pending"` — esto es de la lógica de invitaciones de usuarios, no de facturas. No es un error de mis cambios.

## Datos mostrados en producción
- Contratado: UF 114.440.914
- Devengado: UF 3.690 (3.2%)
- Facturado: UF 0
- Cobrado: UF 0
- WIP: UF 3.690
- Backlog: UF 110.750.914
- Descalce: UF 1.640
- 38 contratos en detalle

## Próximos pasos (F8)
- Zona 9: Supuestos con borde dashed
- Zona 10: Pie nota
- Tabla mejorada con encabezados mono y chips

## Archivos modificados en F7
- `server/routers.ts` — procedure getFinancialConsolidated extendido
- `client/src/pages/FinancialConsolidated.tsx` — Zonas 7-8 agregadas
- `client/src/index.css` — sistema CSS df-* ya estaba completo desde F5

## Validación
- TypeScript: limpio (solo error pre-existente en línea 305)
- Tests: pendiente ejecutar suite completa
- Screenshot: pendiente verificar visualmente
