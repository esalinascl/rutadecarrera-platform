/**
 * @file utils/creditos.ts
 * @description Cálculo de saldo del módulo de créditos (BORRADOR).
 *
 * Fuente funcional: vault, "600 PROYECTOS/650 F&S RUTA DE CARRERA/
 * SPEC — Paquetes y Créditos de Tests (Interno).md" v0.4.
 *
 * Este archivo existe antes que el repositorio de Supabase a propósito
 * (TDD, mandato #3 de CLAUDE.md: créditos son una regla de negocio crítica).
 * La re-planificación de TASKS (auth, RLS — ver
 * 600 PROYECTOS/TAREAS/Re-planificar TASKS para una sola app y módulo de
 * créditos.md) todavía no está resuelta, así que el repositorio que va a
 * leer/escribir `movimientos_credito` en Supabase queda para después. Lo
 * que sí se puede fijar y probar ya es la regla de cálculo del saldo, que no
 * depende de cómo se autentique nadie.
 */

import type { MovimientoCredito, SaldoCredito, TipoMovimientoCredito } from '../types';

/**
 * Efecto de un tipo de movimiento sobre cada bucket del saldo, como
 * multiplicador de `magnitud` (que siempre es >= 0, salvo en
 * `'ajuste_admin'`). Ver el docstring de `TipoMovimientoCredito` para el
 * porqué de esta convención.
 */
const REGLAS_POR_TIPO: Record<
  TipoMovimientoCredito,
  { disponibles: number; reservados: number; usados: number }
> = {
  // Compra: entra a disponibles (RF-C1).
  compra: { disponibles: 1, reservados: 0, usados: 0 },
  // Enviar un test: sale de disponibles, entra a reservados (RF-C3, D-C2).
  reserva: { disponibles: -1, reservados: 1, usados: 0 },
  // Link expira o se revoca: sale de reservados, vuelve a disponibles (RF-C4).
  liberacion: { disponibles: 1, reservados: -1, usados: 0 },
  // Cliente completa el test: sale de reservados, entra a usados (RF-C5).
  consumo: { disponibles: 0, reservados: -1, usados: 1 },
  // Asistente: sale directo de disponibles y entra a usados, sin reserva
  // previa (D-C6/D-C7) — a diferencia de los tests, el consumo del
  // asistente se conoce solo después de la respuesta de Gemini.
  consumo_tokens: { disponibles: -1, reservados: 0, usados: 1 },
  // Ajuste manual de Eduardo (RF-C7): magnitud puede ser + o -, va directo
  // a disponibles. Única excepción a "magnitud siempre >= 0".
  ajuste_admin: { disponibles: 1, reservados: 0, usados: 0 },
  // Revierte una compra no usada (D-C5: política de reembolso a confirmar).
  reembolso: { disponibles: -1, reservados: 0, usados: 0 },
};

/**
 * Calcula el saldo (disponibles / reservados / usados) sumando un libro de
 * movimientos de créditos (NF-1 de la SPEC: el saldo nunca se guarda como
 * campo editable).
 *
 * @param movimientos - Movimientos YA filtrados para un solo (usuario_id,
 *   producto_id). Esta función no filtra por su cuenta: si se le pasan
 *   movimientos de productos distintos, los suma igual (ver test dedicado).
 *   Filtrar es responsabilidad de quien arma la consulta a Supabase
 *   (`WHERE usuario_id = ? AND producto_id = ?`).
 * @throws Error si algún movimiento trae un `tipo` no reconocido (dato
 *   corrupto — con el tipo TypeScript esto no debería pasar en código
 *   propio, pero sí puede llegar así desde una fila de la base de datos).
 *
 * @example
 * calcularSaldoCredito([
 *   { tipo: 'compra', magnitud: 10, ... },
 *   { tipo: 'reserva', magnitud: 1, ... },
 * ]);
 * // { disponibles: 9, reservados: 1, usados: 0 }
 */
export function calcularSaldoCredito(movimientos: readonly MovimientoCredito[]): SaldoCredito {
  const saldo: SaldoCredito = { disponibles: 0, reservados: 0, usados: 0 };

  for (const movimiento of movimientos) {
    const regla = REGLAS_POR_TIPO[movimiento.tipo];

    if (!regla) {
      throw new Error(
        `Movimiento de crédito con tipo no reconocido: "${movimiento.tipo}" (id: ${movimiento.id})`,
      );
    }

    saldo.disponibles += regla.disponibles * movimiento.magnitud;
    saldo.reservados += regla.reservados * movimiento.magnitud;
    saldo.usados += regla.usados * movimiento.magnitud;
  }

  return saldo;
}
