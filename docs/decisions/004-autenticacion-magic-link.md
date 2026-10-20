# ADR 004 — Autenticación con Magic Link y protección de rutas

- **Estado:** propuesta (2026-10-20), pendiente de revisión de Eduardo en el PR
- **Decisiones origen:** AD-3 → Magic Link (2026-09-29); AD-9 y AD-10 (ADR 003)
- **Implementa:** TASK 9. (El plan la nombraba `002-supabase-auth`, pero el 002 ya es «una sola app» y el 003 «roles y RLS»: por eso es el 004.)

## Contexto

Con la migración 003 los datos de usuario se leen con la **sesión del usuario** y RLS decide (ADR 003). Falta lo que crea esa sesión: el login, el manejo de cookies y la protección de rutas. Hasta ahora `/api/chat` aceptaba un `usuario_id` que mandaba el navegador, es decir, cualquiera podía hablar en nombre de otro.

## Decisión

1. **Magic Link** con Supabase Auth (`signInWithOtp`), sin contraseñas. `shouldCreateUser: true`: el primer ingreso crea el usuario y el trigger de la 003 crea su fila en `usuarios` con rol `cliente`.
2. **Sesión en cookies httpOnly** con `@supabase/ssr`. El servidor valida con `auth.getUser()` (verifica el token contra Supabase), no confía en la cookie sin comprobarla.
3. **Dos clientes separados.** Con sesión (clave anónima/publicable, `apps/web/src/lib/supabase`) para datos de usuario; `service_role` solo en `@rcp/shared/db`, que no se importa desde componentes de cliente. Un test lo comprueba en el código fuente y en el bundle compilado.
4. **Proxy de Next 16** (`src/proxy.ts`, antes «middleware») aplica reglas puras de `lib/auth/acceso.ts`: `/dashboard/*` exige sesión; las rutas de consultor exigen rol `consultor|admin`; `/api/chat` y `/api/consultor` responden 401 sin sesión. El rol se consulta solo en rutas de consultor. Si no se puede leer, se niega (falla cerrada).
5. **`/api/chat` toma el usuario de la sesión**; un `usuario_id` en el body se descarta. El límite de 60/min se cuenta por ese usuario, así que ya no se evade generando UUID.
6. **Respuesta neutra** al pedir el enlace (mismo mensaje exista o no el correo, y aunque el envío falle) y **límite de 5 envíos / 10 min** por correo + IP.
7. **Sin redirecciones abiertas:** `siguiente` solo admite rutas internas. El enlace del correo se arma con `NEXT_PUBLIC_APP_URL`, no con el encabezado `Host`.

## Consecuencias

- (+) El usuario ya no se puede suplantar desde el navegador; RLS y sesión se refuerzan entre sí.
- (+) Las reglas de acceso son funciones puras con tests (109 en `apps/web`, cobertura 99 %).
- (−) El límite de envíos vive en la memoria del proceso: se reinicia y no se comparte entre instancias serverless (igual que el de `/api/chat`, issue #9). La segunda barrera es el límite de correos de Supabase.
- (−) Con el correo por defecto de Supabase el límite de envíos por hora es bajo (verificar el vigente antes de abrir a clientes reales); para producción habrá que definir un remitente propio (SMTP) — **decisión pendiente de Eduardo**.
- (−) Hay que configurar a mano, en cada proyecto de Supabase, las *Redirect URLs* (staging ≠ producción) y cargar `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Doppler y Vercel.
- (−) `/dashboard` aún no existe como página (TASK 11): tras ingresar, la ruta por defecto dará 404 hasta entonces.

## Alternativas descartadas

- **Guardar la sesión en `localStorage`:** legible por cualquier script de la página (riesgo XSS).
- **Proteger solo en cada ruta (sin proxy):** fácil de olvidar en una ruta nueva; el proxy es la red de seguridad y la ruta mantiene su propia verificación.
- **Redis para el límite de envíos ahora:** agrega un servicio al stack por un riesgo que Supabase ya limita; se reevalúa si hay abuso.
