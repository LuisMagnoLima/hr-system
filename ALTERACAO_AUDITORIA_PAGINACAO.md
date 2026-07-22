# Auditoria com paginação

- Interface compactada.
- Seleção de 100, 300, 500, 1000 ou todos os registros.
- Paginação numérica no topo e no rodapé.
- Exemplo com 100 por página: página 1 mostra 1–100, página 2 mostra 101–200.
- Texto de intervalo: "Mostrando 101–200 de X registros".
- Backend com `skip` e `limit`, sem limite total de histórico.
- Filtros aplicados no MongoDB antes da contagem e paginação.
