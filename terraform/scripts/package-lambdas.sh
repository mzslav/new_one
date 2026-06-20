#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAMBDA_DIR="$ROOT/lambdas/jobs"
OUT_DIR="$ROOT/terraform/.terraform"
OUT_FILE="$OUT_DIR/jobs-lambda.zip"

echo "=== Packaging jobs Lambda ==="
mkdir -p "$OUT_DIR"

cd "$LAMBDA_DIR"
npm ci --omit=dev
npm run check

rm -f "$OUT_FILE"
zip -qr "$OUT_FILE" .

echo "Lambda package: $OUT_FILE"
