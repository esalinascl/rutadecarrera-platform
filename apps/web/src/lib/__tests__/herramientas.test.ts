import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HERRAMIENTAS } from '../herramientas';

describe('HERRAMIENTAS', () => {
  it('incluye la Rueda de la Vida en /ruedadelavida', () => {
    const rueda = HERRAMIENTAS.find((h) => h.nombre === 'Rueda de la Vida');
    expect(rueda).toBeDefined();
    expect(rueda?.href).toBe('/ruedadelavida');
    expect(rueda?.externa).toBe(false);
  });

  it('incluye DISC como enlace externo a su subdominio', () => {
    const disc = HERRAMIENTAS.find((h) => h.nombre === 'Test DISC');
    expect(disc?.href).toBe('https://disc.rutadecarrera.com');
    expect(disc?.externa).toBe(true);
  });

  it('no repite rutas', () => {
    const hrefs = HERRAMIENTAS.map((h) => h.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('las externas son https y las internas empiezan con /', () => {
    for (const h of HERRAMIENTAS) {
      expect(h.externa ? h.href.startsWith('https://') : h.href.startsWith('/')).toBe(true);
    }
  });
});

describe('página estática de la Rueda de la Vida', () => {
  const ruta = resolve(__dirname, '../../../public/ruedadelavida/index.html');
  const html = readFileSync(ruta, 'utf8');

  it('existe y es la Rueda de la Vida', () => {
    expect(html).toContain('<title>Rueda de la Vida</title>');
  });

  it('no contiene secretos ni llamadas a servicios externos', () => {
    expect(html).not.toMatch(/api[_-]?key|secret|token/i);
    expect(html).not.toMatch(/fetch\(|XMLHttpRequest/);
  });
});
