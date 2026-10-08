/**
 * Guardia de consistencia SQL ↔ TypeScript.
 *
 * Existe porque en FASE 1 convivieron dos esquemas distintos para la misma
 * base (tokens_usage vs tokens_used, columnas fantasma). Este test lee la
 * migración real y exige que cada tabla tenga exactamente las columnas que
 * declaran las entidades de `types/index.ts` (vía COLUMNAS_POR_TABLA).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLUMNAS_POR_TABLA, type NombreTabla } from '../db/schema';

const carpetaMigraciones = fileURLToPath(new URL('../db/migrations/', import.meta.url));
const sql = readFileSync(`${carpetaMigraciones}001_init_schema.sql`, 'utf8');

/** Todas las migraciones, en orden numérico (001, 002, 003...). */
const migraciones = readdirSync(carpetaMigraciones)
  .filter((nombre) => /^\d{3}_.*\.sql$/.test(nombre))
  .sort()
  .map((nombre) => readFileSync(`${carpetaMigraciones}${nombre}`, 'utf8'));

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

/**
 * Columnas finales de cada tabla: las del CREATE TABLE más las que agregan
 * después las migraciones con `ALTER TABLE ... ADD COLUMN`.
 */
function columnasFinales(textos: string[]): Record<string, string[]> {
  const tablas: Record<string, string[]> = {};
  for (const texto of textos) {
    for (const [tabla, columnas] of Object.entries(columnasDelSql(texto))) {
      tablas[tabla] = columnas;
    }
    const patron = /ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(\w+)/g;
    for (const [, tabla, columna] of texto.matchAll(patron)) {
      if (!tablas[tabla]) throw new Error(`ADD COLUMN sobre la tabla desconocida "${tabla}"`);
      if (!tablas[tabla].includes(columna)) tablas[tabla].push(columna);
    }
  }
  return tablas;
}

const tablasSql = columnasFinales(migraciones);
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
