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

  it('cuelga la Rueda de la Vida y DISC de Herramientas', () => {
    const desplegable = html.slice(html.indexOf('<details'));
    expect(desplegable).toContain('href="/ruedadelavida"');
    expect(desplegable).toContain('href="https://disc.rutadecarrera.com"');
  });

  it('tiene nombre accesible', () => {
    expect(html).toContain('aria-label="Menú principal"');
  });
});
