# Publicação no Render

Este pacote usa o mesmo código para Render e HostGator. As diferenças ficam nas variáveis de ambiente e na infraestrutura.

## Arquitetura recomendada no Render

- Aplicação Flask/Gunicorn: Render Web Service
- Banco: MongoDB Atlas
- Arquivos enviados: Persistent Disk montado em `/var/data`
- Limite configurado pela aplicação: 1 GB por arquivo

## 1. Enviar ao GitHub

Antes do `git push`, confirme que o arquivo `.env` não existe no repositório. Ele já está listado no `.gitignore`.

```bash
git add .
git commit -m "Configura deploy no Render"
git push
```

## 2. Criar o MongoDB Atlas

Crie um cluster, usuário e senha. Em Network Access, permita o acesso necessário para o Render. Copie a connection string no formato:

```text
mongodb+srv://USUARIO:SENHA@CLUSTER/hr-system?retryWrites=true&w=majority
```

Não coloque essa string no GitHub.

## 3. Criar pelo Blueprint

1. No Render, escolha **New > Blueprint**.
2. Conecte o repositório GitHub.
3. O Render lerá o arquivo `render.yaml`.
4. Quando solicitado, informe `MONGO_URI`.
5. Finalize a criação do serviço.

O Blueprint usa o plano `starter` porque o sistema precisa de disco persistente para os documentos. O plano gratuito não preserva uploads no filesystem.

## 4. Ajustar a origem permitida

Depois que o Render informar a URL real do serviço, abra **Environment** e altere:

```text
ALLOWED_ORIGINS=https://SUA-URL.onrender.com
```

Caso conecte um domínio próprio, use o domínio HTTPS correspondente. Para mais de uma origem, separe por vírgula.

## 5. Testar

Abra:

```text
https://SUA-URL.onrender.com/health
```

O retorno esperado é semelhante a:

```json
{"status":"ok","environment":"production","database":"connected"}
```

Depois, abra a URL principal e teste login, envio, arquivamento, restauração e exclusão definitiva.

## Observações importantes

- O disco inicial está configurado com 10 GB; aumente no painel conforme a necessidade.
- O limite de 1 GB é da aplicação. Uploads grandes também dependem da conexão, do tempo limite da plataforma e do espaço disponível.
- O MongoDB Atlas e o disco persistente não devem ser tratados como substitutos de backup.
- `SECRET_KEY` é gerada automaticamente pelo Render.
- O agendador de retenção está habilitado e executa diariamente às 02:00 no fuso de Fortaleza.
- Ao migrar para a HostGator, mantenha o mesmo código e altere apenas `.env`, Docker Compose, domínio e armazenamento.
