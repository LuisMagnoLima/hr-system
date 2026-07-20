function bloquearNaoSolicitante() {
  const token = sessionStorage.getItem("hr_user")
  if (!token) {
    window.location.href = "login.html"
    return
  }

  try {
    const payload = JSON.parse(token)
    if (payload.role !== "solicitante") {
      alert("Você não tem acesso à tela de protocolo de recebimento")
      window.location.href = "menu.html"
    }
  } catch {
    sessionStorage.clear()
    window.location.href = "login.html"
  }
}

function getPayload() {
  try {
    return JSON.parse(sessionStorage.getItem("hr_user") || "null")
  } catch {
    return null
  }
}

function getModuloAtual() {
  return localStorage.getItem("modulo") || "notas"
}

function getSecretariaAtual() {
  return (localStorage.getItem("departamento") || "SAFE").toUpperCase()
}

function preencherCabecalho() {
  const secretaria = getSecretariaAtual()
  document.getElementById("solTitulo").innerText = `Protocolo de Recebimento - ${secretaria}`
  document.getElementById("secretaria").value = secretaria
}

async function carregarUsuariosPorPermissao() {
  const select = document.getElementById("destinatario")
  select.innerHTML = `<option value="">Selecione um usuário</option>`

  try {
    const users = await apiFetch(`/usuarios-por-permissao?modulo=${encodeURIComponent(getModuloAtual())}`)
    if (!Array.isArray(users)) return

    users.forEach(user => {
      const option = document.createElement("option")
      option.value = user.email
      option.textContent = user.email
      select.appendChild(option)
    })
  } catch (err) {
    console.error("Erro ao carregar usuários:", err)
    alert(err.message || "Erro ao carregar usuários")
  }
}

async function enviarSolicitacao() {
  const payload = getPayload()
  if (!payload) {
    window.location.href = "login.html"
    return
  }

  const numeroOficio = document.getElementById("numeroOficio").value.trim()
  const nomeDocumento = document.getElementById("nomeDocumento").value.trim()
  const interessado = document.getElementById("interessado").value.trim()
  const secretaria = document.getElementById("secretaria").value.trim()
  const setorDestino = document.getElementById("setorDestino").value.trim()
  const destinatario = document.getElementById("destinatario").value
  const observacao = document.getElementById("observacao").value.trim()
  const botao = document.getElementById("btnEnviar")

  if (!numeroOficio || !nomeDocumento || !secretaria || !setorDestino || !destinatario) {
    alert("Preencha o número do ofício, nome do documento, secretaria, setor e destinatário")
    return
  }

  botao.disabled = true
  botao.innerText = "Gerando protocolo..."

  try {
    const data = await apiFetch("/solicitacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero_oficio: numeroOficio,
        nome_documento: nomeDocumento,
        interessado,
        secretaria,
        setor_destino: setorDestino,
        destinatario,
        observacao,
        modulo: getModuloAtual()
      })
    })

    alert(
      `Protocolo criado com sucesso!\n\n${data.protocolo}\nSituação: ${data.situacao}\nOfício: ${numeroOficio}`
    )

    document.getElementById("numeroOficio").value = ""
    document.getElementById("nomeDocumento").value = ""
    document.getElementById("interessado").value = ""
    document.getElementById("setorDestino").value = ""
    document.getElementById("destinatario").value = ""
    document.getElementById("observacao").value = ""
    document.getElementById("numeroOficio").focus()
  } catch (err) {
    alert(err.message || "Erro de conexão com o servidor")
  } finally {
    botao.disabled = false
    botao.innerText = "Gerar protocolo e enviar para aceite"
  }
}

function voltar() {
  window.location.href = "departamentos.html"
}

bloquearNaoSolicitante()
preencherCabecalho()
carregarUsuariosPorPermissao()
document.getElementById("numeroOficio").focus()
