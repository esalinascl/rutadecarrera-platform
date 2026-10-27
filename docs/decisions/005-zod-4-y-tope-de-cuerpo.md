# ADR 005 — Zod 4 y tope de tamaño del cuerpo en `/api/chat`

- **Estado:** propuesta (2026-10-27); pasa a «aceptada» al fusionar el PR
- **Decisión origen:** Eduardo aprobó empezar este PR el 2026-10-27 (nota «CI rojo en main — advisory braces sin parche» del vault)
- **Aviso que lo motiva:** [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) (Zod, severidad alta, CVSS 7.5)

## Contexto

El 2026-10-23 el aviso GHSA-mrhx-c7xc-m3w5 se amplió a todas las versiones de Zod `< 4.6.6`. El parche existe **solo en la rama 4**. Desde entonces `pnpm audit --audit-level=high` falla en el CI de `main` con `zod@3.25.76`. El aviso de `braces`, que antes explicaba el CI rojo, se retiró ese mismo día: el que queda es el de Zod.

No es solo ruido del CI. `/api/chat` valida con Zod un cuerpo que puede mandar cualquiera (todavía no hay login). Zod < 4.6.6 acumula un error por **cada** elemento inválido de un arreglo. Medido en local con un cuerpo de 4,2 MB (el máximo que admite Vercel) y 2,2 millones de elementos inválidos en `historial`:

| | Memoria máxima del proceso | Respuesta | Tiempo |
|---|---|---|---|
| Ruta de `main` (Zod 3, sin tope) | 1,8 GB (en otra corrida, con el heap limitado a 1 GB, el proceso se cayó) | 400 con 212 MB de errores | 5 s |
| Esta rama (Zod 4 + tope) | +3,5 MB sobre el arranque | 413, 57 bytes | 23 ms |

Solo Zod 4, sin tope, con el mismo cuerpo: 1 error en 18 ms y ~29 MB de heap.

## Decisión

1. **Zod 3.25.76 → 4.6.7** en `packages/shared`, con una sola versión en el lockfile. No existe parche para la rama 3.
2. **Tope de 512 KB al cuerpo** de `/api/chat` (`apps/web/src/lib/http/cuerpo-acotado.ts`), con 413 si se pasa. Es una segunda defensa que no depende de la versión de Zod: un cuerpo enorme cuesta memoria y CPU aunque el validador sea bueno.
   - Si el encabezado `Content-Length` ya declara más que el tope, se responde 413 sin leer nada.
   - El encabezado puede faltar (cuerpo por trozos) o mentir, así que además se cuentan los **bytes reales** mientras se lee, y la lectura se cancela al pasar el tope.
   - Se cuentan bytes, no caracteres: una `ñ` ocupa 2.
   - 512 KB deja ~25 % de margen sobre el máximo legítimo (40 turnos × 5000 caracteres: 402 KB medidos con `ñ`).
3. **Dependabot sigue ignorando el próximo cambio mayor** de Zod (5): se migra como tarea. Los menores y parches de la 4 llegan solos.

## Consecuencias

- (+) El CI de `main` vuelve a pasar **sin excepciones**: sin `ignoreGhsas` y sin usar la excepción de CI.
- (+) Probado con TDD: la prueba de 200 000 elementos inválidos falla con Zod 3 (200 001 errores) y pasa con Zod 4. Las pruebas del lector del cuerpo se verificaron además rompiendo el código a propósito (9 de 9 mutaciones detectadas).
- (−) **Cambia lo que ve quien llama en `detalles` (400):** dos códigos de `tipo` (`invalid_string` → `invalid_format`, `invalid_enum_value` → `invalid_value`) y los textos por defecto en inglés (por ejemplo, «Required» → «Invalid input: expected string, received undefined»). Los mensajes en español que definimos no cambian. Ningún código del repo lee `tipo` ni esos textos; solo `route.ts` los emite. Queda fijado con pruebas de caracterización.
- (−) Un cuerpo legítimo de más de 512 KB ahora recibe 413. Si algún día suben el máximo de historial o de caracteres, hay que subir también `MAX_CUERPO_BYTES`: la prueba del límite exacto lo avisa.
- (−) El PR #41 (login con Magic Link) también edita `route.ts`: al actualizarlo habrá que resolver ese cruce.
- (−) En `packages/shared` cambió la forma de tipar esquemas (`ZodType<T, unknown>`; `ZodTypeDef` ya no existe) y las rutas de error pueden traer símbolos, por eso `validation.ts` las convierte a texto.

## Alternativas descartadas

- **Silenciar el aviso o repetir la excepción de CI:** deja el CI verde, pero la ruta pública sigue siendo atacable.
- **Solo el tope, sin actualizar Zod:** protege `/api/chat`, pero el CI sigue rojo y cualquier ruta futura que valide con Zod 3 queda expuesta.
- **Solo actualizar Zod, sin tope:** arregla el aviso, pero un cuerpo de 4 MB igual se lee y se procesa sin necesidad.
- **Esperar un parche para la rama 3:** el aviso cubre toda la rama y no hay fecha.
- **Tope solo por `Content-Length`:** el encabezado puede faltar o mentir; por eso se cuentan los bytes reales.
