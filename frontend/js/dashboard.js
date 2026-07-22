function getPayload() {
  const token = sessionStorage.getItem("hr_user")

  if (!token) {
    window.location.href = "login.html"
    return null
  }

  try {
    return JSON.parse(token)
  } catch {
    sessionStorage.clear()
    window.location.href = "login.html"
    return null
  }
}

function protegerAdmin() {
  const payload = getPayload()

  if (!payload) return

  if (payload.role !== "admin") {
    alert("Você não tem acesso à dashboard")
    window.location.href = "menu.html"
  }
}

function irUsuarios() {
  window.location.href = "gestao_usuarios.html"
}

function irBanco() {
  window.location.href = "banco_dados.html"
}

function irAuditoria() {
  window.location.href = "auditoria.html"
}

function irFinanceiro() {
  window.location.href = "financeiro.html"
}

function logout() {
  logoutSistema()
}

function formatarAcao(acao) {
  const mapa = {
    login_sucesso: "Login realizado",
    login_falhou: "Falha no login",
    upload_documento: "Upload de documento",
    upload_financeiro: "Upload financeiro",
    editar_documento_financeiro: "Edição de documento",
    delete_documento_financeiro: "Exclusão de documento",
    confirmar_documento_financeiro: "Confirmação financeira",
    criar_solicitacao: "Solicitação criada",
    processar_solicitacao: "Solicitação processada"
  }

  return mapa[acao] || acao
}

async function carregarDashboard() {
  protegerAdmin()

  const dados = await apiFetch("/dashboard")
  if (!dados) return

  document.getElementById("totalDocumentos").innerText = dados.total_documentos
  document.getElementById("documentosMes").innerText = dados.documentos_mes
  document.getElementById("pendentes").innerText = dados.pendentes
  document.getElementById("confirmados").innerText = dados.confirmados
  document.getElementById("usuarios").innerText = dados.total_usuarios

  renderChartSecretarias(dados.por_secretaria)
  renderChartModulos(dados.por_modulo)
  renderChartMeses(dados.por_mes)
  renderUltimasAcoes(dados.ultimas_acoes)
}

function renderChartSecretarias(dados) {
  const labels = dados.map(i => i.nome)
  const valores = dados.map(i => i.total)

  new Chart(document.getElementById("chartSecretarias"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Documentos",
        data: valores
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  })
}

function renderChartModulos(dados) {
  const labels = dados.map(i => i.nome)
  const valores = dados.map(i => i.total)

  new Chart(document.getElementById("chartModulos"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: valores
      }]
    },
    options: {
      responsive: true
    }
  })
}

function renderChartMeses(dados) {
  const labels = dados.map(i => i.nome)
  const valores = dados.map(i => i.total)

  new Chart(document.getElementById("chartMeses"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Documentos",
        data: valores,
        tension: 0.35
      }]
    },
    options: {
      responsive: true
    }
  })
}

function renderUltimasAcoes(acoes) {
  const container = document.getElementById("ultimasAcoes")
  container.innerHTML = ""

  if (!acoes || acoes.length === 0) {
    container.innerHTML = "<p>Nenhuma ação registrada.</p>"
    return
  }

  acoes.forEach(log => {
    container.innerHTML += `
      <div class="acao-item">
        <strong>${formatarAcao(log.acao)}</strong>
        <small>${log.usuario || "-"} • ${log.dia || "--"}/${log.mes || "--"}/${log.ano || "----"} ${log.hora || ""}</small>
      </div>
    `
  })
}


carregarDashboard()
