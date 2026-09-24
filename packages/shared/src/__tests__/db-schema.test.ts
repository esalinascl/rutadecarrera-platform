/**
 * Guardia de consistencia SQL ↔ TypeScript.
 *
 * Existe porque en FASE 1 convivieron dos esquemas distintos para la misma
 * base (tokens_usage vs tokens_used, columnas fantasma). Este test lee la
 * migración real y exige que cada tabla tenga exactamente las columnas que
 * declaran las entidades de `types/index.ts` (vía COLUMNAS_POR_TABLA).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLUMNAS_POR_TABLA, type NombreTabla } from '../db/schema';

const rutaMigracion = fileURLToPath(
  new URL('../db/migrations/001_init_schema.sql', import.meta.url)
);
const sql = readFileSync(rutaMigracion, 'utf8');

/** Extrae los nombres de columna de cada CREATE TABLE del SQL. */
function columnasDelSql(texto: string): Record<string, string[]> {
  const tablas: Record<string, string[]> = {};
  const patron = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\);/g;

  for (const [, nombre, cuerpo] of texto.matchAll(patron)) {
    tablas[nombre] = cuerpo
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea.length > 0 && !linea.startsWith('--'))
      .map((linea) => linea.split(/\s+/)[0]);
  }
  return tablas;
}

const tablasSql = columnasDelSql(sql);
const tablasTs = Object.keys(COLUMNAS_POR_TABLA) as NombreTabla[];

describe('Esquema SQL ↔ tipos TypeScript', () => {
  it('el SQL define exactamente las mismas tablas que los tipos', () => {
    expect(Object.keys(tablasSql).sort()).toEqual([...tablasTs].sort());
  });

  it.each(tablasTs)('la tabla "%s" tiene las mismas columnas en SQL y en TypeScript', (tabla) => {
    expect(tablasSql[tabla]).toEqual([...COLUMNAS_POR_TABLA[tabla]]);
  });

  it('usa TIMESTAMPTZ para todas las fechas (coincide con IsoDateString)', () => {
    expect(sql).not.toMatch(/\bTIMESTAMP\b(?!TZ)/);
  });

  it('activa Row Level Security en todas las tablas', () => {
    for (const tabla of tablasTs) {
      expect(sql).toContain(`ALTER TABLE ${tabla}`);
      expect(sql).toMatch(new RegExp(`ALTER TABLE ${tabla}\\s+ENABLE ROW LEVEL SECURITY`));
    }
  });

  it('es repetible (todas las tablas e índices usan IF NOT EXISTS)', () => {
    expect(sql).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(sql).not.toMatch(/CREATE INDEX (?!IF NOT EXISTS)/);
  });
});
