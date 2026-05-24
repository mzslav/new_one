#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/terraform"
TAG="${1:-latest}"

tfout() { terraform -chdir="$TF_DIR" output -raw "$1"; }

if ! terraform -chdir="$TF_DIR" output ecr_repositories >/dev/null 2>&1; then
  echo "Błąd: Wykonaj najpierw terraform apply"
  exit 1
fi

echo "=== Logowanie do AWS ECR ==="
REGION="$(tfout aws_region)"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

get_repo() {
  terraform -chdir="$TF_DIR" output -json ecr_repositories | python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"
}

echo "=== Budowanie i wysyłanie obrazów Docker ==="
for name in auth job media notification gateway; do
  DIR="$ROOT/services/${name}-service"
  [ "$name" == "gateway" ] && DIR="$ROOT/api-gateway"

  REPO="$(get_repo "$name")"
  echo " -> Budowanie $name..."
  docker build -q -t "${REPO}:${TAG}" "$DIR"
  docker push -q "${REPO}:${TAG}"
done

echo "=== Budowanie Frontendu i aktualizacja S3 ==="
cd "$ROOT/frontend"
npm install
VITE_API_URL="$(tfout vite_api_url_for_frontend_build)" npm run build
aws s3 sync dist/ "s3://$(tfout frontend_s3_bucket)/" --delete >/dev/null

echo "=========================================="
echo " Strona WWW:  $(tfout website_url)"
echo " API Gateway: $(tfout api_url)"
echo "=========================================="