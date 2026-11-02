/**
 * @file __tests__/monitoring-contrato.test.ts
 * @description Contrato del workflow de Monitoring (SPEC — health-db, RF-10).
 *
 * No ejecuta GitHub Actions: lee `.github/workflows/monitoring.yml` y comprueba que la
 * sonda de salud de la base sigue ahí. Si alguien la borra, el proyecto de Supabase vuelve
 * a poder pausarse por inactividad sin que nadie se entere; esta prueba lo impide.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AQUI = dirname(fileURLToPath(import.meta.url));
// apps/web/src/__tests__ → raíz del repo: 4 niveles hacia arriba.
const RUTA_WORKFLOW = resolve(AQUI, '../../../../.github/workflows/monitoring.yml');
const workflow = readFileSync(RUTA_WORKFLOW, 'utf8');

/** Texto del trabajo `salud-base-de-datos`, hasta el siguiente trabajo o el final del archivo. */
function trabajoDeSalud(): string {
  const inicio = workflow.search(/^ {2}salud-base-de-datos:\s*$/m);
  if (inicio === -1) return '';
  const resto = workflow.slice(inicio + 1);
  const siguiente = resto.search(/^ {2}[a-z0-9-]+:\s*$/m);
  return siguiente === -1 ? resto : resto.slice(0, siguiente);
}

describe('monitoring.yml — sonda de salud de la base (RF-10)', () => {
  it('tiene un trabajo llamado salud-base-de-datos', () => {
    expect(trabajoDeSalud()).not.toBe('');
  });

  it('llama a https://app.rutadecarrera.com/api/health', () => {
    expect(trabajoDeSalud()).toContain('https://app.rutadecarrera.com/api/health');
  });

  it('reintenta ante errores 5xx antes de dar la alarma', () => {
    expect(trabajoDeSalud()).toMatch(/--retry\s+[1-9]/);
  });

  it('exige el estado ok en el cuerpo, no solo un código 200', () => {
    expect(trabajoDeSalud()).toContain('"estado":"ok"');
  });

  it('termina en rojo (exit 1) cuando la base no está sana', () => {
    expect(trabajoDeSalud()).toContain('exit 1');
  });

  it('declara un tiempo máximo (timeout-minutes) para no colgarse', () => {
    expect(trabajoDeSalud()).toMatch(/timeout-minutes:\s*\d+/);
  });

  it('el workflow no usa continue-on-error (regla #6 de gobernanza)', () => {
    // Solo cuenta la clave real de YAML, no la mención dentro de un comentario.
    expect(workflow).not.toMatch(/^\s*continue-on-error\s*:/m);
  });

  it('las sondas que ya existían siguen en el archivo', () => {
    expect(workflow).toContain('responde-2xx');
    expect(workflow).toContain('contenido-disc-correcto');
    expect(workflow).toContain('api-chat-activo');
  });
});
