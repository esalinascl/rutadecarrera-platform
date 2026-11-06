/**
 * @file lib/supabase/__tests__/cookies.test.ts
 * @description Tests de las opciones de cookie de sesión (TASK 9).
 * @supabase/ssr usa por defecto httpOnly:false y sin Secure: aquí se exige lo contrario.
 */

import { describe, it, expect } from 'vitest';
import { opcionesCookie } from '../cookies';

describe('opcionesCookie', () => {
  it('siempre httpOnly y SameSite=Lax', () => {
    for (const entorno of ['development', 'test', 'production']) {
      expect(opcionesCookie(entorno)).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    }
  });

  it('Secure solo en producción (en localhost http no habría sesión)', () => {
    expect(opcionesCookie('production').secure).toBe(true);
    expect(opcionesCookie('development').secure).toBe(false);
  });
});
