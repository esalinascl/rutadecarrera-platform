/**
 * @file __tests__/gemini.test.ts
 * @description Tests para helpers de Gemini API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  callGemini,
  formatGeminiPrompt,
  extractAnalysis,
  validateGeminiApiKey,
  GeminiError,
  estimateProcessingTime,
  getDefaultGeminiConfig,
  sanitizeGeminiResponse,
  ocultarSecretos,
} from '../utils/gemini';
import type { GeminiMessage, Message, ContextoInicial } from '../types';

/** Fecha fija en ISO 8601: así llegan las fechas desde Supabase y la API. */
const FECHA_ISO = '2026-09-24T10:30:00.000Z';

// Mock fetch global
global.fetch = vi.fn();

describe('Gemini - Validation', () => {
  describe('validateGeminiApiKey', () => {
    it('debe validar API key válida', () => {
      const validKey = 'AIzaSyD' + 'a'.repeat(30);
      expect(() => validateGeminiApiKey(validKey)).not.toThrow();
    });

    it('debe rechazar API key faltante', () => {
      expect(() => validateGeminiApiKey('')).toThrow(GeminiError);
    });

    it('debe rechazar API key tipo inválido', () => {
      expect(() => validateGeminiApiKey(null as any)).toThrow(GeminiError);
    });

    it('debe rechazar API key muy corta', () => {
      expect(() => validateGeminiApiKey('short')).toThrow(GeminiError);
    });
  });
});

describe('Gemini - callGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar respuesta válida', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Respuesta del asistente' }],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        totalTokenCount: 150,
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const messages: GeminiMessage[] = [
      {
        role: 'user',
        parts: [{ text: 'Hola' }],
      },
    ];

    const respuesta = await callGemini(
      messages,
      'AIzaSyD' + 'a'.repeat(30),
      { timeout: 5000 },
    );

    expect(respuesta.response).toBe('Respuesta del asistente');
    expect(respuesta.tokensUsed).toBe(150);
    expect(respuesta.model).toBe('gemini-pro');
  });

  it('debe lanzar error si API retorna error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: 'Unauthorized' },
      }),
    });

    const messages: GeminiMessage[] = [
      { role: 'user', parts: [{ text: 'Hola' }] },
    ];

    await expect(
      callGemini(messages, 'AIzaSyD' + 'a'.repeat(30)),
    ).rejects.toThrow(GeminiError);
  });

  /**
   * Rechaza con AbortError cuando se cancela la señal, igual que un fetch real.
   * (El mock anterior ignoraba la señal y el test no podía detectar el bug.)
   */
  function rechazarAlCancelar(signal: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () =>
        reject(new DOMException('La operación fue cancelada', 'AbortError')),
      );
    });
  }

  it('lanza TIMEOUT si Gemini no responde a tiempo (requisito de latencia de la SPEC)', async () => {
    (global.fetch as any).mockImplementation(
      (_url: string, init: RequestInit) => rechazarAlCancelar(init.signal!),
    );

    const messages: GeminiMessage[] = [{ role: 'user', parts: [{ text: 'Hola' }] }];

    await expect(
      callGemini(messages, 'AIzaSyD' + 'a'.repeat(30), { timeout: 50 }),
    ).rejects.toMatchObject({ name: 'GeminiError', code: 'TIMEOUT' });
  });

  it('lanza TIMEOUT también si los encabezados llegan pero el cuerpo se demora', async () => {
    (global.fetch as any).mockImplementation(async (_url: string, init: RequestInit) => ({
      ok: true,
      json: () => rechazarAlCancelar(init.signal!),
    }));

    const messages: GeminiMessage[] = [{ role: 'user', parts: [{ text: 'Hola' }] }];

    await expect(
      callGemini(messages, 'AIzaSyD' + 'a'.repeat(30), { timeout: 50 }),
    ).rejects.toMatchObject({ name: 'GeminiError', code: 'TIMEOUT' });
  });

  it('envía la API key en el header x-goog-api-key y nunca en la URL', async () => {
    const apiKey = 'AIzaSyD' + 'a'.repeat(30);
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        usageMetadata: { totalTokenCount: 3 },
      }),
    });

    await callGemini([{ role: 'user', parts: [{ text: 'Hola' }] }], apiKey);

    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).not.toContain(apiKey);
    expect(url).not.toContain('key=');
    expect(init.headers['x-goog-api-key']).toBe(apiKey);
  });

  it('debe rechazar mensajes vacíos', async () => {
    await expect(
      callGemini([], 'AIzaSyD' + 'a'.repeat(30)),
    ).rejects.toThrow(GeminiError);
  });

  it('debe validar API key antes de llamar', async () => {
    const messages: GeminiMessage[] = [
      { role: 'user', parts: [{ text: 'Hola' }] },
    ];

    await expect(callGemini(messages, '')).rejects.toThrow(GeminiError);
  });

  it('debe usar opciones personalizadas', async () => {
    const mockResponse = {
      candidates: [
        { content: { parts: [{ text: 'Respuesta' }] } },
      ],
      usageMetadata: { totalTokenCount: 100 },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const messages: GeminiMessage[] = [
      { role: 'user', parts: [{ text: 'Hola' }] },
    ];

    await callGemini(messages, 'AIzaSyD' + 'a'.repeat(30), {
      temperature: 0.5,
      maxTokens: 500,
      model: 'gemini-pro',
    });

    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[0]).toContain('gemini-pro');
  });
});

