# Mensaje contextual de exigencias ejecutivas

**Fecha:** 22 de septiembre de 2026  
**Alcance:** Dashboard Ejecutivo v2 de todos los proyectos con baseline aprobado.

## Problema corregido

El dashboard mostraba **“0 abierta(s)”** y **“Sin exigencias registradas”** cuando no existían obligaciones de comité persistidas. En un proyecto crítico, esta formulación podía interpretarse como ausencia de problemas o conformidad, aunque existieran hitos contractuales pendientes, gatillos activos u otras señales de exposición.

## Regla de presentación

La salud ejecutiva y la cobertura de gobierno ahora se muestran como dimensiones distintas. Cuando no existen exigencias formalizadas, la interfaz conserva el valor real —cero registros—, pero lo contextualiza según el estado ejecutivo:

| Estado ejecutivo | Presentación sin exigencias |
|---|---|
| `CRITICO` o `ROJO` | **Brecha de gobierno — sin exigencias formalizadas** |
| `NARANJO` o `AMARILLO` | **Revisión de gobierno pendiente** |
| `VERDE` u otro estado no degradado | **Sin exigencias de comité formalizadas** |

El mensaje declara expresamente que la ausencia de exigencias **no significa que el proyecto esté conforme** y muestra únicamente señales observadas disponibles, como hitos contractuales pendientes o demorados y gatillos ejecutivos activos. No convierte esas señales automáticamente en una exigencia.

## Alcance del contador

El contador incluye exclusivamente decisiones de comité persistidas con responsable, plazo y criterio verificable de cierre. No incluye hitos contractuales, riesgos, backlog, issues Jira ni compromisos. La formalización continúa siendo una decisión humana de comité y permanece restringida a los roles Admin y PMO.

## Validación

PMO-2670001 fue validado en el preview autenticado. El proyecto aparece en estado **CRÍTICO** y, en lugar de “0 abiertas”, muestra **BRECHA DE GOBIERNO**, junto con cuatro hitos contractuales pendientes o demorados y dos gatillos ejecutivos activos. La sección Exigencias repite el contexto, explica el alcance del contador y ofrece la acción **Revisar y formalizar exigencia** a usuarios autorizados.

La certificación automatizada aprobó **20 pruebas focales** y **870 pruebas deterministas**; el build productivo finalizó correctamente. La suite integral omitió únicamente diecinueve pruebas declaradas como live/opt-in. Persisten los cinco errores TypeScript heredados ya documentados, sin errores nuevos introducidos por este ajuste.
