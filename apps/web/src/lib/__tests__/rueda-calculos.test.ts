import { describe, expect, it } from 'vitest';
import {
  PUNTAJE_INICIAL,
  PUNTAJE_MAX,
  PUNTAJE_MIN,
  calcularResumen,
  etiquetaCorta,
  nombreArchivo,
  normalizarPuntaje,
} from '../../../public/ruedadelavida/calculos.js';

const NOMBRES = ['Profesional', 'Red de Apoyo', 'Finanzas'];

describe('constantes (RF-02, RF-03)', () => {
  it('el puntaje inicial es 5 y el rango es 1 a 10', () => {
    expect(PUNTAJE_INICIAL).toBe(5);
    expect(PUNTAJE_MIN).toBe(1);
    expect(PUNTAJE_MAX).toBe(10);
  });
});

describe('normalizarPuntaje (RF-03)', () => {
  it('deja pasar enteros válidos', () => {
    expect(normalizarPuntaje(7)).toBe(7);
    expect(normalizarPuntaje('3')).toBe(3);
  });
  it('acota al rango 1-10', () => {
    expect(normalizarPuntaje(0)).toBe(1);
    expect(normalizarPuntaje(-4)).toBe(1);
    expect(normalizarPuntaje(11)).toBe(10);
    expect(normalizarPuntaje(999)).toBe(10);
  });
  it('redondea decimales a entero', () => {
    expect(normalizarPuntaje(6.6)).toBe(7);
    expect(normalizarPuntaje('4.2')).toBe(4);
  });
  it('usa el puntaje inicial si el valor no es un número', () => {
    expect(normalizarPuntaje('abc')).toBe(PUNTAJE_INICIAL);
    expect(normalizarPuntaje(undefined)).toBe(PUNTAJE_INICIAL);
    expect(normalizarPuntaje(NaN)).toBe(PUNTAJE_INICIAL);
  });
});

describe('calcularResumen (RF-04, RF-05)', () => {
  it('calcula el promedio con 1 decimal', () => {
    expect(calcularResumen([5, 5, 5], NOMBRES).promedio).toBe('5.0');
    expect(calcularResumen([10, 9, 8], NOMBRES).promedio).toBe('9.0');
    expect(calcularResumen([1, 2, 2], NOMBRES).promedio).toBe('1.7');
  });
  it('encuentra la zona más alta y la más baja', () => {
    const r = calcularResumen([4, 9, 2], NOMBRES);
    expect(r.indiceMasAlta).toBe(1);
    expect(r.indiceMasBaja).toBe(2);
    expect(r.nombreMasAlta).toBe('Red de Apoyo');
    expect(r.nombreMasBaja).toBe('Finanzas');
  });
  it('en empate elige la primera de la lista', () => {
    const r = calcularResumen([5, 5, 5], NOMBRES);
    expect(r.indiceMasAlta).toBe(0);
    expect(r.indiceMasBaja).toBe(0);
  });
  it('con una lista vacía no falla y devuelve valores vacíos', () => {
    const r = calcularResumen([], []);
    expect(r.promedio).toBe('—');
    expect(r.indiceMasAlta).toBe(-1);
    expect(r.indiceMasBaja).toBe(-1);
    expect(r.nombreMasAlta).toBe('—');
    expect(r.nombreMasBaja).toBe('—');
  });
});

describe('etiquetaCorta', () => {
  it('toma la primera palabra del nombre', () => {
    expect(etiquetaCorta('Red de Apoyo')).toBe('Red');
    expect(etiquetaCorta('Emocional – Pasión')).toBe('Emocional');
    expect(etiquetaCorta('Finanzas')).toBe('Finanzas');
  });
});

describe('nombreArchivo (RF-06)', () => {
  it('arma AAAAMMDD Rueda de la vida.ext con ceros a la izquierda', () => {
    expect(nombreArchivo(new Date(2026, 0, 5), 'png')).toBe('20260105 Rueda de la vida.png');
    expect(nombreArchivo(new Date(2026, 9, 20), 'pdf')).toBe('20261020 Rueda de la vida.pdf');
  });
});
