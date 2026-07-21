# Deploy do HR System em servidor dedicado HostGator

Este pacote mantém o `docker-compose.yml` local e adiciona uma configuração separada para produção:

- `docker-compose.prod.yml`: aplicação, MongoDB, Nginx e Certbot.
- `nginx/`: proxy reverso e HTTPS.
- `scripts/configurar-producao.sh`: cria o ambiente, sobe os containers e emite o certificado.
- `scripts/backup-mongodb.sh`: cria backup compactado do banco.
- `.env.production.example`: referência das variáveis.

## Antes de começar

O servidor precisa ter Linux, Docker Engine, Docker Compose Plugin, Git/Unzip e OpenSSL. O domínio deve possuir um registro DNS do tipo A apontando para o IP público do servidor.

No firewall, libere apenas:

- TCP 22 para SSH;
- TCP 80 para HTTP;
- TCP 443 para HTTPS.

Não exponha as portas 5000, 27017 ou 27018.

## Instalação

Envie a pasta para o servidor, acesse-a pelo SSH e execute:

```bash
chmod +x scripts/*.sh
./scripts/configurar-producao.sh
```

O script solicitará domínio e e-mail, gerará automaticamente uma nova `SECRET_KEY` e uma senha forte para o MongoDB, subirá a aplicação e configurará HTTPS.

## Verificação

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -I https://SEU_DOMINIO
```

## Atualização do sistema

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Não use `docker compose down -v` em produção: o parâmetro `-v` apaga o banco e os uploads.

## Backup manual

```bash
./scripts/backup-mongodb.sh
```

Para executar diariamente às 02:30:

```bash
crontab -e
```

Adicione, ajustando o caminho:

```cron
30 2 * * * cd /opt/hr-system && ./scripts/backup-mongodb.sh >> /var/log/hr-system-backup.log 2>&1
15 3 * * * cd /opt/hr-system && ./scripts/renovar-certificado.sh >> /var/log/hr-system-certbot.log 2>&1
```

## Logs

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f nginx
```

## Observação importante

O pacote não contém senhas reais nem o `.env` local. O arquivo `.env.production` é criado diretamente no servidor pelo script e deve permanecer privado.
