function bloquearNaoSolicitante() {
  const token = sessionStorage.getItem("hr_user")

  if (!token) {
    window.location.href = "login.html"
    return false
  }

  try {
    const usuario = JSON.parse(token)

    if (!["solicitante", "admin"].includes(usuario.role)) {
      alert("Você não tem acesso ao registro de ofícios.")
      window.location.href = "menu.html"
      return false
    }

    return true
  } catch {
    sessionStorage.clear()
    window.location.href = "login.html"
    return false
  }
}

async function enviarSolicitacao(event) {
  event.preventDefault()

  const numeroOficio = document.getElementById("numeroOficio").value.trim()
  const botao = document.getElementById("btnEnviar")

  if (!numeroOficio) {
    alert("Informe o número do ofício.")
    document.getElementById("numeroOficio").focus()
    return
  }

  botao.disabled = true
  botao.textContent = "Gerando protocolo..."

  try {
    const resposta = await apiFetch("/solicitacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero_oficio: numeroOficio })
    })

    alert(
      `Protocolo criado com sucesso!\n\n` +
      `Protocolo: ${resposta.protocolo}\n` +
      `Ofício: ${resposta.numero_oficio}`
    )

    document.getElementById("numeroOficio").value = ""
    document.getElementById("numeroOficio").focus()
  } catch (erro) {
    alert(erro.message || "Não foi possível registrar o ofício.")
  } finally {
    botao.disabled = false
    botao.textContent = "Gerar protocolo"
  }
}

function voltar() {
  window.location.href = "menu.html"
}

if (bloquearNaoSolicitante()) {
  document.getElementById("formSolicitacao").addEventListener("submit", enviarSolicitacao)
  document.getElementById("numeroOficio").focus()
}
