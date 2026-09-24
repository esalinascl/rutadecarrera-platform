# @rutadecarrera/shared

Paquete compartido con tipos, schemas de validación y utilidades para el Asistente de Empleabilidad.

## Contenido

### Types (`src/types/index.ts`)

Tipos e interfaces compartidas para toda la plataforma:

#### User
Representa un usuario registrado en la plataforma.

```typescript
import { User, ContextoInicial } from '@rutadecarrera/shared';

const user: User = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  email: "usuario@example.com",
  nombre: "Juan Pérez",
  contexto_inicial: {
    situacion: "Desempleado",
    objetivo: "Conseguir trabajo en tech",
    habilidades: ["JavaScript", "React"],
  },
  creado_en: new Date(),
  actualizado_en: new Date(),
};
```

#### Conversation
Sesión de chat entre usuario y asistente.

```typescript
import { Conversation } from '@rutadecarrera/shared';

const conversation: Conversation = {
  id: "conv-123",
  usuario_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  titulo: "Primera sesión de coaching",
  activa: true,
  creado_en: new Date(),
  actualizado_en: new Date(),
};
```

#### Message
Mensaje individual en una conversación.

```typescript
import { Message } from '@rutadecarrera/shared';

const message: Message = {
  id: "msg-456",
  conversacion_id: "conv-123",
  rol: "user",
  contenido: "¿Cómo mejoro mi CV?",
  tokens_used: 45,
  creado_en: new Date(),
};
```

#### Analysis
Análisis de empleabilidad del usuario.

```typescript
import { Analysis } from '@rutadecarrera/shared';

const analysis: Analysis = {
  id: "anl-789",
  usuario_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  tipo: "empleabilidad",
  resultado: {
    fortalezas: ["Liderazgo", "Comunicación"],
    brechas: ["SQL", "Cloud platforms"],
    recomendaciones: ["Tomar curso de SQL", "Aprender AWS"],
    proximos_pasos: ["Actualizar CV", "Hacer LinkedIn profesional"],
    puntuacion_empleabilidad: 72,
    resumen: "Buen candidato con fortalezas en soft skills",
  },
  creado_en: new Date(),
};
```

#### ChatRequest / ChatResponse
Interfaces para comunicación con API.

```typescript
import { ChatRequest, ChatResponse } from '@rutadecarrera/shared';

const request: ChatRequest = {
  usuario_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  conversacion_id: "conv-123",
  mensaje: "Qué habilidades necesito para cambiar de carrera?",
  contexto: { situacion: "Desempleado" },
};

const response: ChatResponse = {
  respuesta: "Basándote en tu situación...",
  tokens_used: 250,
  id_mensaje: "msg-789",
  conversacion_id: "conv-123",
  timestamp: new Date(),
};
```

### Validation (`src/utils/validation.ts`)

Schemas Zod para validar datos:

```typescript
import {
  userSchema,
  chatRequestSchema,
  validateChatRequest,
  parseZodError,
} from '@rutadecarrera/shared';

// Validar user con schema
const usuario = userSchema.parse(datos);

// Validar request de forma segura (sin throw)
const result = chatRequestSchema.safeParse(datos);
if (!result.success) {
  console.error(result.error);
}

// Validar con helper
try {
  const validado = validateChatRequest(datos);
} catch (error) {
  const erroresAmigables = parseZodError(error);
  console.error(erroresAmigables);
}
```

#### Schemas disponibles

- `userSchema` - Validar User
- `createUserSchema` - Crear usuario (sin id/timestamps)
- `messageSchema` - Validar Message
- `chatRequestSchema` - Validar ChatRequest
- `chatResponseSchema` - Validar ChatResponse
- `analysisRequestSchema` - Validar AnalysisRequest
- `analysisResultSchema` - Validar resultado de análisis
- `contextoSchema` - Validar contexto inicial

#### Funciones helper

