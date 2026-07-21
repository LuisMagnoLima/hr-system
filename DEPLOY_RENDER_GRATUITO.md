# Deploy gratuito no Render

Esta versão usa o plano gratuito do Render e o MongoDB Atlas gratuito.

## Importante

Os arquivos enviados ficam em `/tmp/uploads`. Esse armazenamento é temporário e pode ser apagado quando o serviço reinicia ou recebe um novo deploy. Use esta versão para testes e demonstração.

O limite configurado no sistema continua sendo 1 GB, mas arquivos grandes podem falhar no plano gratuito por tempo de resposta, memória ou reinicialização do serviço.

## 1. Enviar ao GitHub

Confirme que `.env` não está no repositório:

```bash
git status
```

Depois envie:

```bash
git init
git add .
git commit -m "Configura deploy gratuito no Render"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

## 2. Criar o MongoDB Atlas gratuito

Crie um cluster gratuito e copie a string de conexão `mongodb+srv://...`.

## 3. Criar no Render

1. Acesse o Render.
2. Escolha **New > Blueprint**.
3. Selecione o repositório.
4. Informe `MONGO_URI` quando solicitado.
5. Inicie o deploy.

## 4. Variáveis principais

O arquivo `render.yaml` já define:

- `plan: free`
- `MAX_FILE_SIZE=1073741824`
- `UPLOAD_FOLDER=/tmp/uploads`
- `ENABLE_SCHEDULER=true`
- cookies seguros para HTTPS

## 5. Teste

Abra:

```text
https://NOME-DO-SERVICO.onrender.com/health
```

Se alterar o nome do serviço, atualize `ALLOWED_ORIGINS` no painel do Render.
