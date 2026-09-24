# Setup local

Guía para dejar el proyecto funcionando en **cualquier computador** con las mismas
versiones exactas que el CI. Si trabajas en dos máquinas, sigue esta guía en ambas.

> Reglas del proyecto: [`REGLA — Gobernanza Multi-Agente de Desarrollo`](../README.md#gobernanza)
> (fuente de verdad = GitHub, ramas desde `origin/main`, nunca dos máquinas en la misma rama).

---

## 1. Requisitos

| Herramienta | Versión | Cómo se fija |
|---|---|---|
| Node.js | **24** (mínimo 22.12) | `.nvmrc` |
| pnpm | **12.6.0** | campo `packageManager` en `package.json` |
| Git | cualquiera reciente | — |

Solo **pnpm**. No uses `npm install` ni `yarn`: generarían otro lockfile y versiones distintas.

```bash
# Node con nvm (usa la versión del .nvmrc)
nvm install && nvm use

# pnpm en la versión exacta del proyecto (viene con Node)
corepack enable
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
| `apps/landing`, `apps/asistente`, `apps/test-disc` | ⏳ Solo `package.json`. Cada app Next.js se crea en su TASK (11 en adelante). Por eso aún no tienen `dev`, `build` ni `test`. |

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `ERR_PNPM_FROZEN_LOCKFILE` | `package.json` cambió sin lockfile | Quien hizo el cambio debe commitear `pnpm-lock.yaml` |
| `Unsupported engine` | Node menor a 22.12 | `nvm use` |
| Vitest pide otra versión de Node | Node desactualizado | `nvm install && nvm use` |
| `Permission denied (publickey)` al hacer `git fetch` | La llave SSH no está cargada | `ssh-add --apple-use-keychain ~/.ssh/id_ed25519` (macOS) |
