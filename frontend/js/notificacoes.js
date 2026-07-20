function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function getPayload() {
  const token = sessionStorage.getItem("hr_user")
  if (!token) {
    window.location.href = "login.html"
    return null
  }

  try {
    return JSON.parse(token)
  } catch {
    window.location.href = "login.html"
    return null
  }
}

function formatarData(dataIso) {
  if (!dataIso) return "Não informado"
  const data = new Date(dataIso)
  if (Number.isNaN(data.getTime())) return "Não informado"
  return data.toLocaleString("pt-BR")
}

let notificacoesCarregando = false
let assinaturaNotificacoes = null
let timerNotificacoes = null

async function carregarNotificacoes({ exibirCarregamento = false } = {}) {
  if (notificacoesCarregando || document.hidden) return

  const payload = getPayload()
  if (!payload) return

  const lista = document.getElementById("listaNotificacoes")
  if (!lista) return

  notificacoesCarregando = true

  if (exibirCarregamento) {
    lista.innerHTML = '<p class="not-loading">Carregando protocolos pendentes...</p>'
  }

  try {
    const dados = await apiFetch(`/solicitacoes?destinatario=${encodeURIComponent(payload.email)}`)

    const itens = Array.isArray(dados) ? dados : []
    const novaAssinatura = JSON.stringify(itens.map(item => [
      item._id,
      item.situacao,
      item.numero_oficio,
      item.protocolo,
      item.criado_em
    ]))

    // Evita reconstruir a tela quando nada mudou.
    if (novaAssinatura === assinaturaNotificacoes) return
    assinaturaNotificacoes = novaAssinatura

    if (itens.length === 0) {
      lista.innerHTML = `
        <div class="not-empty">
          <h2>Nenhum protocolo pendente de aceite</h2>
          <p>Você não possui documentos aguardando confirmação de recebimento.</p>
        </div>
      `
      return
    }

    lista.innerHTML = ""

    itens.forEach(s => {
      const card = document.createElement("article")
      card.className = "not-card"
      card.innerHTML = `
        <div class="not-card-topo">
          <span class="not-status">PENDENTE DE ACEITE</span>
          <span class="not-protocolo">${escaparHtml(s.protocolo || "Sem protocolo")}</span>
        </div>

        <div class="not-oficio-box">
          <span>NÚMERO DO OFÍCIO</span>
          <strong>${escaparHtml(s.numero_oficio || "Não informado")}</strong>
        </div>

        <h3>${escaparHtml(s.nome_documento || s.nome || "Documento sem identificação")}</h3>
        <div class="not-grid">
          <p><b>Encaminhado por:</b> ${escaparHtml(s.remetente)}</p>
          <p><b>Secretaria:</b> ${escaparHtml(s.secretaria || s.departamento)}</p>
          <p><b>Setor de destino:</b> ${escaparHtml(s.setor_destino || "Não informado")}</p>
          <p><b>Interessado:</b> ${escaparHtml(s.interessado || "Não informado")}</p>
          <p><b>Data do encaminhamento:</b> ${escaparHtml(formatarData(s.criado_em))}</p>
          <p><b>Observação:</b> ${escaparHtml(s.observacao || "Sem observação")}</p>
        </div>

        <div class="not-confirmacao">
          Ao confirmar, seu usuário, a data e a hora serão registrados na auditoria.
        </div>

        <div class="not-acoes">
          <button class="not-confirmar" onclick="confirmarRecebimento('${s._id}', '${escaparHtml(s.numero_oficio || "")}')">Confirmar Recebimento</button>
          <button class="not-recusar" onclick="recusarRecebimento('${s._id}', '${escaparHtml(s.numero_oficio || "")}')">Recusar Recebimento</button>
        </div>
      `
      lista.appendChild(card)
    })
  } catch (err) {
    console.error("Erro ao carregar notificações:", err)
    // Mantém as notificações já exibidas durante falhas temporárias.
    if (exibirCarregamento || assinaturaNotificacoes === null) {
      lista.innerHTML = `<p class="not-erro">${escaparHtml(err.message || "Erro ao carregar notificações")}</p>`
    }
  } finally {
    notificacoesCarregando = false
  }
}

async function confirmarRecebimento(id, numeroOficio) {
  const confirmado = window.confirm(
    `Confirma o recebimento físico do ofício ${numeroOficio || "informado"}?\n\nEsta ação ficará registrada na auditoria.`
  )

  if (!confirmado) return

  try {
    const data = await apiFetch(`/solicitacoes/${id}/confirmar-recebimento`, {
      method: "POST"
    })

    alert(
      `Recebimento confirmado!\n\nOfício: ${data.numero_oficio}\nProtocolo: ${data.protocolo}\nSituação: ${data.situacao}`
    )
    assinaturaNotificacoes = null
    carregarNotificacoes()
  } catch (err) {
    alert(err.message || "Erro ao confirmar recebimento")
  }
}

function agendarAtualizacaoNotificacoes() {
  clearTimeout(timerNotificacoes)

  if (document.hidden) return

  timerNotificacoes = setTimeout(async () => {
    await carregarNotificacoes()
    agendarAtualizacaoNotificacoes()
  }, 15000)
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(timerNotificacoes)
    return
  }

  carregarNotificacoes()
  agendarAtualizacaoNotificacoes()
})

carregarNotificacoes({ exibirCarregamento: true })
agendarAtualizacaoNotificacoes()


async function recusarRecebimento(id, numeroOficio) {
  const justificativa = window.prompt(
    `Informe o motivo da recusa do ofício ${numeroOficio || "informado"}:`
  )
  if (justificativa === null) return
  if (justificativa.trim().length < 5) {
    alert("A justificativa precisa ter pelo menos 5 caracteres.")
    return
  }
  if (!window.confirm("Confirma a recusa? O protocolo voltará para a recepção.")) return

  try {
    const data = await apiFetch(`/solicitacoes/${id}/recusar`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ justificativa: justificativa.trim() })
    })
    alert(`${data.msg}\n\nProtocolo: ${data.protocolo}\nSituação: ${data.situacao}`)
    assinaturaNotificacoes = null
    carregarNotificacoes()
  } catch (err) {
    alert(err.message || "Erro ao recusar recebimento")
  }
}
