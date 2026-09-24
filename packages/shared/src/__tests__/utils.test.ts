/**
 * @file __tests__/utils.test.ts
 * @description Tests para utilidades generales
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateId,
  formatDate,
  formatTokens,
  truncateText,
  sanitizeInput,
  unsanitizeInput,
  delay,
  retryAsync,
  parseError,
  createError,
  isValidEmail,
  isValidUUID,
  groupBy,
  dedupe,
  arrayToCSV,
  capitalize,
  compareStrings,
} from '../utils/index';

describe('Utils - ID Generation', () => {
  describe('generateId', () => {
    it('debe generar UUID válido', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('debe generar UUIDs únicos', () => {
      const ids = [generateId(), generateId(), generateId()];
      expect(new Set(ids).size).toBe(3);
    });
  });
});

describe('Utils - Formatting', () => {
  describe('formatDate', () => {
    it('formatea en formato chileno (dd-mm-aaaa) y hora de Santiago', () => {
      // 13:30 UTC = 10:30 en Santiago (UTC-3 en septiembre)
      const formatted = formatDate('2026-09-24T13:30:00.000Z');
      expect(formatted).toMatch(/^24-09-2026, 10:30/);
    });

    it('da el mismo resultado sin importar la zona horaria de la máquina', () => {
      const instante = '2026-09-24T13:30:00.000Z';
      expect(formatDate(instante)).toBe(formatDate(new Date(instante)));
      // es-CL usa reloj de 12 horas: 13:30 UTC se muestra como "01:30 p. m."
      expect(formatDate(instante, 'es-CL', 'UTC')).toMatch(/^24-09-2026, 01:30/);
    });

    it('debe usar locale personalizado', () => {
      const date = new Date('2026-09-24T10:30:00');
      const formatted = formatDate(date, 'en-US');
      expect(typeof formatted).toBe('string');
    });
  });

  describe('formatTokens', () => {
    it('debe formatear tokens < 1000', () => {
      expect(formatTokens(45)).toBe('45 tokens');
      expect(formatTokens(999)).toBe('999 tokens');
    });

    it('debe formatear tokens >= 1000 en K', () => {
      expect(formatTokens(1000)).toBe('1.0K tokens');
      expect(formatTokens(1500)).toBe('1.5K tokens');
      expect(formatTokens(10000)).toBe('10.0K tokens');
    });
  });

  describe('truncateText', () => {
    it('debe truncar texto largo', () => {
      const resultado = truncateText('Hola mundo', 5);
      expect(resultado).toBe('Ho...');
      expect(resultado.length).toBe(5);
    });

    it('debe preservar texto corto', () => {
      const resultado = truncateText('Hola', 10);
      expect(resultado).toBe('Hola');
    });

    it('debe usar sufijo personalizado', () => {
      const resultado = truncateText('Hola mundo', 7, '>>>');
      expect(resultado).toContain('>>>');
      expect(resultado.length).toBe(7);
    });
  });

  describe('capitalize', () => {
    it('debe capitalizar primera letra', () => {
      expect(capitalize('hola')).toBe('Hola');
      expect(capitalize('HOLA')).toBe('HOLA');
    });

    it('debe manejar string vacío', () => {
      expect(capitalize('')).toBe('');
    });
  });
});

describe('Utils - Security', () => {
  describe('sanitizeInput', () => {
    it('debe escapar caracteres HTML peligrosos', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeInput(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).not.toContain('<script>');
    });

    it('debe escapar todos los caracteres especiales', () => {
      const input = '<tag attr="value">text</tag>';
      const result = sanitizeInput(input);
      expect(result).toContain('&lt;');
      expect(result).toContain('&quot;');
    });

    it('debe preservar texto normal', () => {
      const input = 'Hola mundo 123';
      const result = sanitizeInput(input);
      expect(result).toBe('Hola mundo 123');
    });
  });

  describe('unsanitizeInput', () => {
    it('debe desescapar HTML', () => {
      const input = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      const result = unsanitizeInput(input);
      expect(result).toContain('<script>');
      expect(result).toContain('"');
    });

    it('debe ser inverso de sanitizeInput', () => {
      const original = '<div>Hola "mundo"</div>';
      const sanitized = sanitizeInput(original);
      const restored = unsanitizeInput(sanitized);
      expect(restored).toBe(original);
    });
  });
});

describe('Utils - Async', () => {
  describe('delay', () => {
    it('debe esperar el tiempo especificado', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('retryAsync', () => {
    it('debe ejecutar función si tiene éxito', async () => {
      const fn = vi.fn(async () => 'success');
      const result = await retryAsync(fn, { maxAttempts: 3 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('debe reintentar en caso de error', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Error');
      });

      await expect(
        retryAsync(fn, {
          maxAttempts: 2,
          baseDelay: 10,
        }),
      ).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('debe usar backoff exponencial', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Error');
      });

      const delays: number[] = [];
      const onRetry = vi.fn((attempt: number) => {
        delays.push(10 * Math.pow(2, attempt - 1));
      });

      try {
        await retryAsync(fn, {
          maxAttempts: 3,
          baseDelay: 10,
          maxDelay: 100,
          onRetry,
        });
      } catch {
        // Error esperado
      }

      expect(onRetry).toHaveBeenCalled();
    });

    it('debe retornar éxito en reintento posterior', async () => {
      let attempts = 0;
      const fn = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Error');
        }
        return 'success';
      });

      const result = await retryAsync(fn, {
        maxAttempts: 3,
        baseDelay: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Utils - Error Handling', () => {
  describe('parseError', () => {
    it('debe parsear Error normal', () => {
      const error = new Error('Mensaje de error');
      const result = parseError(error);
      expect(result).toBe('Mensaje de error');
    });

    it('debe parsear string', () => {
      const result = parseError('Error string');
      expect(result).toBe('Error string');
    });

    it('debe parsear objeto con message', () => {
      const result = parseError({ message: 'Error object' });
      expect(result).toBe('Error object');
    });

    it('debe parsear objeto con error', () => {
      const result = parseError({ error: 'API error' });
      expect(result).toBe('API error');
    });

    it('debe retornar string genérico para null/undefined', () => {
      expect(parseError(null)).toContain('desconocido');
      expect(parseError(undefined)).toContain('desconocido');
    });
  });

  describe('createError', () => {
    it('debe crear objeto de error estructurado', () => {
      const error = createError('Usuario no encontrado', 'NOT_FOUND', 404);
      expect(error.mensaje).toBe('Usuario no encontrado');
      expect(error.codigo).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('debe usar statusCode por defecto', () => {
      const error = createError('Error', 'CODE');
      expect(error.statusCode).toBe(500);
    });
  });
});

describe('Utils - Validation', () => {
  describe('isValidEmail', () => {
    it('debe validar emails correctos', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
    });

    it('debe rechazar emails inválidos', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('debe validar UUID válido', () => {
      expect(
        isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479'),
      ).toBe(true);
    });

    it('debe rechazar UUID inválido', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
    });
  });
});

describe('Utils - Array Operations', () => {
  describe('groupBy', () => {
    it('debe agrupar array por propiedad', () => {
      const items = [
        { role: 'user', text: 'Hola' },
        { role: 'assistant', text: 'Hola!' },
        { role: 'user', text: 'Qué tal?' },
      ];

      const grouped = groupBy(items, (item) => item.role);
      expect(grouped.user).toHaveLength(2);
      expect(grouped.assistant).toHaveLength(1);
    });

    it('debe manejar array vacío', () => {
      const grouped = groupBy([], (item) => String(item));
      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });

  describe('dedupe', () => {
    it('debe remover duplicados de números', () => {
      const resultado = dedupe([1, 2, 2, 3, 3, 3]);
      expect(resultado).toEqual([1, 2, 3]);
    });

    it('debe remover duplicados de objetos', () => {
      const items = [
        { id: 1, name: 'Juan' },
        { id: 2, name: 'María' },
        { id: 1, name: 'Juan' },
      ];

      const resultado = dedupe(items, (item) => String(item.id));
      expect(resultado).toHaveLength(2);
    });

    it('debe preservar orden', () => {
      const resultado = dedupe([3, 1, 2, 1, 3]);
      expect(resultado[0]).toBe(3);
      expect(resultado[1]).toBe(1);
    });
  });

  describe('arrayToCSV', () => {
    it('debe convertir array a CSV', () => {
      const data = [
        { name: 'Juan', age: 30 },
        { name: 'María', age: 25 },
      ];

      const csv = arrayToCSV(data);
      expect(csv).toContain('name');
      expect(csv).toContain('Juan');
      expect(csv).toContain('30');
    });

    it('debe escapar comillas en valores', () => {
      const data = [{ text: 'Texto con "comillas"' }];
      const csv = arrayToCSV(data);
      expect(csv).toContain('""');
    });

    it('debe manejar array vacío', () => {
      const csv = arrayToCSV([]);
      expect(csv).toBe('');
    });
  });
});

describe('Utils - String Comparison', () => {
  describe('compareStrings', () => {
    it('debe comparar strings ignorando caso', () => {
      expect(compareStrings('Hola', 'hola')).toBe(true);
      expect(compareStrings('HOLA', 'hola')).toBe(true);
    });

    it('debe ignorar espacios', () => {
      expect(compareStrings('  Hola  ', 'hola')).toBe(true);
    });

    it('debe retornar false si son diferentes', () => {
      expect(compareStrings('Hola', 'Adiós')).toBe(false);
    });
  });
});
