function voltarBanco() {
  window.location.href = "banco_dados.html"
}

function traduzirAcao(acao) {
  const mapa = {
  login_sucesso: "Login com sucesso",
  login_falhou: "Falha no login",
  logout: "Logout",

  upload_documento: "Upload de documento",
  upload_financeiro: "Upload financeiro",
  visualizar_documento: "Visualização de documento",
  editar_documento_financeiro: "Edição pelo financeiro",
  confirmar_documento_financeiro: "Confirmado pelo financeiro",
  desconfirmar_documento_financeiro: "Confirmação removida",
  delete_documento_financeiro: "Exclusão pelo financeiro",

  criar_solicitacao: "Criação de solicitação",
  processar_solicitacao: "Processamento de solicitação",

  arquivar_documento: "Arquivamento automático",
  restaurar_arquivamento: "Restauração de arquivado",
  excluir_arquivamento_definitivo: "Exclusão definitiva",

  admin_criar_usuario: "Criação de usuário",
  admin_editar_usuario: "Edição de usuário",
  admin_alterar_senha_usuario: "Alteração de senha",
  admin_excluir_usuario: "Exclusão de usuário",

  tentativa_acesso_negado: "Tentativa de acesso negado"
};

  return mapa[acao] || acao
}
function formatarData(log) {
  if (log.dia && log.mes && log.ano && log.hora) {
    const dia = String(log.dia).padStart(2, "0")
    const mes = String(log.mes).padStart(2, "0")
    return `${dia}/${mes}/${log.ano} ${log.hora}`
  }

  return "-"
}

function mesmaData(log, dataFiltro) {
  if (!dataFiltro) return true

  const [ano, mes, dia] = dataFiltro.split("-").map(Number)

  return (
    Number(log.ano) === ano &&
    Number(log.mes) === mes &&
    Number(log.dia) === dia
  )
}

async function carregarAuditoria() {
  const usuario = document.getElementById("filtroUsuario").value.trim()
  const acao = document.getElementById("filtroAcao").value
  const dataFiltro = document.getElementById("filtroData").value
  const limite = document.getElementById("filtroLimite").value

  let path = "/auditoria?"
  if (usuario) path += `usuario=${encodeURIComponent(usuario)}&`
  if (acao) path += `acao=${encodeURIComponent(acao)}&`
  path += `limite=${encodeURIComponent(limite)}&`

  const dados = await apiFetch(path)
  if (!dados) return

  const filtrados = dados.filter(log => mesmaData(log, dataFiltro))

  const lista = document.getElementById("lista")
  lista.innerHTML = ""

  document.getElementById("totalRegistros").innerText = filtrados.length
  document.getElementById("ultimoUsuario").innerText = filtrados[0]?.usuario || "-"
  document.getElementById("ultimaAcao").innerText = filtrados[0] ? traduzirAcao(filtrados[0].acao) : "-"

  if (filtrados.length === 0) {
    lista.innerHTML = `<div class="vazio">Nenhum registro encontrado.</div>`
    return
  }

  filtrados.forEach(log => {
    lista.innerHTML += `
      <div class="card acao-${log.acao}">
        <h3>${traduzirAcao(log.acao)}</h3>
        <p><b>Usuário:</b> ${log.usuario || "-"}</p>
        <p><b>Status:</b> ${log.status || "-"}</p>
        <p><b>Data/Hora:</b> ${formatarData(log)}</p>
        <p><b>IP:</b> ${log.ip || "-"}</p>
        <p><b>User Agent:</b> ${log.user_agent || "-"}</p>
        <div class="detalhes"><b>Detalhes:</b>\n${JSON.stringify(log.detalhes || {}, null, 2)}</div>
      </div>
    `
  })
}

function limparFiltros() {
  document.getElementById("filtroUsuario").value = ""
  document.getElementById("filtroAcao").value = ""
  document.getElementById("filtroData").value = ""
  document.getElementById("filtroLimite").value = "100"
  carregarAuditoria()
}

carregarAuditoria()