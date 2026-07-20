function getPayload() {
  const token = sessionStorage.getItem("hr_user")

  if (!token) {
    window.location.href = "login.html"
    return null
  }

  try {
    return JSON.parse(token)
  } catch (e) {
    sessionStorage.removeItem("hr_user")
    window.location.href = "login.html"
    return null
  }
}

function preencherUsuario(payload) {
  const userEmail = document.getElementById("userEmail")
  if (userEmail) {
    userEmail.innerText = payload.email || "Desconhecido"
  }
}

function renderMenu() {
  const payload = getPayload()
  if (!payload) return

  preencherUsuario(payload)

  const container = document.getElementById("menuCards")
  if (!container) return

  container.innerHTML = ""

  const itens = [
    {
      key: "controle_protocolos",
      titulo: "Controle de Protocolos",
      subtitulo: "Acompanhar pendentes de aceite e aceites confirmados",
      classe: "protocolos",
      somenteRecepcao: true
    },
    {
      key: "diarias",
      titulo: "Diárias",
      subtitulo: "Gerenciar diárias",
      classe: "diarias"
    },
    {
      key: "notas",
      titulo: "Notas",
      subtitulo: "Gerenciar notas",
      classe: "notas"
    },
    {
      key: "admissoes",
      titulo: "Admissão e Demissão",
      subtitulo: "Gerenciar admissões e demissões",
      classe: "admissoes"
    }
,
    {
      key: "secretarias",
      titulo: "Secretarias",
      subtitulo: "Cadastrar e organizar secretarias",
      classe: "secretarias",
      somenteAdmin: true
    }
  ]

  itens
    .filter(item => {
      if (item.somenteAdmin) return payload.role === "admin"
      if (item.somenteRecepcao) return ["solicitante", "admin"].includes(payload.role)
      return payload.permissions.includes(item.key)
    })
    .forEach(item => {
      container.innerHTML += `
        <div class="menu-card ${item.classe}" onclick="go('${item.key}')">
          <h3>${item.titulo}</h3>
          <p>${item.subtitulo}</p>
        </div>
      `
    })
}

function go(modulo) {
  if (modulo === "controle_protocolos") {
    window.location.href = "controle_protocolos.html"
    return
  }
  if (modulo === "secretarias") {
    window.location.href = "secretarias.html"
    return
  }
  localStorage.setItem("modulo", modulo)
  window.location.href = "departamentos.html"
}

function logout() {
  logoutSistema()
}

function abrirNotificacoes() {
  window.location.href = "notificacoes.html"
}

let verificacaoNotificacoesEmAndamento = false
let timerBadgeNotificacoes = null

async function verificarNotificacoes() {
  if (verificacaoNotificacoesEmAndamento || document.hidden) return

  const payload = getPayload()
  if (!payload) return

  const badge = document.getElementById("notificationCount")
  if (!badge) return

  verificacaoNotificacoesEmAndamento = true

  try {
    const dados = await apiFetch(`/solicitacoes?destinatario=${encodeURIComponent(payload.email)}`)

    if (Array.isArray(dados) && dados.length > 0) {
      badge.style.display = "inline-flex"
      badge.innerText = dados.length
    } else {
      badge.style.display = "none"
      badge.innerText = "0"
    }
  } catch (err) {
    console.error("Erro ao verificar notificações:", err)
    badge.style.display = "none"
  } finally {
    verificacaoNotificacoesEmAndamento = false
  }
}

function agendarVerificacaoNotificacoes() {
  clearTimeout(timerBadgeNotificacoes)

  if (document.hidden) return

  timerBadgeNotificacoes = setTimeout(async () => {
    await verificarNotificacoes()
    agendarVerificacaoNotificacoes()
  }, 15000)
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(timerBadgeNotificacoes)
    return
  }

  verificarNotificacoes()
  agendarVerificacaoNotificacoes()
})

renderMenu()
verificarNotificacoes()
agendarVerificacaoNotificacoes()