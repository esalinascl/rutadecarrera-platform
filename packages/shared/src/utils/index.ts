/**
 * @file utils/index.ts
 * @description Utilidades generales compartidas
 *
 * Funciones helper comunes para formateo, sanitización, parsing de errores,
 * generación de IDs, retries, etc.
 */

/**
 * Genera un UUID v4
 *
 * @returns String con UUID v4
 *
 * @example
 * const id = generateId(); // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Formatea una fecha a string legible
 *
 * @param date - Fecha a formatear
 * @param locale - Locale para formato (default: "es-CL")
 * @returns String con fecha formateada
 *
 * @example
 * formatDate(new Date()); // "24/09/2026 10:30"
 */
export function formatDate(
  date: Date,
  locale: string = 'es-CL',
): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formatea un número de tokens a string legible
 *
 * @param count - Número de tokens
 * @returns String formateado
 *
 * @example
 * formatTokens(1500); // "1.5K tokens"
 * formatTokens(45); // "45 tokens"
 */
export function formatTokens(count: number): string {
  if (count < 1000) {
    return `${count} tokens`;
  }
  return `${(count / 1000).toFixed(1)}K tokens`;
}

/**
 * Trunca un texto a una longitud máxima
 *
 * @param text - Texto a truncar
 * @param maxLength - Longitud máxima
 * @param suffix - Sufijo si se trunca (default: "...")
 * @returns Texto truncado
 *
 * @example
 * truncateText("Hola mundo", 5); // "Ho..."
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...',
): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Sanitiza input para prevenir XSS
 * Escapa caracteres HTML peligrosos
 *
 * @param input - String a sanitizar
 * @returns String sanitizado
 *
 * @example
 * sanitizeInput('<script>alert("xss")</script>');
 * // "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 */
export function sanitizeInput(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return input.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Invierte la sanitización (desescapa HTML)
 *
 * @param input - String a desescapar
 * @returns String desescapado
 */
export function unsanitizeInput(input: string): string {
  const map: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
  };
  return input.replace(/&[^;]+;/g, (entity) => map[entity] || entity);
}

/**
 * Delay/sleep helper
 *
 * @param ms - Milisegundos a esperar
 * @returns Promise que se resuelve después del delay
 *
 * @example
 * await delay(1000); // Espera 1 segundo
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry helper para funciones async
 * Reintentar con backoff exponencial
 *
 * @param fn - Función async a ejecutar
 * @param options - Opciones de retry
 * @returns Resultado de la función
 * @throws Error si falla después de todos los intentos
 *
 * @example
 * const data = await retryAsync(
 *   () => fetchData(),
 *   { maxAttempts: 3, baseDelay: 100, maxDelay: 5000 }
 * );
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  },
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 100,
    maxDelay = 5000,
    onRetry,
  } = options || {};

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const delayTime = Math.min(
          baseDelay * Math.pow(2, attempt - 1),
          maxDelay,
        );

        if (onRetry) {
          onRetry(attempt, lastError);
        }

        await delay(delayTime);
      }
    }
  }

  throw lastError || new Error('Retry exhausted without error');
}

/**
 * Parsea un error a un string legible
 * Maneja diferentes tipos de error
 *
 * @param error - Error a parsear
 * @returns String con descripción del error
 *
 * @example
 * try {
 *   // código
 * } catch (error) {
 *   const msg = parseError(error);
 *   console.error(msg);
 * }
 */
export function parseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    // Manejar respuestas de API
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
    if ('detail' in error && typeof error.detail === 'string') {
      return error.detail;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return 'Error desconocido';
}

/**
 * Crea un objeto de error estructurado
 *
 * @param mensaje - Mensaje de error
 * @param codigo - Código de error
 * @param statusCode - HTTP status code
 * @returns Objeto de error estructurado
 *
 * @example
 * throw createError("Usuario no encontrado", "NOT_FOUND", 404);
 */
export function createError(
  mensaje: string,
  codigo: string,
  statusCode: number = 500,
): {
  mensaje: string;
  codigo: string;
  statusCode: number;
  timestamp: Date;
} {
  return {
    mensaje,
    codigo,
    statusCode,
    timestamp: new Date(),
  };
}

/**
 * Valida un email
 *
 * @param email - Email a validar
 * @returns true si es válido, false si no
 *
 * @example
 * isValidEmail("test@example.com"); // true
 * isValidEmail("invalid-email"); // false
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida un UUID
 *
 * @param uuid - UUID a validar
 * @returns true si es válido, false si no
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Agrupa array por propiedad
 *
 * @param array - Array a agrupar
 * @param getKey - Función que retorna clave
 * @returns Objeto con grupos
 *
 * @example
 * const msgs = [
 *   { rol: 'user', texto: 'Hola' },
 *   { rol: 'assistant', texto: 'Hola!' },
 * ];
 * const grouped = groupBy(msgs, m => m.rol);
 * // { user: [...], assistant: [...] }
 */
export function groupBy<T>(
  array: T[],
  getKey: (item: T) => string,
): Record<string, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = getKey(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Deduplicar array
 *
 * @param array - Array a deduplicar
 * @param getKey - Función que retorna clave (default: identidad)
 * @returns Array sin duplicados
 *
 * @example
 * dedupe([1, 2, 2, 3]); // [1, 2, 3]
 * dedupe([{id:1}, {id:2}, {id:1}], x => x.id); // [{id:1}, {id:2}]
 */
export function dedupe<T>(
  array: T[],
  getKey: (item: T) => string | number = (item) => String(item),
): T[] {
  const seen = new Set<string | number>();
  return array.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Convierte un array de objetos a CSV
 *
 * @param data - Array de objetos
 * @returns String en formato CSV
 *
 * @example
 * const csv = arrayToCSV([
 *   { nombre: 'Juan', edad: 30 },
 *   { nombre: 'María', edad: 25 }
 * ]);
 */
export function arrayToCSV<T extends Record<string, unknown>>(data: T[]): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const headerRow = headers.map((h) => `"${h}"`).join(',');

  const rows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        const stringValue = String(value);
        return `"${stringValue.replace(/"/g, '""')}"`;
      })
      .join(','),
  );

  return [headerRow, ...rows].join('\n');
}

/**
 * Capitaliza primera letra de una palabra
 *
 * @param text - Texto a capitalizar
 * @returns Texto capitalizado
 *
 * @example
 * capitalize("hola"); // "Hola"
 */
export function capitalize(text: string): string {
  if (text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Compara dos strings ignorando mayúsculas y espacios
 *
 * @param a - Primer string
 * @param b - Segundo string
 * @returns true si son iguales (ignorando caso y espacios)
 */
export function compareStrings(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

// Exports de módulos internos
export * from './validation';
export * from './gemini';
