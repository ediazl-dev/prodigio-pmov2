# D10 — Verificación visual

## 17 de septiembre de 2026

La primera captura en `/servicios-recurrentes` mostró el esqueleto de carga mientras la sesión se inicializaba. Una segunda captura, ya con la aplicación cargada, confirmó que esa URL no corresponde a una ruta registrada: el layout autenticado se renderiza correctamente, pero el contenido muestra `404 Page Not Found`.

Este resultado no se considera una regresión del Dashboard V2. Antes de repetir capturas se debe obtener la ruta efectiva desde `client/src/App.tsx` o desde el destino del menú lateral y validar allí escritorio y móvil.

La ruta efectiva es `/recurring-services`. En escritorio, a 1440 × 1000, la Torre V2 presentó los tres servicios productivos, filtros, salud, calidad, finanzas por moneda, reportes, formalidad y matriz priorizada sin solapamientos ni pérdida de contraste. La tarjeta de frescura mostró la última captura JSM como N/D —consistente con los tres servicios sin vínculo— y el historial registró la actualización diaria con cero éxitos, cero parciales, cero errores y tres omitidos.

En móvil, a 390 × 844, las secciones se apilaron en una sola columna, los botones de actualización permanecieron accesibles, las métricas conservaron legibilidad y no se observó desborde horizontal en el documento completo. La vista mantiene la degradación explícita N/D y no convierte la ausencia de configuración JSM en cumplimiento.
