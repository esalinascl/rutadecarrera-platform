# 📦 Setup Guide - Ruta de Carrera Platform

Guía completa para configurar el ambiente de desarrollo.

## 📋 Requisitos Previos

- **Node.js**: v18.0.0 o superior
  ```bash
  node --version  # Verificar versión instalada
  ```

- **pnpm**: v8.0.0 o superior (recomendado) o npm v8+
  ```bash
  # Instalar pnpm globalmente (si no lo tienes)
  npm install -g pnpm
  
  # Verificar versión
  pnpm --version
  ```

- **Git**: v2.30 o superior
  ```bash
  git --version
  ```

- **Cuenta GitHub**: Para trabajar con el repositorio

## 🔧 Instalación Paso a Paso

### 1. Clonar el Repositorio

```bash
# Usar SSH (recomendado si tienes clave SSH configurada)
git clone git@github.com:esalinascl/rutadecarrera-platform.git

# O usar HTTPS
git clone https://github.com/esalinascl/rutadecarrera-platform.git

# Entrar al directorio
cd rutadecarrera-platform
```

### 2. Instalar Dependencias

```bash
# Con pnpm (recomendado)
pnpm install

# Con npm
npm install

# Con yarn (si lo prefieres)
yarn install
```

**Nota**: pnpm es más eficiente con monorepos. Te recomendamos usarlo.

### 3. Verificar Instalación

```bash
# Ver estructura de workspaces instalados
pnpm ls --depth=0

# Debería mostrar algo como:
# .
# ├── apps/landing
# ├── apps/asistente
# ├── apps/test-disc
# └── packages/shared
```

## 🚀 Primeros Pasos

### Iniciar Desarrollo

```bash
# Iniciar todos los servidores (landing + asistente + test-disc)
pnpm run dev

# El output mostrará URLs de acceso:
# ▲ Next.js 14.0.0
# - Local: http://localhost:3000
# - Local: http://localhost:3001
# - Local: http://localhost:3002
```

### Correr Tests

```bash
# Ejecutar todos los tests
pnpm run test

# Con watch mode (re-ejecuta al cambiar archivos)
pnpm run test:watch

# Con coverage
pnpm run test:coverage
```

### Linting y Formateo

```bash
# Ejecutar linter
pnpm run lint

# Formatear código (Prettier)
pnpm run format

# Verificar formato sin modificar
pnpm run format:check
```

### Trabajar en un Workspace Específico

```bash
# Dev solo del asistente
pnpm run dev --filter=@rcp/asistente

# Tests solo de shared
pnpm run test --filter=@rcp/shared

# Build de landing
pnpm run build --filter=@rcp/landing
```

## 🔐 Variables de Entorno

Cada aplicación necesita su archivo `.env.local` en su carpeta raíz.

### apps/asistente/.env.local

```env
# Google Gemini API
NEXT_PUBLIC_GEMINI_API_KEY=<tu-api-key-de-gemini>

# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/rutadecarrera

# Autenticación (si usas Auth0 o similar)
AUTH0_SECRET=<tu-secret>
AUTH0_BASE_URL=http://localhost:3001
AUTH0_CLIENT_ID=<tu-client-id>
AUTH0_CLIENT_SECRET=<tu-client-secret>

# Entorno
NEXT_PUBLIC_ENV=development
```

### apps/landing/.env.local

```env
NEXT_PUBLIC_ENV=development
```

### apps/test-disc/.env.local

```env
DATABASE_URL=postgresql://user:password@localhost:5432/rutadecarrera
NEXT_PUBLIC_ENV=development
```

**⚠️ IMPORTANTE**: 
- Nunca commitear `.env.local` (ya está en `.gitignore`)
- No hardcodear secretos en el código
- Usar variables de entorno para toda configuración sensible

## 🛠️ Troubleshooting

### ❌ Error: `pnpm: command not found`

```bash
# Solución: Instalar pnpm globalmente
npm install -g pnpm

# Verificar
pnpm --version
```

### ❌ Error: `node_modules` corrupto

```bash
# Solución: Limpiar y reinstalar
pnpm clean
pnpm install
```

### ❌ Error: `Port 3000 already in use`

```bash
# Encontrar y matar el proceso usando el puerto
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Matar proceso (ejemplo para Mac/Linux)
kill -9 <PID>

# O cambiar puerto en dev
pnpm run dev -- -p 3003
```

### ❌ Error: Problemas con TypeScript types

```bash
# Regenerar tipos y limpiar cache
pnpm run typecheck
pnpm clean
pnpm install
```

### ❌ Error: `NEXT_PUBLIC_GEMINI_API_KEY is missing`

```bash
# Verificar que el archivo .env.local existe
ls apps/asistente/.env.local

# Si no existe, crearlo con las variables requeridas
# Ver sección "Variables de Entorno" arriba
```

### ❌ Git errors (conflicts, merge issues)

```bash
# Ver estado actual
git status

# Si hay cambios no confirmados, guardarlos
git stash

# Actualizar desde main
git pull origin main

# Recuperar cambios guardados
git stash pop
```

## 📚 Recursos Útiles

- **Next.js Docs**: https://nextjs.org/docs
- **TypeScript Docs**: https://www.typescriptlang.org/docs/
- **pnpm Docs**: https://pnpm.io/
- **Gemini API Docs**: https://ai.google.dev/tutorials/python_quickstart
- **GitHub Guide**: https://guides.github.com/

## 🔄 Workflow Típico del Desarrollador

```bash
# 1. Crear rama feature
git checkout -b feat/nueva-funcionalidad

# 2. Instalar dependencias (si es primera vez)
pnpm install

# 3. Iniciar desarrollo
pnpm run dev

# 4. Hacer cambios, guardar, testear
pnpm run test
pnpm run lint

# 5. Commit y push
git add .
git commit -m "feat: agregar nueva funcionalidad"
git push -u origin feat/nueva-funcionalidad

# 6. Crear Pull Request en GitHub
# (La URL aparecerá en el output del push)
```

## 📝 Notas Importantes

- **No pushear a `main` directamente** - Siempre usar Pull Requests
- **Esperar aprobación** antes de mergear a main
- **Correr tests y linter** antes de hacer commit
- **Documentar cambios** en commit messages

## ✅ Verificación Final

Si todo está configurado correctamente, deberías poder:

```bash
# ✅ Ver este output sin errores
pnpm run dev

# ✅ Acceder a http://localhost:3000
# ✅ Ver logs sin excepciones
# ✅ Poder cambiar archivos y ver hot reload
```

---

**¿Necesitas ayuda?** Contacta a [eduardo.salinasb@gmail.com](mailto:eduardo.salinasb@gmail.com)

**Última actualización**: 2026-09-24
