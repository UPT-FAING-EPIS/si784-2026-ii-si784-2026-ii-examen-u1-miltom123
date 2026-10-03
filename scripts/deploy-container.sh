#!/bin/bash
set -euo pipefail
[[ "$ECR_REPOSITORY_URL" =~ ^[0-9]+\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9-]+$ ]]
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$APP_ORIGIN" =~ ^https://[a-zA-Z0-9.-]+$ ]]
[[ "$JWT_PARAMETER_NAME" =~ ^/[a-zA-Z0-9/_-]+$ ]]
mkdir -p /opt/betsport/data
chown 1001:1001 /opt/betsport/data
umask 077
JWT_SECRET=$(aws ssm get-parameter --name "$JWT_PARAMETER_NAME" --with-decryption --query Parameter.Value --output text)
[[ "$JWT_SECRET" =~ ^[a-zA-Z0-9_-]{32,}$ ]]
printf 'JWT_SECRET=%s\nAPP_ORIGIN=%s\nCOOKIE_SECURE=true\n' "$JWT_SECRET" "$APP_ORIGIN" > /opt/betsport/runtime.env
unset JWT_SECRET
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${ECR_REPOSITORY_URL%%/*}"
docker pull "$ECR_REPOSITORY_URL:$GITHUB_SHA"
if docker container inspect betsport >/dev/null 2>&1; then
  docker stop betsport
  docker rename betsport betsport-previous
fi
rollback() {
  docker rm -f betsport >/dev/null 2>&1 || :
  if docker container inspect betsport-previous >/dev/null 2>&1; then
    docker rename betsport-previous betsport
    docker start betsport
  fi
}
trap rollback ERR
docker run -d --name betsport --restart unless-stopped -p 3000:3000 --env-file /opt/betsport/runtime.env -v /opt/betsport/data:/app/data "$ECR_REPOSITORY_URL:$GITHUB_SHA"
healthy=false
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then healthy=true; break; fi
  sleep 2
done
test "$healthy" = true
trap - ERR
if docker container inspect betsport-previous >/dev/null 2>&1; then docker rm betsport-previous; fi
echo "Aplicación desplegada y healthcheck confirmado."
