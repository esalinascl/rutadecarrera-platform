/**
 * @file __tests__/creditos.test.ts
 * @description Tests del cálculo de saldo del módulo de créditos (BORRADOR).
 *
 * TDD real: estos tests se escribieron ANTES que `calcularSaldoCredito`
 * (ver utils/creditos.ts). Cubren los casos límite de "Créditos IA del
 * asistente" y "Créditos de test" de la sección 8 de la SPEC — Paquetes y
 * Créditos de Tests (Interno).md v0.4, en la parte que es lógica pura (sin
 * tocar Supabase, sin locks de concurrencia — eso es NF-2, fuera de alcance
 * de esta función).
 *
 * Deliberadamente NO se testea contra un repositorio ni una tabla real: la
 * re-planificación de TASKS (auth, RLS) sigue pendiente. Esta función es la
 * pieza que sí se puede fijar y probar ya, porque no depende de auth.
 */

import { describe, expect, it } from 'vitest';
import { calcularSaldoCredito } from '../utils/creditos';
import type { MovimientoCredito, TipoMovimientoCredito } from '../types';

const USUARIO_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PRODUCTO_DISC = 'a1a1a1a1-0000-4000-8000-000000000001';
const PRODUCTO_ASISTENTE = 'a1a1a1a1-0000-4000-8000-000000000002';

let contador = 0;

/** Construye un movimiento de prueba con solo los campos que importan al test. */
function movimiento(
  tipo: TipoMovimientoCredito,
  magnitud: number,
  producto_id: string = PRODUCTO_DISC,
): MovimientoCredito {
  contador += 1;
  return {
    id: `mov-${contador}`,
    usuario_id: USUARIO_ID,
    producto_id,
    tipo,
    magnitud,
    compra_id: null,
    invitacion_id: null,
    mensaje_id: null,
    autor_id: null,
    motivo: null,
    creado_en: '2026-09-28T00:00:00.000Z',
  };
}

describe('calcularSaldoCredito', () => {
  it('devuelve saldo en cero para una lista vacía', () => {
    expect(calcularSaldoCredito([])).toEqual({ disponibles: 0, reservados: 0, usados: 0 });
  });

  it('una compra suma directo a disponibles', () => {
    const saldo = calcularSaldoCredito([movimiento('compra', 10)]);
    expect(saldo).toEqual({ disponibles: 10, reservados: 0, usados: 0 });
  });

  it('reservar mueve de disponibles a reservados (RF-C3: enviar un test)', () => {
    const saldo = calcularSaldoCredito([movimiento('compra', 10), movimiento('reserva', 1)]);
    expect(saldo).toEqual({ disponibles: 9, reservados: 1, usados: 0 });
  });

  it('completar el test mueve de reservados a usados (RF-C5)', () => {
    const saldo = calcularSaldoCredito([
      movimiento('compra', 10),
      movimiento('reserva', 1),
      movimiento('consumo', 1),
    ]);
    expect(saldo).toEqual({ disponibles: 9, reservados: 0, usados: 1 });
  });

  it('liberar (link expirado o revocado) devuelve el crédito reservado a disponibles (RF-C4)', () => {
    const saldo = calcularSaldoCredito([
      movimiento('compra', 10),
      movimiento('reserva', 1),
      movimiento('liberacion', 1),
    ]);
    expect(saldo).toEqual({ disponibles: 10, reservados: 0, usados: 0 });
  });

  it('un ajuste administrativo positivo suma a disponibles (RF-C7)', () => {
    const saldo = calcularSaldoCredito([movimiento('ajuste_admin', 5)]);
    expect(saldo).toEqual({ disponibles: 5, reservados: 0, usados: 0 });
  });

  it('un ajuste administrativo negativo resta de disponibles (única excepción a magnitud >= 0)', () => {
    const saldo = calcularSaldoCredito([movimiento('compra', 10), movimiento('ajuste_admin', -3)]);
    expect(saldo).toEqual({ disponibles: 7, reservados: 0, usados: 0 });
  });

  it('un reembolso resta de disponibles (revierte una compra no usada, D-C5)', () => {
    const saldo = calcularSaldoCredito([movimiento('compra', 10), movimiento('reembolso', 4)]);
    expect(saldo).toEqual({ disponibles: 6, reservados: 0, usados: 0 });
  });

  it('el consumo de tokens del asistente resta de disponibles y suma a usados sin pasar por reservados (D-C6, RF-C8)', () => {
    const saldo = calcularSaldoCredito([
      movimiento('compra', 500_000, PRODUCTO_ASISTENTE),
      movimiento('consumo_tokens', 4_237, PRODUCTO_ASISTENTE),
    ]);
    expect(saldo).toEqual({ disponibles: 495_763, reservados: 0, usados: 4_237 });
  });

  it('un consumo de tokens que excede el saldo puede dejarlo negativo (P9/D-C7: la respuesta ya se entregó completa)', () => {
    const saldo = calcularSaldoCredito([
      movimiento('compra', 100, PRODUCTO_ASISTENTE),
      movimiento('consumo_tokens', 150, PRODUCTO_ASISTENTE),
    ]);
    expect(saldo.disponibles).toBe(-50);
  });

  it('asume que la lista ya viene filtrada por (usuario_id, producto_id); no filtra por su cuenta', () => {
    // Si al llamador se le olvida filtrar, el resultado mezcla productos —
    // documentado a propósito: filtrar es responsabilidad del repositorio
    // (WHERE usuario_id = ? AND producto_id = ?), no de esta función pura.
    const saldo = calcularSaldoCredito([
      movimiento('compra', 10, PRODUCTO_DISC),
      movimiento('compra', 500, PRODUCTO_ASISTENTE),
    ]);
    expect(saldo.disponibles).toBe(510);
  });

  it('lanza un error claro si llega un tipo de movimiento no reconocido (dato corrupto de la BD)', () => {
    const movimientoCorrupto = {
      ...movimiento('compra', 1),
      tipo: 'tipo_inventado' as TipoMovimientoCredito,
    };
    expect(() => calcularSaldoCredito([movimientoCorrupto])).toThrow(/tipo_inventado/);
  });
});
