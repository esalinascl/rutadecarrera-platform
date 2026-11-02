# ADR 006 — Endpoint de salud de la base de datos (`/api/health`)

- **Estado:** propuesta (2026-11-02); pasa a «aceptada» con el OK de Eduardo al fusionar el PR
- **Decisión origen:** Eduardo eligió la opción A el 2026-10-31 (tarea «SUPABASE — Evitar que los proyectos se pausen»): endpoint de salud y ping en Monitoring ahora, plan Pro al lanzar el login
- **Especificación:** «SPEC — health-db» (vault)

## Contexto

El plan gratuito de Supabase pausa los proyectos con 7 días de baja actividad. Los de Ruta de Carrera ya se pausaron varias veces (producción el 2026-10-15 y de nuevo el 2026-10-30; staging también). Hoy `apps/web` no consulta Supabase, así que no hay impacto en usuarios; con el login (PR #41) cada petición protegida consultaría la base y una pausa tumbaría la app. El plan Pro es la única garantía, pero todavía no hay usuarios que lo justifiquen.

## Decisión

1. **`GET /api/health`** en `apps/web`: endpoint público que hace una consulta mínima de solo lectura (`select id … limit(0)` sobre `usuarios`) y responde `200 { estado: "ok" }` o `503 { estado: "error" }`.
2. **Un trabajo nuevo en `monitoring.yml`** (`salud-base-de-datos`) lo llama cada 30 minutos, reintenta ante 5xx y queda en rojo si la base no está sana. Cada llamada cuenta además como actividad del proyecto.
3. **Plan Pro al lanzar el login** (fuera de este cambio): los pings son una práctica de la comunidad, no una garantía de Supabase.

## Consecuencias

- (+) La caída o pausa de la base se avisa por CI en minutos, no cuando un usuario falla.
- (+) **Sin secretos nuevos en GitHub:** la consulta la hace la app con las variables que ya tiene en Vercel.
- (+) Probado con TDD (47 pruebas), 35 mutaciones detectadas de 35 y una prueba de extremo a extremo con la app compilada contra un PostgREST falso (base sana, tabla inexistente, base colgada, 503, inalcanzable y sin configuración).
- (−) Una ruta **pública** ejecuta una consulta con la service role. Mitigación: consulta fija, sin entradas, respuesta sin datos, caché de 30 s (5 s si falla) y tiempo límite de 4 s.
- (−) La caché es por instancia: con varias instancias serverless puede haber más de una consulta cada 30 s. Frena el abuso, no es un límite estricto.
- (−) Si el workflow queda en rojo por una pausa real, GitHub avisa por correo: hay que restaurar el proyecto a mano en el panel de Supabase.

## Hallazgos de la prueba de extremo a extremo

Las pruebas unitarias con un cliente falso no podían ver tres comportamientos reales de `@supabase/postgrest-js` 2.118.0, que se corrigieron antes de abrir el PR:

1. **Con `HEAD`, un 404 sin cuerpo se trata como éxito:** una tabla inexistente habría salido «ok». Solución: `GET` con `limit(0)`.
2. **Reintenta solo** (3 veces, esperas de 1, 2 y 4 s) ante errores de red y 503: una base inalcanzable tardaba el tiempo límite completo y se registraba mal como `timeout`. Solución: `retry(false)`.
3. **Un error guardado 30 s anulaba el reintento de Monitoring** (que espera 10 s). Solución: el error se guarda solo 5 s.

## Alternativas descartadas

- **Clave pública (anon) + función SQL `ping()`:** evita usar la service role en una ruta pública, pero exige una migración nueva aplicada en dos proyectos de Supabase; más piezas para el mismo resultado.
- **Que Monitoring llame directamente a la API de Supabase:** obligaría a guardar la clave de Supabase como secreto de GitHub, que es justo lo que se quiere evitar.
- **Pasar a Pro ya:** garantiza que no se pause, pero es un costo sin usuarios todavía. Queda decidido para el lanzamiento del login.
- **Un servicio externo de pings (cron externo):** otra cuenta y otro punto de falla fuera del repositorio.
