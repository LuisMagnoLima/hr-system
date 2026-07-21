# Retenção e upload de documentos

Esta versão implementa o seguinte fluxo:

- O botão de exclusão dos documentos ativos apenas move o documento para **Arquivados**.
- Documentos ativos são arquivados automaticamente quando completam **5 anos** desde `data_envio`.
- Documentos arquivados são apagados automaticamente depois de **6 meses**.
- Administradores podem restaurar ou apagar definitivamente um documento arquivado.
- A tela de Arquivados mostra a data de expiração e a contagem regressiva.
- O limite máximo por PDF é **1 GB** (`1073741824` bytes).
- PDFs novos são gravados no volume Docker `uploads_data`; o MongoDB guarda somente os metadados.
- PDFs antigos armazenados no MongoDB continuam compatíveis para visualização.

## Atualizar sem apagar o banco

```bash
docker compose up -d --build
```

Não use `docker compose down -v`, pois `-v` remove os volumes.

## Tarefa automática

A variável abaixo precisa estar habilitada:

```env
ENABLE_SCHEDULER=true
```

A rotina é executada diariamente às 02:00 no fuso `America/Fortaleza`.

## Produção com Nginx

Os modelos de configuração em `nginx/templates` aceitam uploads de 1 GB e usam timeout de 1 hora. Depois de alterar os modelos em um servidor já configurado, execute novamente o script de configuração ou atualize o arquivo ativo em `nginx/conf.d`.
