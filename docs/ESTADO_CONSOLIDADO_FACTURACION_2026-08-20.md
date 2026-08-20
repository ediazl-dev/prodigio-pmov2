# Estado del Consolidado de Facturación — 2026-08-20

## Completado

### F5: Sistema de diseño CSS df-*
- Variables CSS: --df-fondo, --df-panel, --df-panel-2, --df-linea, --df-texto, --df-texto-2, --df-texto-3, --df-cyan, --df-verde, --df-ambar, --df-rojo, --df-azul
- Tipografía: DM Sans (texto), JetBrains Mono (números, etiquetas)
- Componentes: sidebar, cabecera, barra unidad, lectura periodo, embudo, brechas, tarjetas, tabla, chips, supuestos, pie nota
- Responsive breakpoints: 1280px, 900px
- Accesibilidad: prefers-reduced-motion

### F6: Zonas 0-4 corregidas
- Zona 0 (Sidebar): Logo Prodigio, navegación con "Consolidado Facturación" activo, pie con versión
- Zona 1 (Cabecera): Eyebrow "CONSOLIDADO DE FACTURACIÓN", título "Cartera al 2026-08-20", selector de periodo, botón "Exportar comité"
- Zona 2 (Barra unidad): "Todas las cifras en UF", UF del día [POR CONFIRMAR — Banco Central], conteo de contratos
- Zona 3 (Lectura del periodo): Título con descalce en rojo, 3 columnas (Contratado vs. Devengado, Facturación y Cobranza, Descalce y Riesgo)
- Zona 4 (Embudo): 4 etapas (Contratado → Devengado → Facturado → Cobrado) con barras de progreso, brechas entre etapas (WIP, AR, Backlog) con flechas, conversiones y dueños
- Zona 5 (Tarjetas de brecha): 4 tarjetas (WIP, AR, Backlog, Descalce) con borde superior de color, valores grandes, descripciones, pie con métricas
- Zona 6 (Detalle por contrato): Tabla con 38 contratos, columnas (Contrato, Cliente, Contratado, Devengado, Facturado, Cobrado, WIP, Estado), chips de estado

### F7: Zonas 7-8
- Zona 7: Proyección de cobranza (próximos 10 pagos desde payment_schedule_item) + Aging de AR (facturas pendientes por rango de días)
- Zona 8: Ciclo de facturación (4 etapas: Devengo → Facturación → Cobranza → Cierre) + Modelos de negocio (distribución de cartera por tipo) + Concentración de cartera (top 5 clientes)

### F8: Zonas 9-10
- Zona 9 (Supuestos): 4 supuestos con borde dashed explicando las limitaciones actuales (UF del día no disponible, facturación/cobranza sin integración, proyección basada solo en Tanner, aging sin facturas)
- Zona 10 (Pie nota): Nota explicativa sobre la generación automática desde Google Sheets y Jira, con contacto al equipo de Administración

## Datos reales mostrados
- Contratado: UF 114.440.914
- Devengado: UF 3.690 (3.2%)
- Facturado: UF 0
- Cobrado: UF 0
- WIP: UF 3.690
- Backlog: UF 110.750.914
- Descalce: UF 1.640

## Validación
- TypeScript: limpio (solo error pre-existente en línea 305 de invitaciones)
- Pruebas: 488 aprobadas, 9 fallidas (pre-existentes de Jira/Pipedrive), 3 skipped
- Proyectos de prueba limpiados: 5 eliminados (IDs 2190001-2190005)
- todo.md: 0 ítems pendientes

## Checkpoints
- F5+F6: a73e6d6f
- F7+F8: pendiente

## Próximos pasos
1. Guardar checkpoint F7+F8
2. Implementar F2 (integraciones externas): UF Banco Central, SII/DTE, banco
3. Implementar F9 (exportación comité): PDF/Excel con el resumen del portafolio
