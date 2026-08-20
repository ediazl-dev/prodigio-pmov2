# Estado del Consolidado de Facturación — 2026-08-20

## Completado ✅

### F5: Sistema de diseño CSS df-*
- Variables CSS: --df-fondo, --df-panel, --df-texto, --df-magenta, --df-cyan, etc.
- Tipografía: DM Sans (sans) + JetBrains Mono (mono)
- Componentes: sidebar, cabecera, barra unidad, lectura periodo, embudo, brechas, tarjetas, tabla, chips
- Responsive: breakpoints 1280px y 900px
- Accesibilidad: prefers-reduced-motion

### F6: Zonas 0-4 corregidas
- **Zona 0 (Sidebar):** Logo Prodigio, navegación con "Consolidado Facturación" activo, pie con versión
- **Zona 1 (Cabecera):** Eyebrow "CONSOLIDADO DE FACTURACIÓN", título "Cartera al 2026-08-20", selector de periodo, botón "Exportar comité"
- **Zona 2 (Barra unidad):** "Todas las cifras en UF", UF del día [POR CONFIRMAR — Banco Central], conteo de contratos
- **Zona 3 (Lectura del periodo):** Título con descalce en rojo, 3 columnas (Contratado vs. Devengado, Facturación y Cobranza, Descalce y Riesgo)
- **Zona 4 (Embudo):** 4 etapas (Contratado → Devengado → Facturado → Cobrado) con barras de progreso, brechas entre etapas (WIP, AR, Backlog) con flechas, conversiones y dueños
- **Zona 5 (Tarjetas de brecha):** 4 tarjetas (WIP, AR, Backlog, Descalce) con borde superior de color, valores grandes, descripciones, pie con métricas
- **Zona 6 (Detalle por contrato):** Tabla con 38 contratos, columnas (Contrato, Cliente, Contratado, Devengado, Facturado, Cobrado, WIP, Estado), chips de estado

## Datos reales mostrados
- Contratado: UF 114.440.914
- Devengado: UF 3.690 (3.2%)
- Facturado: UF 0
- Cobrado: UF 0
- WIP: UF 3.690
- Backlog: UF 110.750.914
- Descalce: UF 1.640

## Validación
- TypeScript: limpio (0 errores)
- Pruebas: 489 aprobadas, 8 fallidas (pre-existentes: Jira API y Pipedrive API timeouts), 3 skipped
- Proyectos de prueba: 8 eliminados de la BD

## Checkpoint
- **Versión:** 15572036
- **URL:** https://pmo.prodigio.tech/admin/financial-consolidated

## Próximos pasos (F7-F8)
1. **F7:** Zonas 7-8 — proyección de cobranza, aging de AR, ciclo de facturación, modelos de negocio, concentración de cartera
2. **F8:** Zonas 9-10 — supuestos con borde dashed, pie nota, tabla mejorada

## Notas
- La página está fuera del layout de administración (no tiene sidebar de admin) — decisión pendiente del usuario
- El menú lateral muestra "Consolidado Facturación" pero la página es independiente
- Los datos de facturado y cobrado son 0 porque no hay integración SII/banco (correcto según especificación)
