/**
 * @file api/health/route.ts
 * @description GET /api/health — salud de la base de datos (SPEC — health-db).
 *
 * Endpoint PÚBLICO (lo llama GitHub Actions desde `monitoring.yml`, sin credenciales). Por eso:
 * - no acepta parámetros ni cuerpo: la consulta es fija;
 * - el cuerpo tiene SOLO `estado` y `revisado_en`: nunca mensajes de error, direcciones ni claves;
 * - el resultado se guarda 30 s (ver `lib/salud`), así que repetir la llamada no satura la base.
 *
 * 200 → la base responde · 503 → la base no responde, venció el tiempo o falta configuración.
 */

import { NextResponse } from 'next/server';
import { verificarSalud } from '../../../lib/salud';

/** Nunca se sirve una copia guardada: cada llamada debe reflejar el estado actual. */
export const dynamic = 'force-dynamic';

const CABECERAS = { 'Cache-Control': 'no-store' } as const;

export async function GET(): Promise<NextResponse> {
  try {
    const { estado, revisadoEn } = await verificarSalud();
    return NextResponse.json(
      { estado, revisado_en: revisadoEn },
      { status: estado === 'ok' ? 200 : 503, headers: CABECERAS },
    );
  } catch {
    // Defensa extra: `verificarSalud` no debería lanzar nunca. Si lo hiciera, no se filtra nada.
    return NextResponse.json(
      { estado: 'error', revisado_en: new Date().toISOString() },
      { status: 503, headers: CABECERAS },
    );
  }
}
