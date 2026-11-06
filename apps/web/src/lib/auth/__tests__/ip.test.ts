/**
 * @file lib/auth/__tests__/ip.test.ts
 * @description Tests de `obtenerIp` (TASK 9): qué encabezado se considera confiable.
 */

import { describe, it, expect } from 'vitest';
import { obtenerIp } from '../ip';

describe('obtenerIp', () => {
  it('prefiere el encabezado que fija la plataforma (Vercel) sobre x-forwarded-for', () => {
    const h = new Headers({ 'x-vercel-forwarded-for': '1.1.1.1', 'x-forwarded-for': '6.6.6.6, 1.1.1.1' });
    expect(obtenerIp(h)).toBe('1.1.1.1');
  });

  it('usa x-real-ip si no hay encabezado de Vercel', () => {
    expect(obtenerIp(new Headers({ 'x-real-ip': '2.2.2.2' }))).toBe('2.2.2.2');
  });

  it('con solo x-forwarded-for toma el ÚLTIMO valor (el que añadió el proxy más cercano), no el primero falsificable', () => {
    expect(obtenerIp(new Headers({ 'x-forwarded-for': '6.6.6.6, 3.3.3.3' }))).toBe('3.3.3.3');
  });

  it('devuelve null si no hay ninguna pista', () => {
    expect(obtenerIp(new Headers())).toBeNull();
  });
});
