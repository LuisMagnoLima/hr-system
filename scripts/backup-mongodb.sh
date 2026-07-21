#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.production ]]; then
  echo ".env.production não encontrado."
  exit 1
fi

set -a
source .env.production
set +a

mkdir -p backups
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
ARQUIVO="hr-system_${STAMP}.archive.gz"

docker exec inagro_protocolos_mongodb mongodump \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db "$DB_NAME" \
  --archive="/tmp/${ARQUIVO}" \
  --gzip

docker cp "inagro_protocolos_mongodb:/tmp/${ARQUIVO}" "backups/${ARQUIVO}"
docker exec inagro_protocolos_mongodb rm -f "/tmp/${ARQUIVO}"

find backups -type f -name 'hr-system_*.archive.gz' -mtime +14 -delete
printf 'Backup criado: %s\n' "backups/${ARQUIVO}"
