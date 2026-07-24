# Correção do erro 500 em Arquivados

- Normalização de datas do MongoDB (UTC sem tzinfo) para America/Fortaleza.
- Serialização recursiva segura de ObjectId, datetime e tipos BSON.
- Exclusão de `arquivo_dados` da consulta para não retornar PDFs binários no JSON.
- Tratamento de erro com log no backend.
- Restauração preserva o `_id` original e só remove o arquivado depois de salvar o documento ativo.
- Validação segura dos caminhos de arquivo ao restaurar.
