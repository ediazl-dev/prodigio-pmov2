# Análisis Zonas 3-6 — Consola de Gobierno PMO

## Zona 3: Decisiones que te esperan
- Card con cabecera: "Decisiones que te esperan" + tag "N pendientes · M vencidas"
- Lista de decisiones (.pend) con:
  - Indicador de color (.ind): rojo=vencida, ámbar=hoy/próxima, azul=sin plazo
  - Texto (.txt): título en negrita + detalle (proyecto · código · impacto UF)
  - Plazo (.plazo): "Venció DD MMM" (rojo), "Vence hoy" (ámbar), "DD MMM" (normal), "Sin plazo" (gris)

## Zona 4: Dónde se repite el daño
- Card con cabecera: "Dónde se repite el daño" + tag "Causa raíz agregada · N proyectos"
- Lista de causas (.causa) con:
  - Top: nombre de causa + contador (.n)
  - Barra de proporción (.barra): ancho = % de proyectos afectados, color por severidad
  - Detalle (.det): métricas específicas (UF expuestas, deriva media, proyectos afectados)
- Pie de card: insight estructural (texto-3)

## Zona 5: Higiene de gobierno
- Card con cabecera: "Higiene de gobierno del portafolio" + tag "Condiciones que invalidan cualquier reporte"
- Grid de 4 contadores (.hig) con:
  - Número grande (.n): mal=rojo, tibio=ámbar
  - Etiqueta (.et): descripción del problema
  - Acción (.accion): enlace "→"
- Pie de card: hallazgo estructural en negrita + texto-2

## Zona 6: Resto del portafolio
- Details/summary colapsable (.resto)
- Summary: chip "Estables" + "N proyectos sin acción requerida" + criterio (IGE ≥ 85 · sin hitos vencidos · evidencia al día)
- Tabla: Proyecto | Cliente | IGE | Δ | Próximo hito | PM
- Fila final: "…y N proyectos más en la misma condición."

## Datos requeridos del procedure portfolioConsole

### Para Zona 3 (Decisiones):
- decisiones: array de { id, titulo, proyecto, codigo, impactoUf, plazo, estadoPlazo, colorIndicador }
- Contadores: totalPendientes, totalVencidas

### Para Zona 4 (Causa raíz):
- causas: array de { nombre, contador, porcentaje, colorBarra, metricas[], insight }
- totalProyectosAnalizados

### Para Zona 5 (Higiene):
- higiene: { sinMinuta3Semanas, sinBaseline, sinActaCierre, bajaConfiabilidad }
- hallazgoEstructural: { titulo, descripcion }

### Para Zona 6 (Estables):
- estables: array de { proyecto, cliente, ige, delta, proximoHito, pm }
- totalEstables, criterio
