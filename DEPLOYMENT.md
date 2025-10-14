# Production Deployment Guide

This guide covers deploying Vibe Reader to Vercel or Firebase.

## 🚨 Critical: Database Migration Required

**SQLite won't work on Vercel** (serverless environment with ephemeral filesystem). You must migrate to a serverless-compatible database.

### Recommended Database Options

#### Option 1: Vercel Postgres (Easiest for Vercel)
1. Install Vercel Postgres in your Vercel dashboard
2. Get connection string from Vercel
3. Update `DATABASE_URL` environment variable
4. Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"  // Changed from sqlite
  url      = env("DATABASE_URL")
}
```
5. Run: `npx prisma migrate dev --name switch_to_postgres`

#### Option 2: Neon (Serverless Postgres)
- Sign up at https://neon.tech
- Create database and get connection string
- Follow same steps as Vercel Postgres

#### Option 3: PlanetScale (MySQL)
- Sign up at https://planetscale.com
- Create database
- Update schema provider to `mysql`

## 📋 Pre-Deployment Checklist

### 1. Environment Variables

Set these in Vercel/Firebase:

```bash
# Database (REQUIRED)
DATABASE_URL="postgresql://..."  # Your production database connection string

# Auth (REQUIRED - Generate new secret!)
AUTH_SECRET="<generate-with-openssl-rand-base64-32>"
AUTH_ORIGIN="https://your-app.vercel.app"  # Your production URL

# Google OAuth (REQUIRED)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional
FETCH_TIMEOUT=30000
MAX_ARTICLES_PER_FEED=500
```

### 2. Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```

### 3. Database Setup

After switching to Postgres/MySQL:

```bash
# Generate Prisma client
npx prisma generate

# Push schema to production database
npx prisma db push

# Optional: Seed with data if needed
```

## 🚀 Deploying to Vercel

### Step 1: Install Vercel CLI (optional)
```bash
npm i -g vercel
```

### Step 2: Connect to Vercel

#### Via CLI:
```bash
vercel
```

#### Via GitHub:
1. Push code to GitHub
2. Import project in [Vercel Dashboard](https://vercel.com/new)
3. Vercel will auto-detect Nuxt

### Step 3: Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables:
- Add all variables from `.env.example`
- Generate new `AUTH_SECRET`
- Update `AUTH_ORIGIN` to your Vercel URL

### Step 4: Add Vercel Postgres (Recommended)

1. In Vercel Dashboard → Storage → Create Database
2. Select Postgres
3. Connection string automatically added as `POSTGRES_URL`
4. Update your env var: `DATABASE_URL="${POSTGRES_URL}"`

### Step 5: Deploy

```bash
# Auto-deploy via GitHub
git push

# Or manual deploy
vercel --prod
```

### Step 6: Run Database Migrations

After first deploy:
```bash
# Set production DATABASE_URL locally
export DATABASE_URL="your-production-db-url"

# Push schema
npx prisma db push
```

## 🔥 Deploying to Firebase

Firebase works better with **Cloud Run** (not Functions) due to SQLite limitations.

### Option A: Firebase with Cloud Run (Recommended)

1. **Keep SQLite** - Cloud Run has persistent filesystem
2. **Create `Dockerfile`**:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build the app
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

CMD ["node", ".output/server/index.mjs"]
```

3. **Deploy**:
```bash
# Build and deploy to Cloud Run
gcloud run deploy vibe-reader \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

4. **Set environment variables** in Cloud Run console

### Option B: Firebase Hosting + Cloud Functions

Not recommended - would require database migration like Vercel.

## 🔒 Security Checklist

- [ ] Generated strong `AUTH_SECRET` (use `openssl rand -base64 32`)
- [ ] `.env` is in `.gitignore` (✅ already done)
- [ ] Updated OAuth redirect URIs for production domain
- [ ] Database connection uses SSL in production
- [ ] No sensitive data in git history

## 📊 Post-Deployment

### Verify Deployment

1. Visit your production URL
2. Test Google OAuth login
3. Add a feed
4. Check that articles sync
5. Test tag functionality

### Monitor

- Check Vercel logs for errors
- Monitor database usage
- Set up Sentry or similar for error tracking (optional)

### Database Migrations

When updating schema:
```bash
# Create migration
npx prisma migrate dev --name your_migration_name

# Apply to production
npx prisma migrate deploy
```

## 🐛 Common Issues

### Issue: "AUTH_NO_ORIGIN" error
**Fix**: Set `AUTH_ORIGIN` environment variable to your production URL

### Issue: "Database file not found"
**Fix**: Migrate to Postgres/MySQL - SQLite doesn't work on Vercel

### Issue: OAuth login fails
**Fix**: Add production URL to Google OAuth authorized redirect URIs

### Issue: Prisma client errors
**Fix**: Run `npx prisma generate` after changing schema

## 📝 Notes

- Vercel serverless functions have a 10-second timeout (hobby plan)
- Consider Edge runtime for faster cold starts
- Database should be in same region as deployment for better performance
- Feed sync can be set up as a cron job via Vercel Cron or external service
