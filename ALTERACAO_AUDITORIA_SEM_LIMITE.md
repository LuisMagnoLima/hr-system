# Auditoria sem limite fixo de 300 registros

A tela de auditoria agora permite escolher a quantidade de logs exibidos:

- 0–100
- 0–300
- 0–500
- 0–1000
- Todos os registros

No backend, o parâmetro `limite=0` remove o limite da consulta. Os demais valores aplicam limite apenas à exibição atual.
