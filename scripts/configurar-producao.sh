#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

read -rp "Domínio completo (ex.: sistema.empresa.com.br): " DOMAIN
read -rp "E-mail para o certificado Let's Encrypt: " EMAIL

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Domínio e e-mail são obrigatórios."
  exit 1
fi

SECRET_KEY="$(openssl rand -hex 48)"
MONGO_PASSWORD="$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)"

cat > .env.production <<ENV
FLASK_ENV=production
PORT=5000
SECRET_KEY=${SECRET_KEY}
DB_NAME=hr-system
MONGO_ROOT_USERNAME=inagro_admin
MONGO_ROOT_PASSWORD=${MONGO_PASSWORD}
ALLOWED_ORIGINS=https://${DOMAIN}
COOKIE_SECURE=true
COOKIE_SAMESITE=Lax
COOKIE_NAME=hr_session
TOKEN_HOURS=8
MAX_FILE_SIZE=104857600
ENABLE_SCHEDULER=false
MONGO_SERVER_SELECTION_TIMEOUT_MS=5000
MONGO_CONNECT_TIMEOUT_MS=5000
MONGO_SOCKET_TIMEOUT_MS=20000
MONGO_MIN_POOL_SIZE=1
MONGO_MAX_POOL_SIZE=50
ENV

chmod 600 .env.production
sed "s/__DOMAIN__/${DOMAIN}/g" nginx/templates/http.conf.template > nginx/conf.d/default.conf

echo "Arquivo .env.production criado."
echo "Senha do MongoDB: ${MONGO_PASSWORD}"
echo "Guarde essa senha em local seguro."

echo "Subindo aplicação em HTTP para emissão do certificado..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build mongodb app nginx

echo "Solicitando certificado Let's Encrypt..."
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --email "$EMAIL" --agree-tos --no-eff-email \
  -d "$DOMAIN"

sed "s/__DOMAIN__/${DOMAIN}/g" nginx/templates/https.conf.template > nginx/conf.d/default.conf

docker compose --env-file .env.production -f docker-compose.prod.yml exec nginx nginx -t
docker compose --env-file .env.production -f docker-compose.prod.yml exec nginx nginx -s reload

echo "Deploy concluído: https://${DOMAIN}"
