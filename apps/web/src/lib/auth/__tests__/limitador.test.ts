/**
 * @file lib/auth/__tests__/limitador.test.ts
 * @description Tests del límite de envíos de Magic Link (TASK 9).
 */

import { describe, it, expect } from 'vitest';
import { crearLimitador, claveEmail, claveIp } from '../limitador';

describe('crearLimitador', () => {
  it('permite hasta el máximo y bloquea el siguiente', () => {
    const ahora = 1_000;
    const limitador = crearLimitador({ max: 3, ventanaMs: 60_000, reloj: () => ahora });
    expect(limitador.permitir('a')).toBe(true);
    expect(limitador.permitir('a')).toBe(true);
    expect(limitador.permitir('a')).toBe(true);
    expect(limitador.permitir('a')).toBe(false);
  });

  it('cada clave tiene su propio contador', () => {
    const limitador = crearLimitador({ max: 1, ventanaMs: 60_000, reloj: () => 0 });
    expect(limitador.permitir('a')).toBe(true);
    expect(limitador.permitir('b')).toBe(true);
    expect(limitador.permitir('a')).toBe(false);
  });

  it('se reinicia al terminar la ventana', () => {
    let ahora = 0;
    const limitador = crearLimitador({ max: 1, ventanaMs: 60_000, reloj: () => ahora });
    expect(limitador.permitir('a')).toBe(true);
    expect(limitador.permitir('a')).toBe(false);
    ahora = 60_001;
    expect(limitador.permitir('a')).toBe(true);
  });

  it('no acumula claves vencidas sin límite (limpia al superar el tope de entradas)', () => {
    let ahora = 0;
    const limitador = crearLimitador({ max: 1, ventanaMs: 10, reloj: () => ahora, maxEntradas: 5 });
    for (let i = 0; i < 5; i++) limitador.permitir(`k${i}`);
    ahora = 100;
    limitador.permitir('nueva');
    expect(limitador.tamano()).toBe(1);
  });
});

describe('crearLimitador — tope duro de memoria', () => {
  it('con todas las claves vivas y el mapa lleno, rechaza las claves nuevas (no crece sin límite)', () => {
    const limitador = crearLimitador({ max: 1, ventanaMs: 60_000, reloj: () => 0, maxEntradas: 3 });
    expect(limitador.permitir('a')).toBe(true);
    expect(limitador.permitir('b')).toBe(true);
    expect(limitador.permitir('c')).toBe(true);

    expect(limitador.permitir('d')).toBe(false);
    expect(limitador.tamano()).toBe(3);
  });

  it('una clave ya registrada sigue su propio conteo aunque el mapa esté lleno', () => {
    const limitador = crearLimitador({ max: 2, ventanaMs: 60_000, reloj: () => 0, maxEntradas: 1 });
    expect(limitador.permitir('a')).toBe(true);
    expect(limitador.permitir('a')).toBe(true);
    expect(limitador.permitir('a')).toBe(false);
  });
});

describe('claves de límite', () => {
  it('claveEmail normaliza mayúsculas y espacios', () => {
    expect(claveEmail('  Ana@Correo.CL ')).toBe('ana@correo.cl');
  });

  it('claveIp usa "desconocida" si no hay IP y acota el largo', () => {
    expect(claveIp(null)).toBe('desconocida');
    expect(claveIp('x'.repeat(500))).toHaveLength(64);
  });
});