```typescript
import {
  validateUser,
  validateChatRequest,
  validateChatResponse,
  safeValidate,
  parseZodError,
  formatZodError,
  validateMany,
} from '@rutadecarrera/shared';

// Validar individual
const user = validateUser(datos);
const chatReq = validateChatRequest(request);

// Validar sin throw
const result = safeValidate(datos, userSchema);
if (result.valido) {
  console.log(result.datos);
} else {
  console.error(result.error); // Array de errores
}

// Parsear error para usuario
try {
  userSchema.parse(datos);
} catch (error) {
  const mensaje = formatZodError(error);
  res.status(400).json({ error: mensaje });
}

// Validar múltiples elementos
const results = await validateMany([
  { datos: user1, schema: userSchema },
  { datos: msg1, schema: messageSchema },
]);
```

### Gemini Utilities (`src/utils/gemini.ts`)

Helpers para interactuar con Google Gemini API:

```typescript
import {
  callGemini,
  formatGeminiPrompt,
  extractAnalysis,
  validateGeminiApiKey,
} from '@rutadecarrera/shared';

// Validar API key
validateGeminiApiKey(process.env.GEMINI_API_KEY!);

// Llamar Gemini API
const respuesta = await callGemini(
  [
    {
      role: 'user',
      parts: [{ text: '¿Qué habilidades necesito?' }],
    },
  ],
  process.env.GEMINI_API_KEY!,
  {
    temperature: 0.7,
    maxTokens: 500,
    timeout: 5000,
  },
);

console.log(respuesta.response);
console.log(`Tokens usados: ${respuesta.tokensUsed}`);

// Formatear prompt del sistema con contexto
const systemPrompt = formatGeminiPrompt({
  situacion: "Desempleado",
  objetivo: "Conseguir trabajo en tech",
  habilidades: ["JavaScript", "React"],
});

// Extraer análisis de conversación
const analysis = await extractAnalysis(
  historicalMessages,
  process.env.GEMINI_API_KEY!,
  userContext,
);

console.log(analysis.fortalezas);
console.log(analysis.proximos_pasos);
```

### General Utilities (`src/utils/index.ts`)

Funciones helper comunes:

```typescript
import {
  generateId,
  formatDate,
  formatTokens,
  truncateText,
  sanitizeInput,
  delay,
  retryAsync,
  parseError,
  isValidEmail,
  isValidUUID,
  groupBy,
  dedupe,
  capitalize,
} from '@rutadecarrera/shared';

// Generar UUID
const id = generateId();

// Formatear fechas
const formatted = formatDate(new Date()); // "24/09/2026 10:30"

// Formatear tokens
console.log(formatTokens(1500)); // "1.5K tokens"

// Truncar texto
const corto = truncateText("Texto muy largo", 10); // "Texto m..."

// Sanitizar input (XSS prevention)
const seguro = sanitizeInput('<script>alert("xss")</script>');

// Esperar
await delay(1000);

// Retry con backoff exponencial
const data = await retryAsync(
  () => fetchData(),
  {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 5000,
    onRetry: (attempt, error) => {
      console.log(`Intento ${attempt} falló: ${error.message}`);
    },
  },
);

// Parsear error amigablemente
try {
  // código
} catch (error) {
  const mensaje = parseError(error); // String seguro
}

// Validar emails y UUIDs
if (isValidEmail(email)) console.log('Email válido');
if (isValidUUID(id)) console.log('UUID válido');

// Agrupar array
const grouped = groupBy(messages, (m) => m.rol);

// Deduplicar
const unique = dedupe(items, (item) => item.id);

// Capitalizar
console.log(capitalize('hola')); // "Hola"
```

## Instalación

En el proyecto raíz:

```bash
npm install
```

Para usar en otras apps:

```typescript
import { User, callGemini, validateChatRequest } from '@rutadecarrera/shared';
```

## Testing

```bash
npm run test           # Ejecutar tests
npm run test:coverage  # Coverage report
```

## Build

```bash
npm run build          # Compilar TypeScript
npm run type-check     # Solo type check
```

## Exporta los siguientes módulos:

- **Types**: User, Conversation, Message, Analysis, ChatRequest/Response
- **Validation**: Zod schemas + helpers
- **Gemini**: callGemini, formatGeminiPrompt, extractAnalysis
- **Utils**: generateId, formatDate, sanitizeInput, retryAsync, etc.

## Documentación adicional

Ver en `docs/`:
- `docs/api-reference.md` - Referencia de API endpoints
- `docs/database-schema.md` - Diagrama y schema de BD
- `docs/architecture.md` - Arquitectura general
