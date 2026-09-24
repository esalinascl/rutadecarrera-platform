# 🚀 Deployment Guide — Vercel + Github Actions

> **Last Updated:** 2026-09-24  
> **Maintained by:** Claude Code  
> **For:** rutadecarrera-platform

---

## 📋 Table of Contents

1. [Requirements](#requirements)
2. [Vercel Setup](#vercel-setup)
3. [Github Secrets Configuration](#github-secrets-configuration)
4. [Environment Variables](#environment-variables)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Deployment Workflow](#deployment-workflow)
7. [Troubleshooting](#troubleshooting)
8. [Useful Links](#useful-links)

---

## Requirements

- **Node.js:** 18.x or higher (tested with 18.x and 20.x)
- **pnpm:** 8.x or higher
- **Vercel Account:** Create at https://vercel.com
- **Github Account:** with admin access to repository
- **API Keys:**
  - GEMINI_API_KEY (Google Cloud Console)
  - DATABASE_URL (Supabase or PostgreSQL)

### Installation

```bash
# Install pnpm globally
npm install -g pnpm@8

# Clone and install dependencies
git clone https://github.com/esalinascl/rutadecarrera-platform.git
cd rutadecarrera-platform
pnpm install
```

---

## Vercel Setup

### Step 1: Create Vercel Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository:**
   - Select `esalinascl/rutadecarrera-platform`
   - Framework: **Next.js**
   - Root Directory: Choose the appropriate app (e.g., `apps/asistente`)

3. **Project Settings:**
   - Project Name: `rutadecarrera-asistente` (or similar)
   - Team: Personal or organization

### Step 2: Connect Repository

1. Vercel automatically detects Github integration
2. Authorize Vercel to access your Github account
3. Select the repository: `esalinascl/rutadecarrera-platform`
4. Configure deployment settings:
   - **Production Branch:** `main`
   - **Preview Deployments:** Enabled for all PRs
   - **Automatic Deployments:** On push to main

### Step 3: Get Vercel Credentials

Run this command to get your Vercel credentials:

```bash
vercel link
```

This will create `.vercel/project.json` with:
- `projectId`
- `orgId`

Save these values for Github Secrets configuration.

---

## Github Secrets Configuration

Github Actions needs these secrets to deploy automatically.

### Step 1: Access Repository Settings

1. Go to: https://github.com/esalinascl/rutadecarrera-platform/settings
2. Navigate to: **Secrets and variables** → **Actions**

### Step 2: Add Required Secrets

Create the following repository secrets:

| Secret Name | Value | Where to Find |
|---|---|---|
| `VERCEL_TOKEN` | Your Vercel API Token | [Vercel Settings](https://vercel.com/account/tokens) → Create token |
| `VERCEL_ORG_ID` | Your Vercel Organization ID | `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | Vercel Project ID | `.vercel/project.json` → `projectId` |
| `GEMINI_API_KEY` | Google Cloud Gemini API Key | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `DATABASE_URL` | PostgreSQL/Supabase connection string | Supabase Dashboard → Settings → Connection strings |

### Step 3: Verify Secrets

```bash
# List all secrets (Github CLI)
gh secret list
```

---

## Environment Variables

### Local Development (.env.local)

Create `.env.local` in the root directory:

```bash
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-pro

# Database Configuration
DATABASE_URL=postgresql://user:password@host/database

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

**Important:** Never commit `.env.local` — it's in `.gitignore`

### Vercel Environment Variables

1. Go to Vercel Project Settings
2. Navigate to: **Environment Variables**
3. Add the following for **Production**:

```
GEMINI_API_KEY = [from Github Secrets]
DATABASE_URL = [from Supabase]
NEXT_PUBLIC_APP_URL = https://rutadecarrera.com
NODE_ENV = production
```

**For Preview (Pull Requests):**
```
GEMINI_API_KEY = [from Github Secrets]
DATABASE_URL = [from Supabase Staging]
NEXT_PUBLIC_APP_URL = [PR URL]
NODE_ENV = preview
```

---

## CI/CD Pipeline

### Workflow 1: CI (`ci.yml`)

Runs on every **push** and **pull request** to `main` and `develop`:

```mermaid
graph LR
    A["📝 Push/PR"] -->|trigger| B["🔍 Lint Check"]
    B --> C["✔️ Type Check"]
    C --> D["🧪 Run Tests"]
    D --> E["📊 Upload Coverage"]
    E --> F{Tests Pass?}
    F -->|Yes| G["✅ Success"]
    F -->|No| H["❌ Failed"]
```

**What it does:**
- ✅ Installs dependencies with pnpm
- ✅ Runs ESLint on all workspaces
- ✅ Runs TypeScript type checking
- ✅ Executes unit tests with Jest
- ✅ Uploads coverage to Codecov
- ✅ Comments on PR with results

**Duration:** ~2-3 minutes

### Workflow 2: Deploy (`deploy.yml`)

Runs on **push to main** and **pull requests**:

```mermaid
graph LR
    A["🚀 Commit to Main"] -->|trigger| B["📥 Pull Vercel Config"]
    B --> C["🏗️ Build Artifacts"]
    C --> D{Is Main Branch?}
    D -->|Yes| E["🌐 Deploy to Production"]
    D -->|No| F["👀 Deploy Preview"]
    E --> G["✅ Live on vercel.com"]
    F --> H["🔗 Comment PR with URL"]
```

**What it does:**
- ✅ Checks out code and installs dependencies
- ✅ Pulls Vercel project configuration
- ✅ Builds project artifacts
- ✅ For `main`: Deploys to production
- ✅ For PRs: Deploys preview (automatic)
- ✅ Comments on PR with deployment URL

**Duration:** ~3-5 minutes

---

## Deployment Workflow

### 1. Local Development

```bash
# Create feature branch
git checkout -b feat/my-feature

# Make changes and test locally
pnpm dev

# Commit changes
git add .
git commit -m "feat: add new feature"
```

### 2. Push to GitHub

```bash
git push origin feat/my-feature
```

### 3. Create Pull Request

- Go to Github → New Pull Request
- Vercel automatically creates a preview deployment
- CI workflow runs automatically

### 4. Review & Approve

- Check CI status (all checks must pass)
- Review Vercel preview URL
- Approve Pull Request

### 5. Merge to Main

```bash
# After PR approval, merge to main
git checkout main
git pull origin main
git merge feat/my-feature
git push origin main
```

### 6. Production Deployment

- Deploy workflow triggers automatically
- Vercel deploys to production
- Monitor at Vercel dashboard

---

## Continuous Integration Details

### Build Configuration

The CI pipeline builds all workspaces:

```yaml
- apps/asistente
- apps/landing
- apps/test-disc
- packages/shared
```

### Test Coverage

Minimum coverage requirements per module:
- **Critical paths** (auth, API): 80%+
- **UI Components**: 60%+
- **Utils**: 85%+

Run locally:
```bash
pnpm test --coverage --workspaces
```

### Linting & Formatting

```bash
# Run ESLint
pnpm lint --workspaces

# Auto-fix issues
pnpm lint:fix --workspaces

# Format with Prettier (if configured)
pnpm format --workspaces
```

---

## Troubleshooting

### Problem: "VERCEL_TOKEN not found"

**Solution:**
1. Go to Github repository settings
2. Check that `VERCEL_TOKEN` secret exists
3. Regenerate token at https://vercel.com/account/tokens
4. Update Github secret

### Problem: "Build failed: Module not found"

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build --workspaces
```

### Problem: "DATABASE_URL connection failed"

**Solution:**
1. Verify DATABASE_URL in Vercel environment variables
2. Check Supabase connection string format:
   ```
   postgresql://[user]:[password]@[host]/[database]?sslmode=require
   ```
3. Test connection locally:
   ```bash
   psql $DATABASE_URL
   ```

### Problem: "Preview deployment not created"

**Solution:**
1. Check Github Actions log: https://github.com/esalinascl/rutadecarrera-platform/actions
2. Ensure `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are set
3. Verify PR is to `main` branch

### Problem: "Type check failed in CI"

**Solution:**
```bash
# Run locally to debug
pnpm typecheck --workspaces

# Fix TypeScript errors
# Then recommit and push
```

### Problem: "Tests fail in CI but pass locally"

**Possible causes:**
- Different Node.js version (use 20.x)
- Missing environment variables
- Cache issues

**Solution:**
```bash
# Use exact Node.js version
nvm use 20

# Clear cache
rm -rf .next node_modules

# Run same test as CI
pnpm test --workspaces --coverage
```

---

## Monitoring Deployments

### View Deployment History

1. **Vercel Dashboard:** https://vercel.com/dashboard
2. **Github Actions:** https://github.com/esalinascl/rutadecarrera-platform/actions
3. **Deployment Status Badges:**
   - Add to README.md for quick status

### Health Checks

Check application health:

```bash
# Production
curl https://rutadecarrera.com/api/health

# Preview (from PR comment)
curl https://pr-[number].vercel.app/api/health
```

### Rollback Procedures

If production is broken:

1. **Immediate:** Revert on Vercel dashboard (click deployment → promote previous)
2. **Via Git:** 
   ```bash
   git revert HEAD
   git push origin main
   ```

---

## Useful Links

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Github Actions:** https://docs.github.com/en/actions
- **pnpm Workspaces:** https://pnpm.io/workspaces
- **Gemini API Docs:** https://ai.google.dev/docs
- **Supabase Docs:** https://supabase.com/docs

---

## Security Best Practices

✅ **Do's:**
- Store API keys in Github Secrets (never in code)
- Use `.env.local` for local development
- Rotate tokens regularly
- Use separate Supabase projects for staging/production
- Enable branch protection rules on `main`

❌ **Don'ts:**
- Commit `.env.local` files
- Share Vercel tokens publicly
- Use weak database passwords
- Deploy without passing CI checks
- Disable branch protection

---

## FAQ

**Q: How often is production deployed?**  
A: Every time code is merged to `main` and CI passes.

**Q: Can I deploy manually?**  
A: Yes, from Vercel dashboard or CLI: `vercel --prod`

**Q: How do I rollback a deployment?**  
A: Go to Vercel dashboard → Deployments → Click previous version → Promote to production

**Q: What if tests fail?**  
A: Fix tests locally, push new commit. CI will retry automatically.

**Q: How are preview URLs generated?**  
A: Vercel auto-generates from branch name, e.g., `feat-my-feature.vercel.app`

---

**Version:** 1.0  
**Last Updated:** 2026-09-24  
**Owner:** Eduardo Salinas Belletti + Claude Code
