#!/bin/bash

# Firebase Cloud Run Deployment Script for Vibe Reader
# Project: the-librarian-9b852
# Region: europe-west1

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="the-librarian-9b852"
SERVICE_NAME="vibe-reader"
REGION="europe-west1"
PLATFORM="managed"

echo -e "${GREEN}🚀 Deploying Vibe Reader to Cloud Run${NC}\n"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}Not logged in to gcloud. Running auth...${NC}"
    gcloud auth login
fi

# Set the project
echo -e "${YELLOW}Setting project to ${PROJECT_ID}...${NC}"
gcloud config set project ${PROJECT_ID}

echo -e "${GREEN}Project: ${PROJECT_ID}${NC}"
echo -e "${GREEN}Service: ${SERVICE_NAME}${NC}"
echo -e "${GREEN}Region: ${REGION}${NC}\n"

# Confirm deployment
read -p "Deploy to Cloud Run? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo -e "\n${YELLOW}Building and deploying...${NC}\n"

# Deploy to Cloud Run with environment variables
gcloud run deploy ${SERVICE_NAME} \
    --project ${PROJECT_ID} \
    --source . \
    --region ${REGION} \
    --platform ${PLATFORM} \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --port 8080 \
    --set-env-vars "NODE_ENV=production"

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --project ${PROJECT_ID} --region ${REGION} --format 'value(status.url)')

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}Service URL: ${SERVICE_URL}${NC}\n"

echo -e "${YELLOW}⚠️  IMPORTANT: Set environment variables${NC}"
echo -e "Run the following command with your actual values:\n"
echo -e "  ${GREEN}# Set environment variables${NC}"
echo -e "  gcloud run services update ${SERVICE_NAME} \\"
echo -e "    --project ${PROJECT_ID} \\"
echo -e "    --region ${REGION} \\"
echo -e "    --set-env-vars=\"AUTH_SECRET=YOUR_GENERATED_SECRET\" \\"
echo -e "    --set-env-vars=\"AUTH_ORIGIN=https://your-app.web.app\" \\"
echo -e "    --set-env-vars=\"GOOGLE_CLIENT_ID=YOUR_CLIENT_ID\" \\"
echo -e "    --set-env-vars=\"GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET\" \\"
echo -e "    --set-env-vars=\"DATABASE_URL=file:/app/data/reader.db\" \\"
echo -e "    --set-env-vars=\"FETCH_TIMEOUT=30000\" \\"
echo -e "    --set-env-vars=\"MAX_ARTICLES_PER_FEED=200\"\n"

echo -e "${YELLOW}📝 Don't forget to:${NC}"
echo -e "  1. Update Google OAuth redirect URIs in Google Console"
echo -e "  2. Set the environment variables above with your actual values"
echo -e "  3. Test the deployment\n"
