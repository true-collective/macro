#!/usr/bin/env bash
# Push a nginx smoke image to ECR (no nix). Requires working AWS creds on this VM
# (deploy IAM user from SM — not interactive aws login).
set -euo pipefail
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ACCOUNT="${AWS_ACCOUNT_ID:-155833351761}"
REPO="tc-macro/authentication-service"
TAG="${1:-smoke}"
URI="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${REPO}:${TAG}"

echo "Pushing ${URI}"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
docker pull nginx:alpine
docker tag nginx:alpine "$URI"
docker push "$URI"
echo "OK ${URI}"
