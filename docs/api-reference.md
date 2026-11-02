# API Reference — Asistente de Empleabilidad

> Fuente de verdad de los endpoints de `apps/web`. Actualizar en el
> mismo commit que cambie un endpoint (regla de gobernanza #10).

## POST /api/chat

Envía un mensaje del usuario al asistente y recibe una respuesta generada
por Google Gemini (ver `docs/decisions/001-gemini-integration.md`).

**Estado actual (TASK 6):** conectado a Gemini real. El historial de
conversación (si se envía) se pasa completo a Gemini junto con el mensaje
nuevo. La persistencia en Supabase (guardar la conversación) es TASK 7+,
todavía no implementada — el cliente es responsable de reenviar el
historial en cada request mientras tanto.

### Request

```json
{
  "usuario_id": "uuid",
  "conversacion_id": "uuid (opcional, se genera uno si no viene)",
  "mensaje": "string (1 a 5000 caracteres)",
  "contexto": { "situacion": "string opcional", "objetivo": "string opcional" },
  "historial": [{ "role": "user | model", "parts": [{ "text": "string" }] }]
}
```

Validado con `chatRequestSchema` de `@rcp/shared` (Zod, `.strict()` — campos
extra rechazan la solicitud).

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
| 400 | JSON inválido, o no cumple `chatRequestSchema` (mensaje vacío, `usuario_id` no es UUID, etc.) | `{ "error": "...", "detalles"?: [...] }` |
| 413 | El cuerpo supera 512 KB (ver «Tamaño del cuerpo») | `{ "error": "El cuerpo de la solicitud es demasiado grande" }` |
| 429 | Más de 60 solicitudes en 60 segundos para el mismo `usuario_id` | `{ "error": "Límite de solicitudes excedido..." }` |
| 500 | Falta `GEMINI_API_KEY`, Gemini falla (timeout, error de API), o cualquier error inesperado | `{ "error": "Error interno del servidor" }` — **nunca** incluye el detalle real del error (ver issue #9) |

### Tamaño del cuerpo

El cuerpo de la solicitud no puede pasar de **512 KB** (`MAX_CUERPO_BYTES` en
`apps/web/src/lib/http/cuerpo-acotado.ts`); si lo pasa, la respuesta es **413** y
el cuerpo no se procesa. El máximo legítimo ronda 410 KB (40 turnos de historial ×
5000 caracteres con acentos). Se cuentan **bytes**, no caracteres, y el límite se
aplica aunque el cliente no declare `Content-Length` o declare uno falso (ver
`docs/decisions/005-zod-4-y-tope-de-cuerpo.md`).

### Detalle de los errores de validación (400)

Cada elemento de `detalles` es `{ "campo": "historial.0.role", "mensaje": "...", "tipo": "..." }`.
Los **mensajes que definimos en español** no cambian. Con Zod 4 cambiaron dos códigos de `tipo`
(`invalid_string` → `invalid_format` e `invalid_enum_value` → `invalid_value`) y los
textos por defecto en inglés (por ejemplo, un campo ausente ahora dice
«Invalid input: expected string, received undefined» en vez de «Required»).
Quien consuma `detalles` no debe depender de esos textos por defecto.

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

## GET /api/health

Comprueba que la base de datos (Supabase) responde. Es **público**: lo llama el
workflow `Monitoring` de GitHub Actions cada 30 minutos, sin credenciales.
Sirve para dos cosas: avisar por CI si la base cae o se pausa, y mantener
actividad en el proyecto, porque el plan gratuito de Supabase pausa los
proyectos con 7 días sin uso (no es una garantía: solo el plan Pro lo es).
Ver `docs/decisions/006-endpoint-de-salud-de-la-base.md`.

### Request

Sin parámetros ni cuerpo (cualquier parámetro se ignora). Responde a `GET` y
`HEAD`; los demás métodos reciben 405.

### Response

| Código | Cuándo | Body |
|---|---|---|
| 200 | La base respondió a la consulta mínima | `{ "estado": "ok", "revisado_en": "2026-11-02T12:00:00.000Z" }` |
| 503 | La base devolvió un error, no respondió en 4 s, o falta `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | `{ "estado": "error", "revisado_en": "2026-11-02T12:00:00.000Z" }` |

El body tiene **exactamente** esas dos claves: nunca incluye mensajes de error,
direcciones, nombres de variables, claves ni datos de la base. La respuesta
lleva `Cache-Control: no-store`.

### Cómo funciona por dentro

- **Consulta fija de solo lectura:** `select id` con `limit(0)` sobre `usuarios`.
  La base la ejecuta (comprueba que la tabla y los permisos existen) pero no
  devuelve ninguna fila. No usa `HEAD`: con `HEAD`, `postgrest-js` trata un 404
  sin cuerpo (tabla inexistente) como éxito.
- **Sin reintentos internos** (`retry(false)`): una base inalcanzable debe
  fallar al instante y con su causa real, no tras esperas de 1, 2 y 4 s.
- **Tiempo límite de 4 s:** al vencer se cancela la petición en curso.
- **Caché por instancia:** un resultado `ok` se reutiliza 30 s y un error solo
  5 s (para que el reintento de Monitoring, 10 s después, consulte de verdad).
  Las solicitudes simultáneas comparten una sola consulta. Frena el abuso de
  una ruta pública; no es un límite estricto (cada instancia serverless tiene
  su propia caché).
- **Registro:** al fallar escribe en el log del servidor `health_db_error` con
  solo la `causa` (`configuracion`, `timeout` o `base_de_datos`) y el `codigo`
  de error de la base si existe; nunca el mensaje completo.
- **Sin secretos nuevos en GitHub:** la consulta la hace la app con las
  variables que ya tiene en Vercel.
- **Con el login (PR #41) fusionado** sigue siendo público: su `proxy.ts` solo
  cubre `/dashboard`, `/api/chat` y `/api/consultor`.
