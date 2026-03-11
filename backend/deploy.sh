#!/usr/bin/env bash
# =============================================================================
# deploy.sh — AgentBanjir Backend Deployment Script
# =============================================================================
#
# Performs the full one-command deployment of the AgentBanjir backend to
# Google Cloud Run. Idempotent: safe to re-run on every deployment.
#
# Prerequisites (run once before first deploy — see §PREREQUISITES below):
#   1. gcloud CLI installed and authenticated: gcloud auth login
#   2. Docker installed (only needed for local build path)
#   3. Required APIs enabled: Cloud Run, Cloud Build, Secret Manager,
#      Artifact Registry, IAM
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh                          # Deploy with defaults
#   ./deploy.sh --skip-tests             # Skip the CI test run in builder stage
#   ./deploy.sh --local-build            # Build image locally, push to registry
#
# =============================================================================

set -euo pipefail   # Exit on error, undefined vars, and pipe failures.
IFS=$'\n\t'         # Safe word-splitting: only newline and tab, not space.

# =============================================================================
# ── CONFIGURATION ─────────────────────────────────────────────────────────────
# All project-specific values are defined here. Edit this block only.
# =============================================================================

readonly PROJECT_ID="agentbanjir-hackathon-prod"
readonly REGION="asia-southeast1"           # Singapore — lowest latency for MY
readonly SERVICE_NAME="agentbanjir-backend"
readonly IMAGE_NAME="agentbanjir-backend"

# Artifact Registry repository — created by this script on first run.
readonly AR_REPO="agentbanjir-repo"
readonly AR_HOST="${REGION}-docker.pkg.dev"
readonly IMAGE_URI="${AR_HOST}/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}"

# Service account used by the Cloud Run service at runtime.
# Granted only the Secret Manager Accessor role — principle of least privilege.
readonly SA_NAME="agentbanjir-backend-sa"
readonly SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Secret Manager secret IDs.
# The secret values themselves are NEVER in this script.
# Populate them manually once with the commands in §SECRET SETUP below.
readonly SECRET_GEMINI_API_KEY="gemini-api-key"
readonly SECRET_GCP_PROJECT="gcp-project-id"

# Cloud Run instance configuration per SDD §13.2.
readonly CONCURRENCY=80
readonly MIN_INSTANCES=0    # Scale-to-zero for hackathon cost savings.
readonly MAX_INSTANCES=5
readonly MEMORY="512Mi"
readonly CPU="1"
readonly TIMEOUT="60s"      # Max request timeout; Gemini calls are <30s.

# =============================================================================
# ── ARGUMENT PARSING ──────────────────────────────────────────────────────────
# =============================================================================

SKIP_TESTS=false
LOCAL_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-tests)   SKIP_TESTS=true  ;;
    --local-build)  LOCAL_BUILD=true ;;
    --help)
      echo "Usage: ./deploy.sh [--skip-tests] [--local-build]"
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown argument: $arg"
      exit 1
      ;;
  esac
done

# =============================================================================
# ── UTILITY FUNCTIONS ─────────────────────────────────────────────────────────
# =============================================================================

# Prints a section header to stdout.
log_section() { echo ""; echo "══════════════════════════════════════════"; echo "  $1"; echo "══════════════════════════════════════════"; }

# Prints a success milestone — matches the Winston INFO log pattern.
log_info()    { echo "[INFO]  $1"; }

# Prints a warning.
log_warn()    { echo "[WARN]  $1"; }

# Prints a fatal error and exits.
log_fatal()   { echo "[FATAL] $1" >&2; exit 1; }

# =============================================================================
# ── STEP 0: PREFLIGHT CHECKS ──────────────────────────────────────────────────
# =============================================================================

log_section "Step 0: Preflight Checks"

# Verify gcloud is installed.
command -v gcloud > /dev/null 2>&1 || log_fatal "gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"

# Verify the operator is authenticated.
ACTIVE_ACCOUNT=$(gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>/dev/null || true)
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  log_fatal "No active gcloud account. Run: gcloud auth login"
fi
log_info "Authenticated as: ${ACTIVE_ACCOUNT}"

# Set the active project.
gcloud config set project "${PROJECT_ID}" --quiet
log_info "Active GCP project: ${PROJECT_ID}"

# =============================================================================
# ── STEP 1: ENABLE REQUIRED APIS ──────────────────────────────────────────────
# =============================================================================

log_section "Step 1: Enable Required GCP APIs"

# This is idempotent — enabling an already-enabled API is a no-op.
APIS=(
  "run.googleapis.com"
  "cloudbuild.googleapis.com"
  "secretmanager.googleapis.com"
  "artifactregistry.googleapis.com"
  "iam.googleapis.com"
)

