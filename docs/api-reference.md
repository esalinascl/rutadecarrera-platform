# API Reference — Asistente de Empleabilidad

> Fuente de verdad de los endpoints de `apps/web`. Actualizar en el
> mismo commit que cambie un endpoint (regla de gobernanza #10).

## POST /api/chat

Envía un mensaje del usuario al asistente y recibe una respuesta generada
por Google Gemini (ver `docs/decisions/001-gemini-integration.md`).

**Autenticación (TASK 9):** exige sesión (cookies httpOnly del Magic Link). El
usuario se toma de la **sesión**: si el body trae `usuario_id`, se **ignora**.
Sin sesión responde `401`.

**Estado actual (TASK 6):** conectado a Gemini real. El historial de
conversación (si se envía) se pasa completo a Gemini junto con el mensaje
nuevo. La persistencia en Supabase (guardar la conversación) es TASK 7+,
todavía no implementada — el cliente es responsable de reenviar el
historial en cada request mientras tanto.

### Request

```json
{
  "conversacion_id": "uuid (opcional, se genera uno si no viene)",
  "mensaje": "string (1 a 5000 caracteres)",
  "contexto": { "situacion": "string opcional", "objetivo": "string opcional" },
  "historial": [{ "role": "user | model", "parts": [{ "text": "string" }] }]
}
```

Validado con `chatRequestSchema.omit({ usuario_id })` de `@rcp/shared` (Zod,
`.strict()` — campos extra rechazan la solicitud). Un `usuario_id` en el body
se descarta antes de validar (compatibilidad con clientes anteriores a TASK 9).

### Response — 200 OK

```json
{
  "respuesta": "string (generado por Gemini)",
  "tokens_used": 128,
  "id_mensaje": "uuid",
  "conversacion_id": "uuid",
  "timestamp": "2026-09-26T12:00:00.000Z"
}
```

### Errores

| Código | Causa | Body |
|---|---|---|
| 400 | JSON inválido, o no cumple el esquema del body (mensaje vacío, historial demasiado largo, etc.; `usuario_id` ya no forma parte del body) |
| 401 | Sin sesión válida | `{ "error": "No autenticado" }` | `{ "error": "...", "detalles"?: [...] }` |
| 429 | Más de 60 solicitudes en 60 segundos para el mismo usuario **de la sesión** | `{ "error": "Límite de solicitudes excedido..." }` |
| 500 | Falta `GEMINI_API_KEY`, Gemini falla (timeout, error de API), o cualquier error inesperado | `{ "error": "Error interno del servidor" }` — **nunca** incluye el detalle real del error (ver issue #9) |

### Rate limiting

60 solicitudes por minuto, por `usuario_id`. Implementado **en memoria**
(un `Map` dentro del proceso) — limitaciones conocidas documentadas en
[issue #9](https://github.com/esalinascl/rutadecarrera-platform/issues/9):
no se comparte entre instancias serverless, se resetea si el proceso se
reinicia, y es evadible sin autenticación real (pendiente TASK 9).

### Gemini

- Timeout: 5 segundos por llamada (`GEMINI_TIMEOUT_MS` en `route.ts`).
- Modelo: el de la variable de entorno `GEMINI_MODEL` (`gemini-3.8-flash`
  desde 2026-10-03; `gemini-2.5-flash` fue descontinuado). Es obligatorio:
  no hay modelo por defecto.
- Tokens usados: se loguean en cada request (`console.log` estructurado,
  evento `gemini_tokens_used`) para observabilidad — todavía no se
  persisten en base de datos (eso es TASK 7+).
- El prompt de sistema (`formatGeminiPrompt`, con el contexto del usuario)
  se antepone como el primer mensaje del array — `@rcp/shared/utils/gemini`
  no expone todavía el campo nativo `systemInstruction` de la API de
  Gemini (deuda técnica anotada en el código).

---

## Autenticación (TASK 9, ADR 004)

Login por **Magic Link** (Supabase Auth). Sin contraseñas.

### POST /api/auth/login

Pide el enlace de ingreso. Body: `{ "email": string, "siguiente"?: string }`
(`siguiente` es una ruta interna a la que volver tras ingresar; cualquier otra cosa se reemplaza por `/dashboard`).

| Código | Causa | Body |
|---|---|---|
| 200 | Solicitud aceptada. **El mensaje es el mismo exista o no el correo**, y también si el envío falla (no revela qué correos están registrados) | `{ "mensaje": "Si el correo es válido, te enviamos un enlace..." }` |
| 400 | JSON inválido o email con formato inválido | `{ "mensaje": "..." }` |
| 429 | Más de 5 envíos en 10 minutos para el mismo correo desde la misma IP | `{ "mensaje": "Demasiados intentos..." }` |
| 500 | Falta configuración de Supabase | `{ "mensaje": "Error interno del servidor." }` |

El enlace apunta a `NEXT_PUBLIC_APP_URL` (nunca al encabezado `Host`).

### GET /auth/callback

Destino del enlace. Canjea `?code=` por una sesión (cookies httpOnly) y redirige
a `?siguiente=` (solo rutas internas). Con código ausente, vencido o inválido
redirige a `/auth/login?error=enlace_invalido`.

### Protección de rutas (`src/proxy.ts`)

| Ruta | Sin sesión | Cliente | Consultor / admin |
|---|---|---|---|
| `/dashboard/*` | redirige a `/auth/login?siguiente=…` | permitido | permitido |
| `/dashboard/consultor/*` | redirige al login | **403** | permitido |
| `/api/chat` | **401** | permitido | permitido |
| `/api/consultor/*` | **401** | **403** | permitido |
| Resto (`/`, `/auth/*`, `/ruedadelavida`…) | público | público | público |

Si no se puede leer el rol, se niega el acceso de consultor (falla cerrada).
