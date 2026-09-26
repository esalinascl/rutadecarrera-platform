# API Reference — Asistente de Empleabilidad

> Fuente de verdad de los endpoints de `apps/asistente`. Actualizar en el
> mismo commit que cambie un endpoint (regla de gobernanza #10).

## POST /api/chat

Envía un mensaje del usuario al asistente y recibe una respuesta.

**Estado actual (TASK 5):** responde un mock. La integración real con
Gemini llega en TASK 6 — el contrato de request/response ya es el final,
así que el frontend puede integrarse contra este endpoint desde ya.

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
  "respuesta": "string",
  "tokens_used": 0,
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
| 500 | Error inesperado del servidor | `{ "error": "Error interno del servidor" }` |

### Rate limiting

60 solicitudes por minuto, por `usuario_id`. Implementado **en memoria**
(un `Map` dentro del proceso) — limitación conocida: no se comparte entre
instancias serverless concurrentes y se resetea si el proceso se reinicia.
No hay Redis en el stack todavía (ver PLAN §Deployment). Reemplazar antes
de un despliegue con tráfico real en múltiples instancias.
