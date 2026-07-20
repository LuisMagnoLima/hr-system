# Deploy temporário no Render

Este pacote prepara o sistema para servir o frontend e o backend pelo mesmo Web Service.

## Antes de enviar ao GitHub

1. Substitua `backend/app.py` pelo arquivo deste pacote.
2. Copie `render.yaml` e `.python-version` para a raiz do projeto.
3. Não envie o arquivo `.env`.
4. Confirme que `backend/database.py` existe, pois o `app.py` usa a infraestrutura da Produção 2.1.

## Deploy com Blueprint

1. Envie as alterações para o GitHub.
2. No Render, clique em **New > Blueprint**.
3. Selecione o repositório.
4. O Render detectará `render.yaml`.
5. Informe `MONGO_URI` quando solicitado.
6. Conclua a criação.

## MongoDB Atlas

Para uma apresentação, libere temporariamente `0.0.0.0/0` em Network Access e use uma senha forte. Depois remova essa liberação.

## Testes

Abra primeiro:

- `https://NOME-DO-SERVICO.onrender.com/health`
- `https://NOME-DO-SERVICO.onrender.com/`

O primeiro endereço deve retornar status `ok`; o segundo deve abrir a tela de login.

## Observação sobre arquivos

No plano gratuito, a pasta `uploads` é temporária. Os registros no MongoDB permanecem, mas arquivos enviados podem desaparecer após reinicializações ou novos deploys.
