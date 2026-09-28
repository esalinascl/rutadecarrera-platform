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
| 429 | Más de 60 solicitudes en 60 segundos para el mismo `usuario_id` | `{ "error": "Límite de solicitudes excedido..." }` |
| 500 | Falta `GEMINI_API_KEY`, Gemini falla (timeout, error de API), o cualquier error inesperado | `{ "error": "Error interno del servidor" }` — **nunca** incluye el detalle real del error (ver issue #9) |

### Rate limiting

60 solicitudes por minuto, por `usuario_id`. Implementado **en memoria**
(un `Map` dentro del proceso) — limitaciones conocidas documentadas en
[issue #9](https://github.com/esalinascl/rutadecarrera-platform/issues/9):
no se comparte entre instancias serverless, se resetea si el proceso se
reinicia, y es evadible sin autenticación real (pendiente TASK 9).

### Gemini

- Timeout: 5 segundos por llamada (`GEMINI_TIMEOUT_MS` en `route.ts`).
- Modelo: el de la variable de entorno `GEMINI_MODEL` (`gemini-2.5-flash`
  al momento de escribir esto).
- Tokens usados: se loguean en cada request (`console.log` estructurado,
  evento `gemini_tokens_used`) para observabilidad — todavía no se
  persisten en base de datos (eso es TASK 7+).
- El prompt de sistema (`formatGeminiPrompt`, con el contexto del usuario)
  se antepone como el primer mensaje del array — `@rcp/shared/utils/gemini`
  no expone todavía el campo nativo `systemInstruction` de la API de
  Gemini (deuda técnica anotada en el código).