describe('Gemini - formatGeminiPrompt', () => {
  it('debe retornar prompt base sin contexto', () => {
    const prompt = formatGeminiPrompt();
    expect(prompt).toContain('coaching');
    expect(prompt).toContain('empleabilidad');
    expect(prompt).not.toContain('CONTEXTO DEL USUARIO');
  });

  it('debe incluir contexto si es proporcionado', () => {
    const contexto: ContextoInicial = {
      situacion: 'Desempleado',
      objetivo: 'Conseguir trabajo en tech',
      habilidades: ['JavaScript', 'React'],
    };

    const prompt = formatGeminiPrompt(contexto);
    expect(prompt).toContain('CONTEXTO DEL USUARIO');
    expect(prompt).toContain('Desempleado');
    expect(prompt).toContain('JavaScript');
  });

  it('debe manejar contexto parcial', () => {
    const contexto: ContextoInicial = {
      objetivo: 'Cambiar de carrera',
    };

    const prompt = formatGeminiPrompt(contexto);
    expect(prompt).toContain('Cambiar de carrera');
  });

  it('debe retornar prompt base si contexto vacío', () => {
    const prompt = formatGeminiPrompt({});
    expect(prompt).toContain('coaching');
    expect(prompt).not.toContain('CONTEXTO DEL USUARIO');
  });
});

describe('Gemini - extractAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe extraer análisis válido', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  fortalezas: ['Liderazgo', 'Comunicación'],
                  brechas: ['SQL', 'Cloud'],
                  recomendaciones: ['Aprender SQL', 'AWS training'],
                  proximos_pasos: ['Actualizar CV', 'Networking'],
                  puntuacion_empleabilidad: 75,
                  resumen: 'Buen candidato',
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: { totalTokenCount: 200 },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const messages: Message[] = [
      {
        id: 'msg-1',
        conversacion_id: 'conv-1',
        rol: 'user',
        contenido: 'Soy ingeniero de software',
        tokens_usage: null,
        creado_en: FECHA_ISO,
      },
    ];

    const análisis = await extractAnalysis(
      messages,
      'AIzaSyD' + 'a'.repeat(30),
    );

    expect(análisis.fortalezas).toContain('Liderazgo');
    expect(análisis.brechas).toContain('SQL');
    expect(análisis.recomendaciones.length).toBeGreaterThan(0);
    expect(análisis.proximos_pasos.length).toBeGreaterThan(0);
  });

  it('debe rechazar mensajes vacíos', async () => {
    await expect(
      extractAnalysis([], 'AIzaSyD' + 'a'.repeat(30)),
    ).rejects.toThrow(GeminiError);
  });

  it('debe manejar respuesta JSON inválida', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: 'Texto sin JSON' }] },
          },
        ],
        usageMetadata: { totalTokenCount: 100 },
      }),
    });

    const messages: Message[] = [
      {
        id: 'msg-1',
        conversacion_id: 'conv-1',
        rol: 'user',
        contenido: 'Mensaje',
        tokens_usage: null,
        creado_en: FECHA_ISO,
      },
    ];

    await expect(
      extractAnalysis(messages, 'AIzaSyD' + 'a'.repeat(30)),
    ).rejects.toThrow(GeminiError);
  });

  it('debe validar estructura de análisis', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    fortalezas: [],
                    brechas: [],
                    recomendaciones: [],
                    proximos_pasos: [],
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: { totalTokenCount: 100 },
      }),
    });

    const messages: Message[] = [
      {
        id: 'msg-1',
        conversacion_id: 'conv-1',
        rol: 'user',
        contenido: 'Mensaje',
        tokens_usage: null,
        creado_en: FECHA_ISO,
      },
    ];

    // Debería fallar porque los arrays están vacíos
    await expect(
      extractAnalysis(messages, 'AIzaSyD' + 'a'.repeat(30)),
    ).rejects.toThrow();
  });
});

