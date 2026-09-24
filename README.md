# Ruta de Carrera Platform

Plataforma integral de empleabilidad y carrera profesional. Un asistente inteligente basado en Gemini que guía a usuarios en su trayectoria profesional con diagnósticos, recomendaciones personalizadas y seguimiento continuo.

## 🎯 Descripción

**Ruta de Carrera Platform** es una solución monorepo que integra:
- **Asistente de Empleabilidad**: Motor inteligente con Gemini API para evaluación de competencias y guía de carrera
- **Landing Page**: Presentación y onboarding del producto
- **Test de Competencias**: Diagnóstico de habilidades blandas y técnicas
- **Shared Packages**: Lógica de base de datos, tipos TypeScript y utilidades comunes

## 📦 Stack Técnico

| Componente | Tecnología |
|-----------|-----------|
| **Frontend** | Next.js 16, React 18, TypeScript |
| **Backend/API** | Next.js API Routes |
| **IA** | Google Gemini API |
| **Base de Datos** | PostgreSQL (Supabase), Row Level Security activado |
| **Autenticación** | Supabase Auth (TASK 9) |
| **Monorepo** | pnpm 12 workspaces + catálogo de versiones |
| **Tests** | Vitest 5 (cobertura mínima 80%) |
| **CI/CD** | GitHub Actions |
| **Hosting** | Vercel |

## 📁 Estructura del Proyecto

```
rutadecarrera-platform/
│
├── apps/                           # Aplicaciones principales
│   ├── landing/                    # Landing page (marketing)
│   │   ├── pages/
│   │   ├── components/
│   │   └── public/
│   │
│   ├── asistente/                  # Asistente inteligente (Gemini)
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/
│   │   │   ├── chat/               # Endpoint chat con Gemini
│   │   │   ├── assess/             # Endpoint de evaluación
│   │   │   └── recommendations/    # Endpoint de recomendaciones
│   │   └── lib/
│   │
│   └── test-disc/                  # Test de competencias
│       ├── pages/
│       ├── components/
│       ├── api/
│       └── lib/
│
├── packages/                       # Paquetes compartidos
│   └── shared/                     # UN solo paquete: @rcp/shared
│       └── src/
│           ├── db/                 # SOLO SERVIDOR (@rcp/shared/db)
│           │   ├── migrations/     # 001_init_schema.sql = fuente de verdad del esquema
│           │   ├── schema.ts       # Columnas por tabla + contratos de repositorios
│           │   └── client.ts       # Cliente Supabase (service role) + repositorios
│           ├── types/index.ts      # Entidades (reflejan las tablas) y contratos de API
│           ├── utils/
│           │   ├── validation.ts   # Esquemas Zod atados a los tipos (satisfies)
│           │   ├── gemini.ts       # Cliente Gemini (timeout, API key en header)
│           │   └── index.ts        # Utilidades generales
│           └── __tests__/          # Tests Vitest
│
├── docs/                           # Documentación
│   ├── setup.md                    # Instrucciones de instalación
│   ├── architecture.md             # Arquitectura del proyecto
│   ├── api.md                      # Especificación de APIs
│   └── gemini-integration.md       # Guía de integración Gemini
│
├── .github/
│   └── workflows/                  # CI/CD automation
│       ├── test.yml                # Tests automáticos
│       ├── lint.yml                # Linting
│       └── deploy.yml              # Deploy a Vercel
│
├── .gitignore
├── .gitattributes
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml             # pnpm workspaces config
├── tsconfig.json                   # TypeScript base config
└── README.md                       # Este archivo
```

## 🚀 Inicio Rápido

Requisitos: **Node 24** (`.nvmrc`) y **pnpm 12.6** (fijado en `packageManager`). Solo pnpm, nunca npm ni yarn.

```bash
git clone git@github.com:esalinascl/rutadecarrera-platform.git
cd rutadecarrera-platform
# Node 24 y pnpm 12.6.0 instalados (ver docs/setup.md)
pnpm install --frozen-lockfile
cp .env.example .env.local   # completar con claves de STAGING

pnpm test        # tests (Vitest)
pnpm typecheck   # TypeScript
```

Guía completa (incluye trabajo con dos computadores): [docs/setup.md](docs/setup.md).

### ⚠️ Variables de entorno: regla de seguridad

- Las claves secretas (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) **nunca** llevan prefijo `NEXT_PUBLIC_`: ese prefijo las publica en el navegador de cualquier visitante.
- `.env.local` nunca se commitea. El único archivo de ejemplo es `.env.example` en la raíz.

## 🛡️ Gobernanza

Este repo sigue reglas obligatorias para trabajo con varios agentes y computadores:

- Toda rama nace de `origin/main` actualizado: `git fetch && git switch -c feat/x origin/main`.
- `main` protegido: solo se modifica por Pull Request con CI en verde.
- CI que bloquea de verdad: tests, typecheck y cobertura mínima de 80%.
- Nunca dos computadores trabajando en la misma rama.

## 📚 Documentación

Ver [docs/setup.md](docs/setup.md) para instrucciones de instalación detalladas.

## 🔧 Configuración

### pnpm Workspaces
El proyecto usa `pnpm-workspace.yaml` para gestionar múltiples workspaces. Cada app y package es un workspace independiente.

### TypeScript
Configuración centralizada en `tsconfig.json` con overrides por workspace.

### GitHub Actions
Ver `.github/workflows/` para configuración de CI/CD.

## 📋 Fases del Proyecto

- **Fase 1**: Setup Monorepo (EN PROGRESO)
  - [x] Estructura inicial
  - [ ] Workflows CI/CD
  - [ ] Configuración de DB
  
- **Fase 2**: Integración Gemini API
- **Fase 3**: Desarrollo Asistente
- **Fase 4**: Landing Page
- **Fase 5**: Test de Competencias
- **Fase 6**: Deploy y Validación

## 👤 Owner

**Eduardo Salinas Belletti**  
Email: eduardo.salinasb@gmail.com  
Rol: Founder + Developer

## 📝 Licencia

Por definir

---

**Última actualización:** 2026-09-24  
**Rama principal:** `main`  
**Repo:** [github.com/esalinascl/rutadecarrera-platform](https://github.com/esalinascl/rutadecarrera-platform)
