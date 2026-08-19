# Análisis feedback Gantt — captura producción 2026-08-19

## Fuente
- Captura FireShot del dashboard en producción (2026-08-19 01:10 UTC)
- Ruta: /projects/180002/executive-dashboard-v2

## Problemas observados en la captura

### 1. Tooltips insuficientes
- Los marcadores del Gantt sólo muestran `title` nativo del navegador (texto plano al hover).
- No hay información rica: fechas exactas, deriva en días, estado, peso, acta.

### 2. Precisión temporal y confusión de estados
- M01 y M02 aparecen "En riesgo" con marcador a la IZQUIERDA de la línea de corte (18-ago). Un hito cuya fecha Jira ya pasó sin acta debería ser VENCIDO, no "en riesgo".
- El usuario define: EN_RIESGO = probable que no se cumpla (futuro en peligro); VENCIDO = fecha ya pasó sin cumplirse. Son estados distintos y deben verse distintos.
- Hitos vencidos con marcador después de la línea punteada generan contradicción visual.

### 3. Fechas base vs. programadas poco claras
- El rombo de baseline y el marcador Jira no llevan etiquetas de fecha visibles.
- No se distingue visualmente qué fecha es la "base contractual" y cuál la "programada" sin hacer hover.

### 4. Registro de acta desvinculado del hito
- El formulario "Registrar acta real de aceptación" está al final de la tabla, con un <select> de hito.
- El usuario debe elegir manualmente el hito → riesgo de asociar el acta al hito equivocado.
- La carga debiera estar disponible POR HITO (botón/acción en cada fila).

## Reglas de negocio confirmadas por el usuario
- EN_RIESGO: hito futuro (fecha programada > corte) con probabilidad de incumplimiento.
- VENCIDO: hito cuya fecha programada ya pasó (<= corte) sin acta de aceptación.
- La línea punteada = fecha de corte del análisis; los marcadores a su izquierda ya debieron resolverse.

## Revisión del motor cardinal (classifyMilestoneTimeline)
- Actual: si hay acta → ACEPTADO; si cierre Jira <= hoy → PENDIENTE_ACTA (<=5d) o VENCIDO_SIN_ACTA (>5d); si no hay cierre y fecha Jira < hoy → EN_RIESGO; si no → COMPROMETIDO.
- Problema: un hito sin cierre Jira y fecha vencida se clasifica EN_RIESGO, pero el usuario lo considera VENCIDO.
- Corrección: fecha Jira < corte SIN acta y SIN cierre → VENCIDO_SIN_ACTA (o nuevo estado VENCIDO). EN_RIESGO sólo para hitos futuros con señal de riesgo (p.ej. cierre Jira sin acta dentro de ventana, o proximidad a vencer).
