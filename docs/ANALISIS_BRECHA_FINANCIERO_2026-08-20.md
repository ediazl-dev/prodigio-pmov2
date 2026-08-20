# Análisis de brecha — Vista financiera actual vs. HTML de referencia

## Fecha: 2026-08-20
## Autor: Manus AI

---

## 1. Comparación visual

### Lo que implementé (captura PDF):
- **Zona 0 (Cabecera):** Título "Cartera al 20 de agosto de 2026", fecha de corte, UF del día [POR CONFIRMAR]
- **Zona 1 (Métricas globales):** 4 tarjetas grandes (CONTRATADO UF 114.4K, DEVENGADO UF 3.7K, FACTURADO UF 0, COBRADO UF 0)
- **Zona 2 (Embudo):** Barra horizontal simple con 4 segmentos de color
- **Zona 3 (Brechas):** 4 tarjetas pequeñas (WIP UF 3.7K, AR UF 0, BACKLOG UF 110.8K, DESCALCE UF -1.6K)
- **Zona 4 (Detalle):** Tabla con 38 contratos, columnas: Contrato, Cliente, Contratado, Devengado, Facturado, Cobrado, WIP

### Lo que el HTML de referencia define (14 zonas):
- **Zona 0 (Sidebar):** Navegación lateral con logo, grupos de menú, badges
- **Zona 1 (Cabecera):** Eyebrow "CONSOLIDADO DE FACTURACIÓN", H1 "Cartera al 20 de agosto de 2026", subtítulo, acciones (Exportar comité, selector de periodo)
- **Zona 2 (Barra unidad):** Panel con borde izquierdo ámbar, texto "Todas las cifras en UF", alerta "UF del día: [POR CONFIRMAR — Banco Central]", derecha "38 contratos · 38 activos · 0 cerrados"
- **Zona 3 (Lectura del periodo):** Panel grande con gradiente cyan, título "Lectura del periodo", H2 con texto destacado en rojo, 3 columnas de análisis
- **Zona 4 (Embudo):** Panel con título "Embudo de facturación", nota derecha "Cifras en UF · % sobre contratado", 4 etapas con barras de progreso y porcentajes, brechas entre etapas con flechas y montos
- **Zona 5 (Tarjetas brecha):** Grid de 4 tarjetas con borde superior de color (rojo/ámbar), etiqueta mono, valor grande mono, descripción, pie con métricas
- **Zona 6 (Grid2 — Proyección + Aging):** Dos cards lado a lado: proyección de cobranza por mes (barras apiladas) y aging de AR (5 columnas)
- **Zona 7 (Grid2 — Ciclo + Modelos):** Dos cards: ciclo de facturación (barras horizontales con meta) y modelos de negocio (3 columnas)
- **Zona 8 (Concentración):** Card con lista de clientes, barras de concentración, porcentajes
- **Zona 9 (Supuestos):** Panel con borde dashed, lista de supuestos en 2 columnas
- **Zona 10 (Pie nota):** Panel con borde dashed, nota final

---

## 2. Brechas identificadas

### Brecha 1: Diseño visual incompleto
- **Problema:** Mi implementación usa un diseño simple con tarjetas blancas sobre fondo oscuro. El HTML de referencia usa un sistema de diseño completo con paneles, bordes de color, gradientes, tipografía mono para números, y una paleta específica.
- **Impacto:** La vista no se ve profesional ni coincide con el estándar de la Consola de Gobierno.

### Brecha 2: Zonas faltantes (5-10)
- **Problema:** Solo implementé las zonas 0-4. Faltan las zonas 5-10 que contienen análisis críticos: proyección de cobranza, aging de AR, ciclo de facturación, modelos de negocio, concentración de cartera, supuestos y pie nota.
- **Impacto:** La vista es solo un resumen básico, no un dashboard ejecutivo completo.

### Brecha 3: Embudo mal diagramado
- **Problema:** Mi embudo es una barra horizontal simple con 4 segmentos. El HTML de referencia define un embudo con 4 etapas separadas, cada una con su propia barra de progreso, porcentaje, y brechas entre etapas con flechas y montos.
- **Impacto:** No se visualizan las brechas entre etapas (WIP, AR, BACKLOG) de forma clara.

### Brecha 4: Tarjetas de brecha incompletas
- **Problema:** Mis tarjetas de brecha son simples con un valor y una etiqueta. El HTML de referencia define tarjetas con borde superior de color, etiqueta mono, valor grande mono, descripción, y pie con métricas.
- **Impacto:** No se comunica la severidad ni el contexto de cada brecha.

