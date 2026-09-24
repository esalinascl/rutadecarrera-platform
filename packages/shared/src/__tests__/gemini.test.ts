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
} from '../utils/gemini';
import type { GeminiMessage, Message, ContextoInicial } from '../types';

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

  it('debe lanzar error si timeout excedido', async () => {
    (global.fetch as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({}),
            });
          }, 100),
        ),
    );

    const messages: GeminiMessage[] = [
      { role: 'user', parts: [{ text: 'Hola' }] },
    ];

    // Simular abort
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    // Este test verifica el comportamiento con timeout pequeño
    const start = Date.now();
    try {
      await callGemini(messages, 'AIzaSyD' + 'a'.repeat(30), {
        timeout: 50,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(GeminiError);
      expect((error as GeminiError).code).toBe('TIMEOUT');
    }
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
    expect(prompt).toContain('CONTEXTO DEL USUARIO').toBe(false);
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
    expect(prompt).toContain('CONTEXTO DEL USUARIO').toBe(false);
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
        creado_en: new Date(),
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
        creado_en: new Date(),
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
        creado_en: new Date(),
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