describe('Gemini - Utility Functions', () => {
  describe('estimateProcessingTime', () => {
    it('debe estimar tiempo de procesamiento', () => {
      const tiempo = estimateProcessingTime(100);
      expect(tiempo).toBeGreaterThan(0);
      expect(tiempo).toBeLessThan(500); // < 500ms para 100 tokens
    });

    it('debe aumentar con más tokens', () => {
      const tiempo100 = estimateProcessingTime(100);
      const tiempo1000 = estimateProcessingTime(1000);
      expect(tiempo1000).toBeGreaterThan(tiempo100);
    });
  });

  describe('getDefaultGeminiConfig', () => {
    it('debe retornar configuración por defecto', () => {
      const config = getDefaultGeminiConfig();
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(2048);
      expect(config.timeout).toBe(5000);
      expect(config.model).toBe('gemini-pro');
    });
  });

  describe('sanitizeGeminiResponse', () => {
    it('debe sanitizar respuesta sensible', () => {
      const response = {
        response:
          'Aquí está tu API key: sk-12345 y token: abc123',
        tokensUsed: 100,
        model: 'gemini-pro',
      };

      const sanitizada = sanitizeGeminiResponse(response);
      expect(sanitizada.response).toContain('[REDACTED]');
      expect(sanitizada.response).not.toContain('sk-12345');
      expect(sanitizada.response).not.toContain('abc123');
    });

    it('oculta claves con formato conocido aunque no tengan etiqueta', () => {
      const claveGoogle = 'AIza' + 'B'.repeat(35);
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.firmaFalsa123';
      const response = {
        response: `Usa ${claveGoogle} o ${jwt} para conectar`,
        tokensUsed: 10,
        model: 'gemini-pro',
      };

      const sanitizada = sanitizeGeminiResponse(response);
      expect(sanitizada.response).not.toContain(claveGoogle);
      expect(sanitizada.response).not.toContain(jwt);
    });

    it('NO altera texto de coaching que menciona API, token o clave', () => {
      const texto =
        'La clave de tu transición es aprender a diseñar una API REST y entender cómo funciona un token de sesión.';
      const response = { response: texto, tokensUsed: 10, model: 'gemini-pro' };

      expect(sanitizeGeminiResponse(response).response).toBe(texto);
    });

    // Encontrado en la revisión del PR #5: "etiqueta: palabra" es muy común en
    // español y la versión anterior censuraba la palabra.
    it.each([
      'Punto clave: constancia en tu búsqueda.',
      'La clave: practicar entrevistas cada semana.',
      'Palabra clave: liderazgo.',
      'Token: unidad mínima de texto que procesa un modelo.',
      'Secret: no hay atajos, solo práctica.',
    ])('NO altera la frase de coaching "%s"', (frase) => {
      expect(ocultarSecretos(frase)).toBe(frase);
    });

    it.each([
      ['password: hunter2', 'hunter2'],
      ['contraseña: Chile2026', 'Chile2026'],
      ['api key: AIzaSyD123', 'AIzaSyD123'],
      ['token=abc123', 'abc123'],
      ['secret: kQ7pZ2xL9mN4vB8wR1tY', 'kQ7pZ2xL9mN4vB8wR1tY'],
    ])('oculta el valor en "%s"', (texto, secreto) => {
      const resultado = ocultarSecretos(texto);
      expect(resultado).toContain('[REDACTED]');
      expect(resultado).not.toContain(secreto);
    });

    it('debe preservar respuesta normal', () => {
      const response = {
        response: 'Aquí está tu análisis de empleabilidad',
        tokensUsed: 100,
        model: 'gemini-pro',
      };

      const sanitizada = sanitizeGeminiResponse(response);
      expect(sanitizada.response).toBe(
        'Aquí está tu análisis de empleabilidad',
      );
    });
  });
});

describe('Gemini - Error Handling', () => {
  it('debe crear GeminiError con propiedades correctas', () => {
    const error = new GeminiError('Mensaje de error', 'TEST_CODE', 400);
    expect(error.message).toBe('Mensaje de error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('GeminiError');
  });
});
