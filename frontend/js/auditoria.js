let paginaAtual = 1

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
  }

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

function escaparHtml(valor) {
  return String(valor ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

async function carregarAuditoria(pagina = 1) {
  paginaAtual = pagina

  const usuario = document.getElementById("filtroUsuario").value.trim()
  const acao = document.getElementById("filtroAcao").value
  const data = document.getElementById("filtroData").value
  const limite = document.getElementById("filtroLimite").value

  const params = new URLSearchParams({ pagina: String(paginaAtual), limite })
  if (usuario) params.set("usuario", usuario)
  if (acao) params.set("acao", acao)
  if (data) params.set("data", data)

  const dados = await apiFetch(`/auditoria?${params.toString()}`)
  if (!dados) return

  paginaAtual = dados.pagina
  renderizarResumo(dados)
  renderizarLogs(dados.logs)
  renderizarPaginacao(dados)
}

function renderizarResumo(dados) {
  const logs = dados.logs || []
  document.getElementById("totalRegistros").innerText = dados.total
  document.getElementById("ultimoUsuario").innerText = logs[0]?.usuario || "-"
  document.getElementById("ultimaAcao").innerText = logs[0] ? traduzirAcao(logs[0].acao) : "-"

  document.getElementById("faixaRegistros").innerText = dados.total
    ? `Mostrando ${dados.inicio}–${dados.fim} de ${dados.total} registros`
    : "Nenhum registro encontrado"

  document.getElementById("paginaAtualTexto").innerText = dados.limite === 0
    ? "Todos os registros"
    : `Página ${dados.pagina} de ${dados.total_paginas}`
}

function renderizarLogs(logs) {
  const lista = document.getElementById("lista")
  lista.innerHTML = ""

  if (!logs || logs.length === 0) {
    lista.innerHTML = `<div class="vazio">Nenhum registro encontrado.</div>`
    return
  }

  lista.innerHTML = logs.map(log => `
    <article class="card acao-${escaparHtml(log.acao)}">
      <div class="card-cabecalho">
        <h3>${escaparHtml(traduzirAcao(log.acao))}</h3>
        <time>${escaparHtml(formatarData(log))}</time>
      </div>
      <div class="card-info">
        <span><b>Usuário:</b> ${escaparHtml(log.usuario)}</span>
        <span><b>Status:</b> ${escaparHtml(log.status)}</span>
        <span><b>IP:</b> ${escaparHtml(log.ip)}</span>
      </div>
      <details>
        <summary>Ver detalhes</summary>
        <div class="detalhes"><b>User Agent:</b> ${escaparHtml(log.user_agent)}\n\n<b>Detalhes:</b>\n${escaparHtml(JSON.stringify(log.detalhes || {}, null, 2))}</div>
      </details>
    </article>
  `).join("")
}

function paginasVisiveis(atual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const paginas = new Set([1, total, atual - 2, atual - 1, atual, atual + 1, atual + 2])
  return [...paginas].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
}

function criarPaginacao(dados) {
  if (dados.limite === 0 || dados.total_paginas <= 1) return ""

  const paginas = paginasVisiveis(dados.pagina, dados.total_paginas)
  let anterior = 0
  let html = `<button ${dados.pagina === 1 ? "disabled" : ""} onclick="carregarAuditoria(${dados.pagina - 1})" aria-label="Página anterior">‹</button>`

  paginas.forEach(numero => {
    if (anterior && numero - anterior > 1) html += `<span class="reticencias">…</span>`
    html += `<button class="${numero === dados.pagina ? "ativo" : ""}" onclick="carregarAuditoria(${numero})">${numero}</button>`
    anterior = numero
  })

  html += `<button ${dados.pagina === dados.total_paginas ? "disabled" : ""} onclick="carregarAuditoria(${dados.pagina + 1})" aria-label="Próxima página">›</button>`
  return html
}

function renderizarPaginacao(dados) {
  const html = criarPaginacao(dados)
  document.getElementById("paginacaoTopo").innerHTML = html
  document.getElementById("paginacaoRodape").innerHTML = html
}

function limparFiltros() {
  document.getElementById("filtroUsuario").value = ""
  document.getElementById("filtroAcao").value = ""
  document.getElementById("filtroData").value = ""
  document.getElementById("filtroLimite").value = "100"
  carregarAuditoria(1)
}

document.getElementById("filtroLimite").addEventListener("change", () => carregarAuditoria(1))
carregarAuditoria(1)
