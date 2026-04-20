#!/usr/bin/env bash
# =============================================================================
# deploy.sh — AgentBanjir Backend Deployment Script (PRODUCTION FIXED)
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
readonly PROJECT_ID="agentbanjir-hackathon-prod"
readonly REGION="asia-southeast1"
readonly SERVICE_NAME="agentbanjir-backend"
readonly IMAGE_NAME="agentbanjir-backend"
readonly AR_REPO="agentbanjir-repo"
readonly AR_HOST="${REGION}-docker.pkg.dev"
readonly IMAGE_URI="${AR_HOST}/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}"
readonly SA_NAME="agentbanjir-backend-sa"
readonly SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
readonly SECRET_GEMINI_API_KEY="gemini-api-key"
readonly SECRET_GCP_PROJECT="gcp-project-id"

# ── RESOURCES (MATCHING PRODUCTION SPECS) ─────────────────────────────────────
readonly CONCURRENCY=80
readonly MIN_INSTANCES=0
readonly MAX_INSTANCES=5
readonly MEMORY="2Gi"       # Fixed: Prevents AI OOM crashes
readonly CPU="1"
readonly TIMEOUT="300s"     # Fixed: Prevents AI timeout errors

# ── PRODUCTION ENVIRONMENT VARS ───────────────────────────────────────────────
readonly PROD_DB_URL="postgresql://postgres.qzbkelfpgodyheqnjcao:PPyFe%2FdLtLA-FM2@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
readonly PROD_DATA_STORE="agentbanjir-boats-ds_1776496142860"
readonly PROD_FRONTEND="https://agentbanjir-frontend-993781728207.asia-southeast1.run.app"

log_section() { echo ""; echo "══════════════════════════════════════════"; echo "  $1"; echo "══════════════════════════════════════════"; }
log_info()    { echo "[INFO]  $1"; }
log_warn()    { echo "[WARN]  $1"; }
log_fatal()   { echo "[FATAL] $1" >&2; exit 1; }

# --- Step 0 - 4 (Skipped for brevity, same as your existing script) ---
# ... (Keep your existing Step 0, 1, 2, 3, and 4 logic here) ...

log_section "Step 5: Build and Push Docker Image"
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)
VERSIONED_TAG="${IMAGE_URI}:${GIT_SHA}"

gcloud builds submit . \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --tag="${VERSIONED_TAG}" \
  --suppress-logs

log_section "Step 6: Deploy to Cloud Run"
gcloud run deploy "${SERVICE_NAME}" \
  --image="${VERSIONED_TAG}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --service-account="${SA_EMAIL}" \
  --set-secrets="GEMINI_API_KEY=${SECRET_GEMINI_API_KEY}:latest" \
  --set-secrets="GOOGLE_CLOUD_PROJECT=${SECRET_GCP_PROJECT}:latest" \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="DATABASE_URL=${PROD_DB_URL}" \
  --set-env-vars="VERTEX_DATA_STORE_ID=${PROD_DATA_STORE}" \
  --set-env-vars="VITE_FRONTEND_ORIGIN=${PROD_FRONTEND}" \
  --set-env-vars="TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}" \
  --set-env-vars="TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}" \
  --set-env-vars="TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}" \
  --memory="${MEMORY}" \
  --cpu="${CPU}" \
  --timeout="${TIMEOUT}" \
  --concurrency="${CONCURRENCY}" \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --ingress=all \
  --allow-unauthenticated \
  --quiet

log_section "Deployment Complete"
echo "[INFO] URL: https://agentbanjir-backend-993781728207.asia-southeast1.run.app"