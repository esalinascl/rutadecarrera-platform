/**
 * @file __tests__/seguridad-service-role.test.ts
 * @description TASK 9: la clave `service_role` jamás debe poder llegar al
 * navegador. Dos barreras:
 *   1. Código fuente: ningún componente de cliente la nombra ni importa el
 *      cliente de base de datos de servidor (`@rcp/shared/db`).
 *   2. Bundle compilado: si existe `.next/static` (tras `pnpm build`), no
 *      contiene el nombre de la variable ni la palabra `service_role`.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ_WEB = resolve(__dirname, '../..');

function listarArchivos(dir: string, filtro: (ruta: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const resultado: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === 'node_modules' || nombre === '__tests__') continue;
      resultado.push(...listarArchivos(ruta, filtro));
    } else if (filtro(ruta)) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

describe('service_role fuera del navegador', () => {
  const fuentes = listarArchivos(join(RAIZ_WEB, 'src'), (r) => /\.(ts|tsx)$/.test(r));

  it('hay código fuente que revisar', () => {
    expect(fuentes.length).toBeGreaterThan(0);
  });

  it('ningún componente de cliente ("use client") nombra service_role ni importa @rcp/shared/db', () => {
    const infractores = fuentes.filter((ruta) => {
      const texto = readFileSync(ruta, 'utf-8');
      const esCliente = /^\s*['"]use client['"]/m.test(texto);
      return esCliente && /SERVICE_ROLE|service_role|@rcp\/shared\/db/.test(texto);
    });
    expect(infractores).toEqual([]);
  });

  it('ninguna variable NEXT_PUBLIC_ contiene SERVICE_ROLE', () => {
    const infractores = fuentes.filter((ruta) =>
      /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/.test(readFileSync(ruta, 'utf-8')),
    );
    expect(infractores).toEqual([]);
  });

  it('el bundle compilado (.next/static) no contiene la clave ni su nombre', () => {
    const estaticos = join(RAIZ_WEB, '.next', 'static');
    if (!existsSync(estaticos)) return; // Solo aplica después de `pnpm build`.
    const infractores = listarArchivos(estaticos, (r) => /\.(js|map|html)$/.test(r)).filter((ruta) =>
      /SUPABASE_SERVICE_ROLE_KEY|service_role/.test(readFileSync(ruta, 'utf-8')),
    );
    expect(infractores).toEqual([]);
  });
});
