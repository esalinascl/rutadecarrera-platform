# Setup local

Guía para dejar el proyecto funcionando en **cualquier computador** con las mismas
versiones exactas que el CI. Si trabajas en dos máquinas, sigue esta guía en ambas.

> Reglas del proyecto: sección **Gobernanza** del [README](../README.md)
> (fuente de verdad = GitHub, ramas desde `origin/main`, nunca dos máquinas en la misma rama).

---

## 1. Requisitos

| Herramienta | Versión | Cómo se fija |
|---|---|---|
| Node.js | **24** (mínimo 22.12) | `.nvmrc` |
| pnpm | **12.6.0** | campo `packageManager` en `package.json` |
| Git | cualquiera reciente | — |

Solo **pnpm**. No uses `npm install` ni `yarn`: generarían otro lockfile y versiones distintas.

Node 24, con **una** de estas opciones:

```bash
# Opción A: nvm (lee el .nvmrc)
nvm install && nvm use

# Opción B: Homebrew (macOS), si no usas nvm
brew install node@24 && brew link --overwrite node@24

# Verificar
node -v   # debe decir v24.x (o al menos v22.12)
```

pnpm en la versión exacta del proyecto (no dependas de `corepack`: las versiones recientes de Node ya no lo incluyen):

```bash
npm install -g pnpm@12.6.0   # o: brew install pnpm
pnpm -v                      # debe decir 12.6.0
```

## 2. Clonar e instalar

```bash
git clone git@github.com:esalinascl/rutadecarrera-platform.git
cd rutadecarrera-platform
pnpm install --frozen-lockfile
```

`--frozen-lockfile` instala exactamente lo que dice `pnpm-lock.yaml`. Si falla, alguien
cambió un `package.json` sin commitear el lockfile: no lo "arregles" con `pnpm install`
suelto; avisa en el PR.

**Nunca copies la carpeta del proyecto entre computadores** (ni vía iCloud/Drive).
Siempre `git clone`.

## 3. Variables de entorno

```bash
cp .env.example .env.local
```

Completa `.env.local` con las claves del entorno **staging** (nunca las de producción
en tu máquina). `.env.local` está en `.gitignore`: jamás se commitea.

## 4. Verificar que todo funciona

```bash
pnpm test        # tests de todos los paquetes (Vitest)
pnpm typecheck   # TypeScript sin errores
pnpm -F @rcp/shared test:coverage   # cobertura (mínimo 80%, falla si baja)
pnpm audit       # vulnerabilidades de dependencias
```

Los cuatro deben terminar sin errores. Es lo mismo que verificará el CI en cada PR.

## 5. Empezar una tarea

```bash
git fetch origin
git switch -c feat/descripcion-corta origin/main   # SIEMPRE desde origin/main
```

## Estado actual del monorepo

| Paquete | Estado |
|---|---|
| `packages/shared` (`@rcp/shared`) | ✅ Tipos, validación (Zod), cliente de base de datos, utilidades Gemini. Con tests. |
| `apps/landing`, `apps/asistente`, `apps/test-disc` | ⏳ Solo `package.json`. Cada app Next.js se crea en su TASK (11 en adelante). Por eso aún no existen `pnpm dev`, `pnpm build` ni `pnpm lint`: se agregan cuando haya algo que ejecutar. |

Al crear cada app (TASK 11+), su `next.config` debe incluir `transpilePackages: ['@rcp/shared']`, porque el paquete compartido se consume directo desde su código TypeScript.

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `ERR_PNPM_FROZEN_LOCKFILE` | `package.json` cambió sin lockfile | Quien hizo el cambio debe commitear `pnpm-lock.yaml` |
| `Unsupported engine` | Node menor a 22.12 | Instalar Node 24 (ver sección 1) |
| Vitest pide otra versión de Node | Node desactualizado | Instalar Node 24 (ver sección 1) |
| `Permission denied (publickey)` al hacer `git fetch` | La llave SSH no está cargada | `ssh-add --apple-use-keychain ~/.ssh/id_ed25519` (macOS) |
