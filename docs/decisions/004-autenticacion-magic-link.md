# ADR 004 — Autenticación con Magic Link y protección de rutas

- **Estado:** propuesta (2026-10-20), pendiente de revisión de Eduardo en el PR
- **Decisiones origen:** AD-3 → Magic Link (2026-09-29); AD-9 y AD-10 (ADR 003)
- **Implementa:** TASK 9. (El plan la nombraba `002-supabase-auth`, pero el 002 ya es «una sola app» y el 003 «roles y RLS»: por eso es el 004.)

## Contexto

Con la migración 003 los datos de usuario se leen con la **sesión del usuario** y RLS decide (ADR 003). Falta lo que crea esa sesión: el login, el manejo de cookies y la protección de rutas. Hasta ahora `/api/chat` aceptaba un `usuario_id` que mandaba el navegador, es decir, cualquiera podía hablar en nombre de otro.

## Decisión

1. **Magic Link** con Supabase Auth (`signInWithOtp`), sin contraseñas. `shouldCreateUser: true`: el primer ingreso crea el usuario y el trigger de la 003 crea su fila en `usuarios` con rol `cliente`.
2. **Sesión en cookies httpOnly** con `@supabase/ssr`. OJO: la librería usa por defecto `httpOnly: false` y sin `Secure`; por eso se fuerzan `httpOnly`, `SameSite=Lax` y `Secure` en producción (`lib/supabase/cookies.ts`, con test). El servidor valida con `auth.getUser()` (verifica el token contra Supabase), no confía en la cookie sin comprobarla. El proxy pasa la cookie renovada también a la petición que sigue y reenvía los encabezados `Cache-Control` que entrega Supabase.
3. **Dos clientes separados.** Con sesión (clave anónima/publicable, `apps/web/src/lib/supabase`) para datos de usuario; `service_role` solo en `@rcp/shared/db`, que no se importa desde componentes de cliente. Un test lo comprueba en el código fuente y en el bundle compilado.
4. **Proxy de Next 16** (`src/proxy.ts`, antes «middleware») aplica reglas puras de `lib/auth/acceso.ts`: `/dashboard/*` exige sesión; las rutas de consultor exigen rol `consultor|admin`; `/api/chat` y `/api/consultor` responden 401 sin sesión. El rol se consulta solo en rutas de consultor. Si no se puede leer, se niega (falla cerrada).
5. **`/api/chat` toma el usuario de la sesión**; un `usuario_id` en el body se descarta. El límite de 60/min se cuenta por ese usuario, así que ya no se evade generando UUID.
6. **Respuesta neutra** al pedir el enlace (mismo mensaje exista o no el correo, y aunque el envío falle) y **dos límites independientes**: 5 envíos / 10 min por correo (desde cualquier IP) y 20 / 10 min por IP, con tope duro de memoria. La IP sale de los encabezados que fija la plataforma, no del primer valor de `x-forwarded-for` (falsificable).
7. **Sin redirecciones abiertas:** `siguiente` solo admite rutas internas. El enlace del correo se arma con `NEXT_PUBLIC_APP_URL`, no con el encabezado `Host`.

## Consecuencias

