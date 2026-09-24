/**
 * @file __tests__/validation.test.ts
 * @description Tests para schemas y funciones de validación
 */

import { describe, it, expect } from 'vitest';
import {
  userSchema,
  createUserSchema,
  messageSchema,
  chatRequestSchema,
  chatResponseSchema,
  analysisRequestSchema,
  contextoSchema,
  validateUser,
  validateChatRequest,
  safeValidate,
  parseZodError,
  formatZodError,
  validateMany,
} from '../utils/validation';
import type { User, ChatRequest } from '../types';

/** Fecha fija en ISO 8601: así llegan las fechas desde Supabase y la API. */
const FECHA_ISO = '2026-09-24T10:30:00.000Z';

describe('Validation - Schemas', () => {
  describe('contextoSchema', () => {
    it('debe validar contexto válido', () => {
      const contexto = {
        situacion: 'Desempleado',
        objetivo: 'Conseguir trabajo',
        habilidades: ['JavaScript', 'React'],
      };

      expect(() => contextoSchema.parse(contexto)).not.toThrow();
    });

    it('debe validar contexto vacío', () => {
      expect(() => contextoSchema.parse({})).not.toThrow();
    });
  });

  describe('userSchema', () => {
    it('debe validar usuario correcto', () => {
      const usuario: User = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'test@example.com',
        nombre: 'Juan Pérez',
        contexto_inicial: null,
        creado_en: FECHA_ISO,
        actualizado_en: FECHA_ISO,
      };

      expect(() => userSchema.parse(usuario)).not.toThrow();
    });

    it('debe rechazar email inválido', () => {
      const usuario = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'invalid-email',
        nombre: 'Juan',
        contexto_inicial: null,
        creado_en: FECHA_ISO,
        actualizado_en: FECHA_ISO,
      };

      expect(() => userSchema.parse(usuario)).toThrow();
    });

    it('debe rechazar nombre muy corto', () => {
      const usuario = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'test@example.com',
        nombre: 'J',
        contexto_inicial: null,
        creado_en: FECHA_ISO,
        actualizado_en: FECHA_ISO,
      };

      expect(() => userSchema.parse(usuario)).toThrow();
    });

    it('debe rechazar UUID inválido', () => {
      const usuario = {
        id: 'not-a-uuid',
        email: 'test@example.com',
        nombre: 'Juan',
        contexto_inicial: null,
        creado_en: FECHA_ISO,
        actualizado_en: FECHA_ISO,
      };

      expect(() => userSchema.parse(usuario)).toThrow();
    });
  });

  describe('createUserSchema', () => {
    it('debe validar crear usuario sin id y timestamps', () => {
      const datos = {
        email: 'test@example.com',
        nombre: 'Juan Pérez',
      };

      expect(() => createUserSchema.parse(datos)).not.toThrow();
    });

    it('debe rechazar si falta email', () => {
      const datos = {
        nombre: 'Juan Pérez',
      };

      expect(() => createUserSchema.parse(datos)).toThrow();
    });
  });

  describe('messageSchema', () => {
    it('debe validar mensaje correcto', () => {
      const mensaje = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        conversacion_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        rol: 'user' as const,
        contenido: 'Hola, ¿cómo estás?',
        tokens_usage: null,
        creado_en: FECHA_ISO,
      };

      expect(() => messageSchema.parse(mensaje)).not.toThrow();
    });

    it('debe rechazar contenido vacío', () => {
      const mensaje = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        conversacion_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        rol: 'user' as const,
        contenido: '',
        tokens_usage: null,
        creado_en: FECHA_ISO,
      };

      expect(() => messageSchema.parse(mensaje)).toThrow();
    });

    it('debe rechazar rol inválido', () => {
      const mensaje = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        conversacion_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        rol: 'invalid' as any,
        contenido: 'Hola',
        tokens_usage: null,
        creado_en: FECHA_ISO,
      };

      expect(() => messageSchema.parse(mensaje)).toThrow();
    });
  });

  describe('chatRequestSchema', () => {
    it('debe validar chat request correcto', () => {
      const request: ChatRequest = {
        usuario_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        mensaje: '¿Cómo mejoro mi CV?',
      };

      expect(() => chatRequestSchema.parse(request)).not.toThrow();
    });

    it('debe validar con conversacion_id opcional', () => {
      const request: ChatRequest = {
        usuario_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        conversacion_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        mensaje: 'Mensaje',
      };

      expect(() => chatRequestSchema.parse(request)).not.toThrow();
    });

    it('debe rechazar mensaje vacío', () => {
      const request = {
        usuario_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        mensaje: '',
      };

      expect(() => chatRequestSchema.parse(request)).toThrow();
    });

    it('debe rechazar mensaje muy largo', () => {
      const request = {
        usuario_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        mensaje: 'a'.repeat(5001),
      };

      expect(() => chatRequestSchema.parse(request)).toThrow();
    });

    it('debe rechazar usuario_id inválido', () => {
      const request = {
        usuario_id: 'not-a-uuid',
        mensaje: 'Hola',
      };

      expect(() => chatRequestSchema.parse(request)).toThrow();
    });
  });

  describe('chatResponseSchema', () => {
    it('debe validar chat response correcto', () => {
      const response = {
        respuesta: 'Aquí está mi respuesta...',
        tokens_used: 250,
        id_mensaje: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        conversacion_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        timestamp: FECHA_ISO,
      };

      expect(() => chatResponseSchema.parse(response)).not.toThrow();
    });

    it('debe rechazar tokens_used negativo', () => {
      const response = {
        respuesta: 'Respuesta',
        tokens_used: -100,
        id_mensaje: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        conversacion_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        timestamp: FECHA_ISO,
      };

      expect(() => chatResponseSchema.parse(response)).toThrow();
    });
  });

  describe('analysisRequestSchema', () => {
    it('debe validar analysis request correcto', () => {
      const request = {
        usuario_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        conversacion_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        tipo: 'empleabilidad' as const,
      };

      expect(() => analysisRequestSchema.parse(request)).not.toThrow();
    });

    it('debe rechazar tipo inválido', () => {
      const request = {
        usuario_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        conversacion_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        tipo: 'invalid' as any,
      };

      expect(() => analysisRequestSchema.parse(request)).toThrow();
    });
  });
});

