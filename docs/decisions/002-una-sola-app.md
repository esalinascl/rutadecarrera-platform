# ADR 002: Una sola app (`apps/web`)

## Estado

Aceptado — 2026-09-27, decisión de Eduardo (D8 del PLAN). Reemplaza "un
proyecto Vercel por app" (D4) y el mapeo de un subdominio por app (D7).

## Contexto

El monorepo nació con 3 apps (`landing`, `asistente`, `test-disc`), cada una
con su subdominio y su proyecto Vercel. Al 2026-09-27 solo `apps/asistente`
tenía código; `landing` y `test-disc` solo tenían `package.json`.

La plataforma necesita registro y login de clientes y consultores, un
dashboard distinto por rol, y se van a sumar más aplicaciones.

## Decisión

- Una sola app Next.js: `apps/web` (paquete `@rcp/web`), creada renombrando
  `apps/asistente` con `git mv` (conserva el historial).
- Zona pública: `/`, `/auth/*`, `/t/[token]` (responder tests por link).
  Zona privada: `/dashboard/*`, según rol.
- Un solo proyecto Vercel (`rutadecarrera`) con Root Directory `apps/web`.
- `packages/shared` (`@rcp/shared`) se mantiene sin cambios.

## Alternativa descartada

Mantener 3 apps en subdominios con la sesión compartida por una cookie en
`.rutadecarrera.com`. Es viable, pero cada app nueva exige su propio proyecto
Vercel, registro DNS y configuración de variables.

## Consecuencias

- **A favor:** un login, un deploy, una configuración de variables; una app
  nueva es una ruta nueva.
- **En contra:** si una sección crece mucho, habrá que extraerla a su propia app.
- **Migración por etapas** (nada que funcione se apaga antes de tener reemplazo):
  - **M1:** este cambio de código.
  - **M2:** Root Directory del proyecto Vercel → `apps/web`, coordinado con el
    merge de M1 (si no, el build falla).
  - **M3:** `www` y el apex pasan del proyecto `rutadecarrera-1` a `rutadecarrera`
    cuando exista la landing.
  - **M4:** `app.rutadecarrera.com` → redirección 301 a `www`.
  - **M5:** `disc.rutadecarrera.com` → redirección 301 **solo** cuando el Test
    DISC exista dentro de `apps/web`. Hoy es un sitio independiente en uso.
