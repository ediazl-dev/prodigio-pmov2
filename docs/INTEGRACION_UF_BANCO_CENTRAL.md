# Integración UF del día — Fuentes y credenciales (2026-08-21)

## Objetivo
Reemplazar el stub [POR CONFIRMAR — Banco Central] del Consolidado de Facturación con el valor real de la UF del día, persistiendo en la tabla `uf_value` (fecha, valorCLP, fuente).

## Fuente principal: findic.cl (FUNCIONA, sin autenticación) — IMPLEMENTADA
- URL: https://findic.cl/api/uf
- Método: GET, sin credenciales, gratuito
- Respuesta JSON: { "codigo":"uf", "serie":[ {"fecha":"2026-08-20","valor":40859.28}, ... ] }
- Verificado 2026-08-20: UF del día = $40.859,28 CLP
- La serie viene ordenada descendente (primero el día más reciente)

## Fuente secundaria: API Banco Central de Chile (BDE Siete) — TOKEN VERIFICADO PERO NO ALMACENABLE
- Endpoint REST: https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?token={TOKEN}&function=GetSeries&timeseries={SERIE}&firstdate=YYYY-MM-DD&lastdate=YYYY-MM-DD
- **CÓDIGO DE SERIE UF DIARIA CORRECTO: F073.UFF.PRE.Z.D** (con doble F — "UFF")
  - El código F073.UF.PRE.Z.D (una F) da error -50 "internal error" — NO USAR
  - Fuente del código: repo airarrazaval/bcchapi, src/series/series.ts → SERIES.PRICES.UF
  - Las fechas en la respuesta vienen como indexDateString en formato DD-MM-YYYY
- Usuario registrado: ediazl@prodigio.tech
- Token renovado por Keno (2026-08-20): $2a$10$dvRriOu6TnVa5DsgB1EX2erST/Et1XHWDZTuNod7lfu.B1U9iRJ0m (60 caracteres)
- VERIFICADO con curl: Codigo 0 Success, UF 18-08=40856.64, 19-08=40857.96, 20-08=40859.28
- **PROBLEMA CONFIRMADO: el sistema de secretos de Manus trunca el token a 30 caracteres**
  - Valor almacenado: "a0/Et1XHWDZTuNod7lfu.B1U9iRJ0m" (30 chars)
  - Análisis: stored[2:] == real[32:] — los primeros 32 chars se perdieron
  - 3 intentos de guardado (2 con value explícito, 1 con input manual) — todos truncaron a 30 chars
  - El test server/ufService.test.ts falla con -5 (invalid credentials) por el token truncado
- SOLUCIÓN TEMPORAL: findic.cl como fuente principal (sin token). BCCh queda como fallback deshabilitado hasta que el sistema de secretos soporte tokens de 60+ chars.
- El token tiene vigencia 1 año, renovable en si3.bcentral.cl → Mi Cuenta → ApiKey Token

## Implementación (server/ufService.ts + server/ufService.test.ts)
- getUfDelDia(): 1) caché en uf_value para hoy → 2) findic.cl → 3) BCCh con BCCH_API_TOKEN (deshabilitado por truncamiento) → persiste en uf_value
- parseFindicResponse / parseBcchResponse / bcchDateToISO: funciones puras testeadas (6/6 tests de parsing OK)
- Test de validación del secreto BCCh: falla por token truncado (30/60 chars) — no es un problema del token real

## Pendiente
- [ ] Agregar procedure tRPC financial.ufDelDia en routers.ts
- [ ] Reemplazar stubs [POR CONFIRMAR — Banco Central] en FinancialConsolidated.tsx (líneas ~85, ~112, ~461)
- [ ] Checkpoint publicado
- [ ] (Futuro) Resolver truncamiento del secreto BCCH_API_TOKEN para habilitar fallback BCCh
