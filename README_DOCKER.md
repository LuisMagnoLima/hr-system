# Sistema de Protocolos da Inagro com Docker

Esta configuração executa o sistema em dois containers:

- `app`: Flask + Gunicorn, servindo também o frontend estático;
- `mongodb`: MongoDB Community Server com armazenamento persistente.

## Requisitos no Windows 11

1. Docker Desktop instalado;
2. WSL 2 habilitado;
3. Docker Desktop aberto e em execução.

## Primeira execução

No PowerShell, dentro da pasta do projeto:

```powershell
Copy-Item .env.example .env
notepad .env
```

Troque pelo menos estas variáveis:

- `SECRET_KEY`;
- `MONGO_ROOT_PASSWORD`.

Para gerar uma chave segura no PowerShell:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Depois execute:

```powershell
docker compose up --build
```

Acesse o sistema em:

```text
http://localhost:5000
```

Para executar em segundo plano:

```powershell
docker compose up -d --build
```

Para acompanhar os logs:

```powershell
docker compose logs -f app
```

Para parar os containers sem apagar os dados:

```powershell
docker compose down
```

## MongoDB Compass

Como a porta do MongoDB está vinculada apenas ao próprio computador, use:

```text
mongodb://inagro_admin:SUA_SENHA@localhost:27017/hr_system?authSource=admin
```

Substitua `SUA_SENHA` pelo valor de `MONGO_ROOT_PASSWORD` no arquivo `.env`.

## Persistência

Os dados não são apagados quando os containers são reiniciados. Eles ficam nos volumes:

- `mongodb_data`: banco de dados;
- `uploads_data`: arquivos enviados pelo sistema.

O comando abaixo apaga containers e também todos os dados persistentes. Use somente quando realmente quiser zerar o ambiente:

```powershell
docker compose down -v
```

## Verificação de saúde

Com os containers em execução, abra:

```text
http://localhost:5000/health
```

A resposta esperada é semelhante a:

```json
{"status":"ok","environment":"development","database":"connected"}
```

## Preparação posterior para o servidor dedicado

No servidor, a porta `27017` não deverá ser publicada. O acesso administrativo ao MongoDB será feito por túnel SSH. Também serão adicionados Nginx, HTTPS e backups externos.