### Brecha 5: Tabla de detalle sin formato
- **Problema:** Mi tabla es simple con columnas básicas. El HTML de referencia define una tabla con encabezados mono, números tabulares, hover, y chips de estado.
- **Impacto:** La tabla no es legible ni profesional.

---

## 3. Plan de corrección (Fases F5-F8)

### Fase F5: Sistema de diseño CSS (df-*)
- Crear el sistema de clases CSS df-* replicando el HTML de referencia
- Variables CSS: --df-fondo, --df-panel, --df-texto, etc.
- Tipografía: DM Sans para texto, JetBrains Mono para números
- Componentes: paneles, tarjetas, embudo, brechas, tabla

### Fase F6: Zonas 0-4 corregidas
- **Zona 0:** Sidebar con navegación (replicar el patrón de la Consola)
- **Zona 1:** Cabecera con eyebrow, H1, subtítulo, acciones
- **Zona 2:** Barra unidad con borde ámbar y alerta UF
- **Zona 3:** Lectura del periodo con gradiente cyan y 3 columnas
- **Zona 4:** Embudo con 4 etapas, barras de progreso, brechas con flechas

### Fase F7: Zonas 5-8 implementadas
- **Zona 5:** Tarjetas de brecha con borde superior de color y pie con métricas
- **Zona 6:** Grid2 con proyección de cobranza y aging de AR
- **Zona 7:** Grid2 con ciclo de facturación y modelos de negocio
- **Zona 8:** Concentración de cartera con barras

### Fase F8: Zonas 9-10 y tabla mejorada
- **Zona 9:** Supuestos con borde dashed y 2 columnas
- **Zona 10:** Pie nota con borde dashed
- **Tabla:** Encabezados mono, números tabulares, hover, chips de estado

---

## 4. Datos necesarios para las zonas 5-10

### Zona 6 (Proyección de cobranza):
- Necesita: `payment_schedule_item` con fechas de pago planificadas
- Cálculo: agrupar por mes, sumar montos planificados vs. reales

### Zona 6 (Aging de AR):
- Necesita: `invoice` con fechas de emisión y vencimiento, `payment` con fechas de pago
- Cálculo: buckets de 0-30, 31-60, 61-90, 91-120, >120 días

### Zona 7 (Ciclo de facturación):
- Necesita: `contract` con fechas de inicio y fin, `revenue_event` con fechas de devengo
- Cálculo: días promedio entre hito aceptado → factura emitida → pago recibido

### Zona 7 (Modelos de negocio):
- Necesita: `contract` con tipo de modelo (SaaS, proyecto, servicio)
- Cálculo: agrupar por modelo, sumar contratado y devengado

### Zona 8 (Concentración):
- Necesita: `contract` con cliente y monto contratado
- Cálculo: top 5 clientes por monto contratado, porcentaje del total

---

## 5. Priorización

| Prioridad | Zona | Razón |
|-----------|------|-------|
| P0 | F5 (CSS) | Base para todo lo demás |
| P0 | F6 (Zonas 0-4) | Corrige lo que ya existe pero está mal |
| P1 | F7 (Zonas 5-8) | Análisis críticos para el comité |
| P2 | F8 (Zonas 9-10) | Complementarios pero no críticos |

---

## 6. Estimación de esfuerzo

| Fase | Esfuerzo | Dependencias |
|------|----------|--------------|
| F5 | 2 horas | Ninguna |
| F6 | 3 horas | F5 |
| F7 | 4 horas | F5, F6, datos de payment_schedule_item e invoice |
| F8 | 2 horas | F5, F6 |

**Total:** 11 horas de desarrollo

---

## 7. Riesgos

1. **Datos insuficientes para Zonas 6-8:** Si no hay datos en `payment_schedule_item`, `invoice`, `payment`, las zonas 6-8 mostrarán `[POR CONFIRMAR]` o valores en 0.
2. **Complejidad del embudo:** El embudo del HTML de referencia es complejo (4 etapas con barras y brechas). Puede requerir varias iteraciones para que coincida exactamente.
3. **Responsive:** El HTML de referencia tiene breakpoints para 1280px y 900px. Debo asegurar que la vista sea usable en pantallas pequeñas.

---

## 8. Próximos pasos

1. **Aprobación del usuario:** Confirmar que este plan es correcto y que debo proceder con F5-F8.
2. **Datos de prueba:** Verificar que hay datos suficientes en `payment_schedule_item`, `invoice`, `payment` para las zonas 6-8.
3. **Implementación:** Proceder con F5 (CSS), luego F6 (Zonas 0-4), luego F7 (Zonas 5-8), luego F8 (Zonas 9-10).
