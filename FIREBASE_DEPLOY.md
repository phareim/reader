# 🔥 Firebase Cloud Run Deployment Guide

Deploy Vibe Reader to Google Cloud Run (Europe West 1).

**Project**: `the-librarian-9b852`
**Region**: `europe-west1` (Belgium)
**Service**: `vibe-reader`

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed: https://cloud.google.com/sdk/docs/install
3. **Docker** installed (for local testing)
4. **Google OAuth credentials** from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

## 🚀 Quick Deploy

### Step 1: Install gcloud CLI

```bash
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash

# Windows - download installer from:
# https://cloud.google.com/sdk/docs/install
```

### Step 2: Initialize gcloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project the-librarian-9b852

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 3: Generate Secrets

```bash
# Generate AUTH_SECRET (save this!)
openssl rand -base64 32
```

### Step 4: Deploy

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

The script will:
- ✅ Build the Docker container
- ✅ Deploy to Cloud Run (europe-west1)
- ✅ Configure service settings
- ✅ Show you the service URL

### Step 5: Set Environment Variables

After deployment, set your secrets:

```bash
# Replace with your actual values
gcloud run services update vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1 \
  --set-env-vars="AUTH_SECRET=YOUR_GENERATED_SECRET_HERE" \
  --set-env-vars="AUTH_ORIGIN=https://your-app-url.web.app" \
  --set-env-vars="GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID" \
  --set-env-vars="GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET" \
  --set-env-vars="DATABASE_URL=file:/app/data/reader.db" \
  --set-env-vars="FETCH_TIMEOUT=30000" \
  --set-env-vars="MAX_ARTICLES_PER_FEED=200"
```

### Step 6: Update Google OAuth

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=the-librarian-9b852)
2. Select your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:
   ```
   https://your-app-url.web.app/api/auth/callback/google
   https://your-cloud-run-url.run.app/api/auth/callback/google
   ```
4. Save

### Step 7: Test Your Deployment

Visit your Cloud Run URL and test:
- ✅ Google OAuth login
- ✅ Add a feed
- ✅ Sync articles
- ✅ Tag management

## 🔄 Updating Your Deployment

```bash
# Just run the deploy script again
./deploy.sh
```

Cloud Run will automatically:
- Build new container
- Deploy with zero downtime
- Keep your environment variables

## 📊 Configuration Details

### Cloud Run Settings

- **Region**: `europe-west1` (Belgium)
- **Memory**: 512 Mi (can increase if needed)
- **CPU**: 1 vCPU
- **Timeout**: 300 seconds
- **Max instances**: 10 (scales automatically)
- **Port**: 8080

### Database

- **Type**: SQLite (works on Cloud Run!)
- **Location**: `/app/data/reader.db` (persists in container)
- **Backups**: Use Cloud Run volumes for persistence (optional)

### Costs (Approximate)

Cloud Run free tier includes:
- 2 million requests/month
- 360,000 GB-seconds/month
- 180,000 vCPU-seconds/month

Estimated cost for light usage: **$0-5/month**

## 🔒 Security Checklist

Before deploying to production:

- [ ] Generated strong `AUTH_SECRET` with `openssl rand -base64 32`
- [ ] `.env` and `prod.env` are in `.gitignore` ✅
- [ ] Updated Google OAuth redirect URI with production URL
- [ ] Set all environment variables in Cloud Run
- [ ] Tested OAuth login flow
- [ ] Verified feed syncing works

## 🛠️ Advanced: CI/CD with Cloud Build

### Auto-deploy on Git Push

1. **Connect GitHub repository**:
   ```bash
   gcloud builds submit --config=cloudbuild.yaml
   ```

2. **Create Cloud Build trigger** in Google Cloud Console:
   - Trigger type: Push to branch
   - Branch: `main`
   - Build configuration: `cloudbuild.yaml`

Now every push to `main` auto-deploys! 🎉

## 🐛 Troubleshooting

### Issue: Container fails to start
**Check logs**:
```bash
gcloud run services logs read vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1
```

### Issue: "AUTH_NO_ORIGIN" error
**Fix**: Ensure `AUTH_ORIGIN` is set to your production URL (without trailing slash)

### Issue: OAuth login redirects to localhost
**Fix**: Update Google OAuth authorized redirect URIs with your production URLs (both Firebase Hosting and Cloud Run)

### Issue: Database resets on deploy
**Solution**: Use Cloud Run volumes for persistence:
```bash
# Create bucket first
gsutil mb -p the-librarian-9b852 -l europe-west1 gs://vibe-reader-data

# Update service
gcloud run services update vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1 \
  --add-volume=name=data,type=cloud-storage,bucket=vibe-reader-data \
  --add-volume-mount=volume=data,mount-path=/app/data
```

### Issue: Cold starts are slow
**Solution**: Set minimum instances:
```bash
gcloud run services update vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1 \
  --min-instances=1
```
(Note: This increases cost but eliminates cold starts)

## 📝 Useful Commands

```bash
# View service details
gcloud run services describe vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1

# View logs (streaming)
gcloud run services logs tail vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1

# View logs (last 50 lines)
gcloud run services logs read vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1 \
  --limit=50

# Update environment variable
gcloud run services update vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1 \
  --set-env-vars="KEY=VALUE"

# Scale configuration
gcloud run services update vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1 \
  --memory=1Gi \
  --cpu=2 \
  --max-instances=20

# Delete service
gcloud run services delete vibe-reader \
  --project the-librarian-9b852 \
  --region europe-west1
```

## 🌍 Other Regions

To deploy to a different region, edit `deploy.sh`:

```bash
REGION="us-central1"        # Iowa, USA
REGION="asia-northeast1"    # Tokyo, Japan
REGION="europe-north1"      # Finland
```

Available regions: https://cloud.google.com/run/docs/locations

## 🎯 Production Best Practices

1. **Enable Cloud Monitoring** for uptime checks
2. **Set up Cloud Storage** for database backups
3. **Configure custom domain** (optional)
4. **Enable Cloud Armor** for DDoS protection (optional)
5. **Set up budget alerts** in Google Cloud Console

## 📧 Support

For issues specific to Cloud Run:
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Stack Overflow: google-cloud-run](https://stackoverflow.com/questions/tagged/google-cloud-run)