- (+) El usuario ya no se puede suplantar desde el navegador; RLS y sesión se refuerzan entre sí.
- (+) Las reglas de acceso son funciones puras con tests (109 en `apps/web`, cobertura 99 %).
- (−) El límite de envíos vive en la memoria del proceso: se reinicia y no se comparte entre instancias serverless (igual que el de `/api/chat`, issue #9). La segunda barrera es el límite de correos de Supabase.
- (−) Con el correo por defecto de Supabase el límite de envíos por hora es bajo (verificar el vigente antes de abrir a clientes reales); para producción habrá que definir un remitente propio (SMTP) — **decisión pendiente de Eduardo**.
- (−) **El enlace solo funciona en el mismo navegador donde se pidió** (flujo PKCE: el verificador vive en una cookie). Abrirlo en otro dispositivo o en el navegador interno de una app de correo da «enlace inválido». Además el callback redirige a `NEXT_PUBLIC_APP_URL`: si no coincide con el dominio donde llegó (previews de Vercel, `www` vs apex), la sesión queda en un host y el usuario aterriza en otro.
- (+) **Verificado en staging (2026-11-04):** el enlace con `?siguiente=…` lo acepta la configuración de Redirect URLs de staging y el login se completa (ver «Verificación real en staging» más abajo).
- (−) Hay que configurar a mano, en cada proyecto de Supabase, las *Redirect URLs* (staging ≠ producción) y cargar `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Doppler y Vercel.
- (−) `/dashboard` aún no existe como página (TASK 11): tras ingresar, la ruta por defecto da 404 hasta entonces (confirmado en la prueba real: significa que el proxy validó la sesión y dejó pasar).

## Verificación real en staging (2026-11-04 y 2026-11-05)

Servidor local (`next dev` en `localhost:3000`) con la configuración `dev` de Doppler, que apunta al Supabase de **staging** (verificado: ni la URL ni las claves eran de producción). Lo que hizo una persona (pedir el enlace y abrirlo en el navegador) se hizo a mano; el resto, con sesiones generadas desde la API de administración de Supabase y un usuario de prueba que se borró al terminar (staging quedó con 0 usuarios, como al empezar).

| Qué se comprobó | Resultado |
|---|---|
| Pedir el enlace desde el formulario: respuesta neutra y correo enviado (el usuario se crea y Supabase registra el envío al instante) | ✅ |
| El disparador de la 003 crea la fila en `usuarios` con rol `cliente` | ✅ |
| Abrir el enlace en el mismo navegador → `/auth/callback?code=…&siguiente=%2Fdashboard` → sesión → `/dashboard` (404 esperado) | ✅ |
| `?siguiente=` aceptado por las Redirect URLs de staging | ✅ |
| Enlace vencido (más de 1 h): vuelve a `/auth/login?error=enlace_invalido` con el aviso en pantalla | ✅ |
| Rutas sin sesión: `/dashboard` y `/dashboard/consultor` → login; `/api/chat` y `/api/consultor/*` → 401; `/`, `/ruedadelavida` y `/api/health` públicas | ✅ (9 comprobaciones) |
| Roles con sesión real (12 comprobaciones): cliente → 403 en `/dashboard/consultor` y `/api/consultor/*`; consultor pasa; el rol se lee de la base en cada petición (al bajarlo vuelve el 403); `/api/chat` con sesión y cuerpo inválido → 400; **cookie falsificada → login / 401** | ✅ |
| Renovación de sesión (9 comprobaciones): con la cookie «vencida» el proxy renueva (token nuevo, *refresh token* rotado) y la sesión renovada sigue válida; con un *refresh token* inventado → login / 401 | ✅ |

**Hallazgo (a vigilar):** el segundo correo falló con `invalid flow state, flow state has expired`. Era el reenvío de la confirmación a un usuario que aún no había confirmado su correo; el tercero, ya con el usuario confirmado, funcionó. Supabase documenta que el código del enlace es válido 5 minutos y se canjea una sola vez, pero no aclara desde cuándo se cuenta, y el registro de auditoría de Auth no está activo en el plan gratuito, así que **la causa exacta no está confirmada**. Lo más probable es que el enlace de *primer registro* deba abrirse en pocos minutos. En producción el efecto debería ser bajo (el registro es por invitación: los usuarios se crean ya confirmados), pero importa si algún día se abre el registro. Si alguien ve «enlace inválido» en su primer ingreso, basta pedir otro enlace.

**No verificado:** envío con remitente propio (SMTP/Resend) y plantillas de correo en español (el correo salió con la plantilla por defecto de Supabase); comportamiento en **producción** (otro proyecto de Supabase, otro dominio); abrir el enlace desde otro navegador o dispositivo (se documenta como limitación).

## Alternativas descartadas

- **Guardar la sesión en `localStorage`:** legible por cualquier script de la página (riesgo XSS).
- **Proteger solo en cada ruta (sin proxy):** fácil de olvidar en una ruta nueva; el proxy es la red de seguridad y la ruta mantiene su propia verificación.
- **Redis para el límite de envíos ahora:** agrega un servicio al stack por un riesgo que Supabase ya limita; se reevalúa si hay abuso.
