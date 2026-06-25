function getPayload() {
  const token = localStorage.getItem("token")

  if (!token) {
    window.location.href = "login.html"
    return null
  }

  try {
    return JSON.parse(atob(token.split(".")[1]))
  } catch (e) {
    localStorage.removeItem("token")
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
  ]

  itens
    .filter(item => payload.permissions.includes(item.key))
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
  localStorage.setItem("modulo", modulo)
  window.location.href = "departamentos.html"
}

function logout() {
  localStorage.removeItem("token")
  localStorage.removeItem("modulo")
  localStorage.removeItem("departamento")
  window.location.href = "login.html"
}

function abrirNotificacoes() {
  window.location.href = "notificacoes.html"
}

async function verificarNotificacoes() {
  const payload = getPayload()
  if (!payload) return

  const badge = document.getElementById("notificationCount")
  if (!badge) return

  try {
    const dados = await apiFetch(`/solicitacoes?destinatario=${payload.email}`)

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
  }
}



renderMenu()
verificarNotificacoes()
// Verifica notificações a cada 5 segundos
setInterval(verificarNotificacoes, 5000)