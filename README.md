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
| **Frontend** | Next.js 14+, React, TypeScript |
| **Backend/API** | Next.js API Routes |
| **IA** | Google Gemini API |
| **Base de Datos** | (Por definir - Firestore/PostgreSQL) |
| **Autenticación** | (Por definir - Auth0/Firebase) |
| **Monorepo** | pnpm workspaces |
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
│   └── shared/
│       ├── db/                     # Esquemas y queries de DB
│       │   ├── schema.ts
│       │   ├── client.ts
│       │   └── migrations/
│       │
│       ├── types/                  # Tipos compartidos de TypeScript
│       │   ├── user.ts
│       │   ├── assessment.ts
│       │   ├── career.ts
│       │   └── index.ts
│       │
│       └── utils/                  # Utilidades comunes
│           ├── validation.ts
│           ├── formatting.ts
│           └── index.ts
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

### Requisitos
- Node.js 18+
- pnpm 8+ (recomendado) o npm 8+
- Git

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/esalinascl/rutadecarrera-platform.git
cd rutadecarrera-platform

# Instalar dependencias
pnpm install

# O si uses npm
npm install
```

### Desarrollo

```bash
# Iniciar todos los proyectos en modo desarrollo
pnpm run dev

# O ejecutar un workspace específico
pnpm run dev --filter=@rcp/asistente

# Ejecutar tests
pnpm run test

# Linting
pnpm run lint
```

### Variables de Entorno

Crear archivos `.env.local` en cada app:

```bash
# apps/asistente/.env.local
NEXT_PUBLIC_GEMINI_API_KEY=<tu-api-key>
DATABASE_URL=<url-base-datos>
```

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
