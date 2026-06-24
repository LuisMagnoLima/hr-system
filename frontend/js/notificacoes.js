function getPayload() {
  const token = localStorage.getItem("token")
  if (!token) {
    window.location.href = "login.html"
    return null
  }

  try {
    return JSON.parse(atob(token.split(".")[1]))
  } catch {
    window.location.href = "login.html"
    return null
  }
}

async function carregarNotificacoes() {
  const payload = getPayload()
  if (!payload) return

  const lista = document.getElementById("listaNotificacoes")
  lista.innerHTML = ""

  try {
    const dados = await apiFetch(`/solicitacoes?destinatario=${payload.email}`)

    if (!Array.isArray(dados) || dados.length === 0) {
      lista.innerHTML = "<p>Nenhuma notificação.</p>"
      return
    }

    dados.forEach(s => {
      lista.innerHTML += `
        <div class="not-card">
          <h3>${s.nome}</h3>
          <p><b>Remetente:</b> ${s.remetente}</p>
          <p><b>Departamento:</b> ${s.departamento}</p>
          <p><b>Módulo:</b> ${s.modulo}</p>
          <p><b>Tipo:</b> ${s.tipo}</p>
          <p><b>Armazenamento:</b> ${s.embalagem || "Sem embalagem"}</p>
          <p>
            <a href="http://localhost:5000/files/${s.arquivo}" target="_blank">
              Ver PDF
            </a>
          </p>
          <button onclick="processar('${s._id}')">Adicionar ao sistema</button>
        </div>
      `
    })
  } catch (err) {
    console.error("Erro ao carregar notificações:", err)
    lista.innerHTML = "<p>Erro ao carregar notificações.</p>"
  }
}

async function processar(id) {
  try {
    const data = await apiFetch(`/solicitacoes/${id}/processar`, {
      method: "POST"
    })

    if (data?.error) {
      alert(data.error)
      return
    }

    alert("Documento adicionado ao sistema com sucesso")
    carregarNotificacoes()
  } catch (err) {
    alert("Erro de conexão com o servidor")
  }
}

carregarNotificacoes()