for api in "${APIS[@]}"; do
  log_info "Enabling: ${api}"
  gcloud services enable "${api}" --project="${PROJECT_ID}" --quiet
done

# =============================================================================
# ── STEP 2: ARTIFACT REGISTRY REPOSITORY ─────────────────────────────────────
# =============================================================================

log_section "Step 2: Ensure Artifact Registry Repository Exists"

if ! gcloud artifacts repositories describe "${AR_REPO}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --quiet > /dev/null 2>&1; then
  log_info "Creating Artifact Registry repository: ${AR_REPO}"
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="AgentBanjir Docker images" \
    --quiet
else
  log_info "Artifact Registry repository already exists: ${AR_REPO}"
fi

# =============================================================================
# ── STEP 3: SERVICE ACCOUNT ───────────────────────────────────────────────────
# =============================================================================

log_section "Step 3: Ensure Dedicated Service Account Exists"

if ! gcloud iam service-accounts describe "${SA_EMAIL}" \
    --project="${PROJECT_ID}" \
    --quiet > /dev/null 2>&1; then
  log_info "Creating service account: ${SA_EMAIL}"
  gcloud iam service-accounts create "${SA_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="AgentBanjir Backend Runtime SA" \
    --description="Runtime identity for the AgentBanjir Cloud Run service. Secret Manager Accessor only." \
    --quiet
else
  log_info "Service account already exists: ${SA_EMAIL}"
fi

# Grant Secret Manager Accessor role — minimum IAM permission required to
# read secret versions at runtime. No other roles are granted.
log_info "Binding secretmanager.secretAccessor role to ${SA_EMAIL}"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None \
  --quiet > /dev/null

# =============================================================================
# ── STEP 4: VERIFY SECRETS EXIST ─────────────────────────────────────────────
# =============================================================================
#
# This script does NOT create secret values. Secrets must be populated once
# before the first deploy. See §PREREQUISITES at the bottom of this file.
#
# =============================================================================

log_section "Step 4: Verify Secrets Exist in Secret Manager"

for secret_id in "${SECRET_GEMINI_API_KEY}" "${SECRET_GCP_PROJECT}"; do
  if ! gcloud secrets describe "${secret_id}" \
      --project="${PROJECT_ID}" \
      --quiet > /dev/null 2>&1; then
    log_fatal "Secret '${secret_id}' not found in Secret Manager.
  Create it with:
    echo -n 'YOUR_VALUE' | gcloud secrets create ${secret_id} \\
      --project=${PROJECT_ID} \\
      --data-file=-
  See the PREREQUISITES section at the bottom of this script."
  fi
  log_info "Secret verified: ${secret_id}"
done

# =============================================================================
# ── STEP 5: BUILD AND PUSH IMAGE ──────────────────────────────────────────────
# =============================================================================

log_section "Step 5: Build and Push Docker Image"

# Derive a short Git SHA for the image tag. Falls back to a timestamp if
# the directory is not a Git repository (e.g., in a Cloud Build environment).
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)
VERSIONED_TAG="${IMAGE_URI}:${GIT_SHA}"
LATEST_TAG="${IMAGE_URI}:latest"

# Build argument controls whether the builder stage runs the test suite.
# Default is to always run tests — broken code must not reach production.
if [[ "${SKIP_TESTS}" == "true" ]]; then
  log_warn "--skip-tests flag set. Tests will NOT run during image build."
  log_warn "Only use this for emergency hotfixes. Never skip tests on main."
fi

if [[ "${LOCAL_BUILD}" == "true" ]]; then
  # ── Local Build Path ─────────────────────────────────────────────────────
  log_info "Building image locally: ${VERSIONED_TAG}"

  # Configure Docker to authenticate against Artifact Registry.
  gcloud auth configure-docker "${AR_HOST}" --quiet

  docker build \
    --tag  "${VERSIONED_TAG}" \
    --tag  "${LATEST_TAG}" \
    --file ./Dockerfile \
    --build-arg SKIP_TESTS="${SKIP_TESTS}" \
    --progress=plain \
    .

  log_info "Pushing image: ${VERSIONED_TAG}"
  docker push "${VERSIONED_TAG}"
  docker push "${LATEST_TAG}"

else
  # ── Cloud Build Path (default) ────────────────────────────────────────────
  # Cloud Build runs the multi-stage Dockerfile entirely on GCP infrastructure.
  # No local Docker daemon required. Preferred for CI and shared machines.
  log_info "Submitting build to Cloud Build: ${VERSIONED_TAG}"

  gcloud builds submit . \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --tag="${VERSIONED_TAG}" \
    --suppress-logs
