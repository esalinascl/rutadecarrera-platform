/**
 * @file lib/auth/__tests__/limitador.test.ts
 * @description Tests del límite de envíos de Magic Link (TASK 9).
 */

import { describe, it, expect } from 'vitest';
import { crearLimitador, claveLimite } from '../limitador';

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

describe('claveLimite', () => {
  it('normaliza el email (mayúsculas y espacios) y lo une con la IP', () => {
    expect(claveLimite('  Ana@Correo.CL ', '1.2.3.4')).toBe('ana@correo.cl|1.2.3.4');
  });

  it('usa "desconocida" si no hay IP', () => {
    expect(claveLimite('a@b.cl', null)).toBe('a@b.cl|desconocida');
  });
});
