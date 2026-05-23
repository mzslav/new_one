set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:-latest}"

tfout() {
  terraform -chdir="$TF_DIR" output -raw "$1"
}

if ! tfout ecr_repositories >/dev/null 2>&1; then
  echo "Спочатку: cd terraform && terraform init && terraform apply"
  exit 1
fi

echo "=== 1/3 ECR login ==="
REGION="$(tfout aws_region)"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

get_repo() {
  terraform -chdir="$TF_DIR" output -json ecr_repositories | python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"
}

echo "=== 2/3 Docker build + push (tag: $TAG) ==="
for name in auth job media notification gateway; do
  case "$name" in
    auth)         DIR="$ROOT/services/auth-service" ;;
    job)          DIR="$ROOT/services/job-service" ;;
    media)        DIR="$ROOT/services/media-service" ;;
    notification) DIR="$ROOT/services/notification-service" ;;
    gateway)      DIR="$ROOT/api-gateway" ;;
  esac
  REPO="$(get_repo "$name")"
  echo "  -> $name"
  docker build -t "${REPO}:${TAG}" "$DIR"
  docker push "${REPO}:${TAG}"
done

echo "=== 3/3 Frontend build + S3 ==="
API_URL="$(tfout vite_api_url_for_frontend_build)"
BUCKET="$(tfout frontend_s3_bucket)"
echo "  VITE_API_URL=$API_URL"
cd "$ROOT/frontend"
if [ -f package-lock.json ]; then npm ci; else npm install; fi
VITE_API_URL="$API_URL" npm run build
aws s3 sync dist/ "s3://${BUCKET}/" --delete

WEBSITE="$(tfout website_url)"
API="$(tfout api_url)"

echo ""
echo "=========================================="
echo "  Готово. Зачекай 2–5 хв (ECS піднімає tasks)."
echo "=========================================="
echo "  Сайт:  $WEBSITE"
echo "  API:   $API"
echo "=========================================="