describe('Validation - Helper Functions', () => {
  describe('validateUser', () => {
    it('debe validar usuario y retornar datos', () => {
      const usuario = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'test@example.com',
        nombre: 'Juan',
        contexto_inicial: null,
        creado_en: FECHA_ISO,
        actualizado_en: FECHA_ISO,
      };

      const resultado = validateUser(usuario);
      expect(resultado.email).toBe('test@example.com');
    });

    it('debe lanzar error si datos inválidos', () => {
      const usuario = {
        email: 'invalid',
      };

      expect(() => validateUser(usuario)).toThrow();
    });
  });

  describe('validateChatRequest', () => {
    it('debe validar chat request', () => {
      const request = {
        usuario_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        mensaje: 'Hola',
      };

      const resultado = validateChatRequest(request);
      expect(resultado.mensaje).toBe('Hola');
    });

    it('debe lanzar error si mensaje vacío', () => {
      const request = {
        usuario_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        mensaje: '',
      };

      expect(() => validateChatRequest(request)).toThrow();
    });
  });

  describe('safeValidate', () => {
    it('debe retornar { valido: true, datos } si es válido', () => {
      const usuario = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'test@example.com',
        nombre: 'Juan',
        contexto_inicial: null,
        creado_en: FECHA_ISO,
        actualizado_en: FECHA_ISO,
      };

      const resultado = safeValidate(usuario, userSchema);
      expect(resultado.valido).toBe(true);
      if (resultado.valido) {
        expect(resultado.datos.email).toBe('test@example.com');
      }
    });

    it('debe retornar { valido: false, error } si es inválido', () => {
      const usuario = {
        email: 'invalid',
      };

      const resultado = safeValidate(usuario, userSchema);
      expect(resultado.valido).toBe(false);
      if (!resultado.valido) {
        expect(Array.isArray(resultado.error)).toBe(true);
        expect(resultado.error.length).toBeGreaterThan(0);
      }
    });
  });

  describe('parseZodError', () => {
    it('debe convertir error Zod a formato amigable', () => {
      const usuario = { email: 'invalid' };

      try {
        userSchema.parse(usuario);
      } catch (error) {
        const errores = parseZodError(error);
        expect(Array.isArray(errores)).toBe(true);
        expect(errores[0].campo).toBeDefined();
        expect(errores[0].mensaje).toBeDefined();
      }
    });

    it('debe manejar error no-Zod', () => {
      const errores = parseZodError(new Error('Error genérico'));
      expect(errores[0].campo).toBe('general');
    });
  });

  describe('formatZodError', () => {
    it('debe crear string legible de error Zod', () => {
      const usuario = { email: 'invalid' };

      try {
        userSchema.parse(usuario);
      } catch (error) {
        const mensaje = formatZodError(error);
        expect(typeof mensaje).toBe('string');
        expect(mensaje.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateMany', () => {
    it('debe validar múltiples elementos', async () => {
      const usuario = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'test@example.com',
        nombre: 'Juan',
        contexto_inicial: null,
        creado_en: FECHA_ISO,
        actualizado_en: FECHA_ISO,
      };

      const mensaje = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        conversacion_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        rol: 'user' as const,
        contenido: 'Hola',
        tokens_usage: null,
        creado_en: FECHA_ISO,
      };

      const resultados = await validateMany([
        { datos: usuario, schema: userSchema },
        { datos: mensaje, schema: messageSchema },
      ]);

      expect(resultados.length).toBe(2);
      expect(resultados[0].valido).toBe(true);
      expect(resultados[1].valido).toBe(true);
    });

    it('debe detectar validaciones fallidas', async () => {
      const inválido = { email: 'invalid' };
      const válido = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'test@example.com',
        nombre: 'Juan',
        contexto_inicial: null,
        creado_en: FECHA_ISO,
        actualizado_en: FECHA_ISO,
      };

      const resultados = await validateMany([
        { datos: inválido, schema: userSchema },
        { datos: válido, schema: userSchema },
      ]);

      expect(resultados[0].valido).toBe(false);
      expect(resultados[1].valido).toBe(true);
    });
  });
});
