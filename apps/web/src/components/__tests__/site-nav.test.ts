import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SiteNav } from '../site-nav';

describe('SiteNav', () => {
  const html = renderToStaticMarkup(createElement(SiteNav));

  it('tiene el desplegable «Herramientas»', () => {
    expect(html).toContain('<summary');
    expect(html).toContain('Herramientas');
  });

  it('cuelga el DISC (primero) y la Rueda de la Vida de Herramientas', () => {
    const desplegable = html.slice(html.indexOf('<details'));
    const disc = desplegable.indexOf('href="/red/herramientas/disc"');
    const rueda = desplegable.indexOf('href="/ruedadelavida"');
    expect(disc).toBeGreaterThan(-1);
    expect(rueda).toBeGreaterThan(disc);
  });

  it('marca las herramientas que son solo para miembros', () => {
    expect(html).toContain('Solo miembros');
  });

  it('tiene acceso al área de miembros', () => {
    expect(html).toContain('href="/red"');
  });

  it('tiene nombre accesible', () => {
    expect(html).toContain('aria-label="Menú principal"');
  });
});
