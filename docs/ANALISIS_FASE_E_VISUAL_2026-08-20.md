# Análisis Fase E — Fidelidad Visual Total (Consola de Gobierno PMO)

## Elementos visuales faltantes identificados

### 1. Barra proporcional de triage (Zona 0)
- **HTML**: `<div class="triage-barra">` con 5 segmentos `<i>` de colores
- **CSS**: `.triage-barra{height:6px;display:flex}` + `.triage-barra i{display:block;height:100%}`
- **Datos**: ancho de cada segmento = % de proyectos por estado

### 2. Pie de métricas globales (Zona 0)
- **HTML**: `<div class="triage-pie">` con 6 spans
- **CSS**: `.triage-pie{display:flex;gap:26px;padding:13px 20px;border-top:1px solid var(--linea-suave);background:var(--panel-2);flex-wrap:wrap;font-size:12px;color:var(--texto-2)}`
- **Métricas**: Exposición UF, P0 vencidas, PRD vencidos, deteriorados, mejoraron, total proyectos

### 3. Motivo ejecutivo con cifra en negrita (Zona 2)
- **HTML**: `<p class="motivo"><b>4 de 6 hitos exigibles vencidos.</b> Costo ejecutado al 151,9%...</p>`
- **CSS**: `.pinfo .motivo{font-size:12.5px;color:var(--texto-2);margin-top:5px;line-height:1.45}` + `.pinfo .motivo b{color:var(--texto);font-weight:500}`

### 4. Señales de mora (Zona 2)
- **HTML**: `<div class="meta"><span class="mora">◉ Plan de recuperación vencido hace 3 días</span>...</div>`
- **CSS**: `.pinfo .meta{display:flex;gap:14px;margin-top:7px;font-size:11px;color:var(--texto-3);flex-wrap:wrap}` + `.pinfo .meta .mora{color:var(--rojo)}`

### 5. Grid de fila exacto (Zona 2)
- **CSS**: `.fila{display:grid;grid-template-columns:58px minmax(0,1fr) 96px 104px 132px 40px;gap:18px;align-items:center}`
- **Columnas**: 58px PA | 1fr info | 96px IGE | 104px UF | 132px PM | 40px →

## Estado actual vs. requerido

| Elemento | Estado actual | Requerido |
|----------|---------------|-----------|
| Barra proporcional | ❌ Ausente | 6px height con segmentos de colores |
| Pie de métricas | ❌ Ausente | 6 métricas con formato específico |
| Motivo ejecutivo | ⚠️ Texto plano | Cifra en negrita + texto secundario |
| Señales de mora | ⚠️ Implementado parcialmente | Chips con ◉ y color rojo para mora |
| Grid de fila | ⚠️ Simplificado | 6 columnas exactas con gap 18px |
