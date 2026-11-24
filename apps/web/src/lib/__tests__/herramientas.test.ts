import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HERRAMIENTAS, URL_TEST_DISC } from '../herramientas';

describe('HERRAMIENTAS', () => {
  it('el Test DISC es la primera herramienta (R4.1)', () => {
    expect(HERRAMIENTAS[0]?.nombre).toBe('Test DISC');
  });

  it('el DISC lleva a su página del área de miembros, interna y solo para miembros (R4.2)', () => {
    const disc = HERRAMIENTAS.find((h) => h.nombre === 'Test DISC');
    expect(disc?.href).toBe('/red/herramientas/disc');
    expect(disc?.externa).toBe(false);
    expect(disc?.soloMiembros).toBe(true);
  });

  it('la Rueda de la Vida sigue pública en /ruedadelavida (R4.4)', () => {
    const rueda = HERRAMIENTAS.find((h) => h.nombre === 'Rueda de la Vida');
    expect(rueda?.href).toBe('/ruedadelavida');
    expect(rueda?.externa).toBe(false);
    expect(rueda?.soloMiembros).toBe(false);
  });

  it('las herramientas solo para miembros viven bajo /red', () => {
    for (const h of HERRAMIENTAS.filter((x) => x.soloMiembros)) {
      expect(h.href.startsWith('/red/')).toBe(true);
    }
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

  it('la dirección pública del test DISC es https y del subdominio disc', () => {
    expect(URL_TEST_DISC).toBe('https://disc.rutadecarrera.com');
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

describe('módulo de cálculo de la Rueda de la Vida', () => {
  const html = readFileSync(resolve(__dirname, '../../../public/ruedadelavida/index.html'), 'utf8');

  it('la página lo carga con ruta absoluta (se sirve sin barra final en /ruedadelavida)', () => {
    expect(html).toContain("from '/ruedadelavida/calculos.js'");
    expect(html).not.toContain("from './calculos.js'");
  });

  it('los controles tienen etiqueta asociada (RNF-03)', () => {
    expect(html).toContain('<label class="zone-label" for="rng-${i}"');
    expect(html).toContain('id="rng-${i}"');
  });
});
