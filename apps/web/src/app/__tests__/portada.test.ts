/**
 * @file app/__tests__/portada.test.ts
 * @description Portada pública (SPEC web de la Red, R1.1–R1.3).
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Portada from '../page';
import { metadata } from '../layout';

describe('Portada', () => {
  const html = renderToStaticMarkup(createElement(Portada));

  it('ya no dice «Próximamente» como contenido principal (R1.1)', () => {
    expect(html).toContain('La ruta hacia una mejor etapa laboral');
    expect(html).not.toContain('<h1>Asistente de Empleabilidad</h1>');
  });

  it('tiene el botón «Entrar» al login (R1.2)', () => {
    expect(html).toMatch(/<a[^>]*href="\/auth\/login"[^>]*>Entrar<\/a>/);
  });

  it('muestra el método y quiénes están detrás (P3: textos de la página provisoria)', () => {
    expect(html).toContain('Método Mapa de Empleabilidad');
    expect(html).toContain('Quiénes están detrás');
  });

  it('lo que todavía no existe queda como «Próximamente» (P3)', () => {
    expect(html).toContain('Mapa de Empleabilidad digital');
    expect(html).toContain('Próximamente');
  });

  it('no promete enlaces a la app vieja ni testimonios inventados', () => {
    expect(html).not.toContain('app.rutadecarrera.com');
  });
});

describe('metadatos del sitio', () => {
  it('el título es «Ruta de Carrera» (R1.3)', () => {
    expect(metadata.title).toBe('Ruta de Carrera');
  });
});