fi

log_info "Image ready: ${VERSIONED_TAG}"

# =============================================================================
# ── STEP 6: DEPLOY TO CLOUD RUN ───────────────────────────────────────────────
# =============================================================================

log_section "Step 6: Deploy to Cloud Run"

log_info "Deploying service: ${SERVICE_NAME} in ${REGION}"

gcloud run deploy "${SERVICE_NAME}" \
  --image="${VERSIONED_TAG}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  \
  `# ── Runtime Identity ─────────────────────────────────────────────` \
  --service-account="${SA_EMAIL}" \
  \
  `# ── Secrets Injection ────────────────────────────────────────────` \
  `# Secrets are mounted as env vars at runtime. Never baked into image.` \
  --set-secrets="GEMINI_API_KEY=${SECRET_GEMINI_API_KEY}:latest" \
  --set-secrets="GOOGLE_CLOUD_PROJECT=${SECRET_GCP_PROJECT}:latest" \
  \
  `# ── Static Environment Variables ─────────────────────────────────` \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="LOG_LEVEL=info" \
  --set-env-vars="LOG_TO_FILE=false" \
  --set-env-vars="VITE_FRONTEND_ORIGIN=${CORS_ORIGIN:-https://agentbanjir.web.app}" \
  \
  `# ── Scaling ──────────────────────────────────────────────────────` \
  --concurrency="${CONCURRENCY}" \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  \
  `# ── Resources ────────────────────────────────────────────────────` \
  --memory="${MEMORY}" \
  --cpu="${CPU}" \
  --timeout="${TIMEOUT}" \
  \
  `# ── Health Check ─────────────────────────────────────────────────` \
  --port=8080 \
  \
  `# ── Ingress / Auth ───────────────────────────────────────────────` \
  `# Login-free per hackathon clarification item #7.` \
  --ingress=all \
  --allow-unauthenticated \
  \
  --quiet

# =============================================================================
# ── STEP 7: POST-DEPLOY VERIFICATION ─────────────────────────────────────────
# =============================================================================

log_section "Step 7: Post-Deploy Verification"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)")

log_info "Service URL: ${SERVICE_URL}"
log_info "Probing health endpoint..."

# Allow up to 30 seconds for the new revision to become healthy.
HEALTH_STATUS=$(curl --silent --max-time 10 --retry 3 --retry-delay 5 \
  --retry-all-errors \
  "${SERVICE_URL}/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unreachable")

if [[ "${HEALTH_STATUS}" == "ok" ]]; then
  log_info "Health check: PASSED ✓"
else
  log_warn "Health check returned: '${HEALTH_STATUS}'. Check Cloud Run logs:"
  log_warn "  gcloud run services logs read ${SERVICE_NAME} --project=${PROJECT_ID} --region=${REGION}"
fi

# =============================================================================
# ── DEPLOYMENT COMPLETE ────────────────────────────────────────────────────────
# =============================================================================

log_section "Deployment Complete"
log_info "Service:    ${SERVICE_NAME}"
log_info "Image:      ${VERSIONED_TAG}"
log_info "Region:     ${REGION}"
log_info "URL:        ${SERVICE_URL}"
log_info "Logs:       gcloud run services logs read ${SERVICE_NAME} --project=${PROJECT_ID} --region=${REGION} --limit=50"

# =============================================================================
# ── PREREQUISITES: FIRST-TIME SECRET SETUP ───────────────────────────────────
# =============================================================================
#
# Run these commands ONCE before the first deploy. The deploy script will
# verify these secrets exist and fail fast (Step 4) if they are missing.
#
# 1. Create the Gemini API key secret:
#
#    echo -n 'YOUR_GEMINI_API_KEY' | gcloud secrets create gemini-api-key \
#      --project=agentbanjir-hackathon-prod \
#      --data-file=-
#
# 2. Create the GCP project ID secret:
#
#    echo -n 'agentbanjir-hackathon-prod' | gcloud secrets create gcp-project-id \
#      --project=agentbanjir-hackathon-prod \
#      --data-file=-
#
# 3. To rotate a secret value (add a new version):
#
#    echo -n 'NEW_VALUE' | gcloud secrets versions add gemini-api-key \
#      --project=agentbanjir-hackathon-prod \
#      --data-file=-
#
# 4. To verify a secret version exists:
#
#    gcloud secrets versions list gemini-api-key \
#      --project=agentbanjir-hackathon-prod
#
# =============================================================================
