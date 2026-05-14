let tipoAtual = "ativo"

function getPayload() {
  const token = localStorage.getItem("token")
  if (!token) {
    window.location.href = "login.html"
    return null
  }

  try {
    return JSON.parse(atob(token.split(".")[1]))
  } catch (e) {
    window.location.href = "login.html"
    return null
  }
}

function getModuloAtual() {
  return localStorage.getItem("modulo") || "notas"
}

function getDepartamentoAtual() {
  return localStorage.getItem("departamento") || "SAFE"
}

function getTemaModulo() {
  const modulo = getModuloAtual()

  if (modulo === "diarias") {
    return { cor: "#28a745", clara: "#e8f5ec" }
  }

  if (modulo === "admissoes") {
    return { cor: "#ff8c00", clara: "#fff2e2" }
  }

  return { cor: "#4f6df5", clara: "#edf2ff" }
}

function aplicarTemaModulo() {
  const tema = getTemaModulo()
  document.documentElement.style.setProperty("--cor-modulo", tema.cor)
  document.documentElement.style.setProperty("--cor-modulo-clara", tema.clara)
}

function nomeModulo(modulo) {
  if (modulo === "diarias") return "Diárias"
  if (modulo === "notas") return "Notas"
  if (modulo === "admissoes") return "Admissão e Demissão"
  return "Módulo"
}

function preencherCabecalho() {
  const modulo = getModuloAtual()
  const departamento = getDepartamentoAtual()

  document.getElementById("solTitulo").innerText =
    `${nomeModulo(modulo)} - ${departamento}`
}

function setTipo(tipo, el) {
  tipoAtual = tipo

  document.querySelectorAll(".sol-tab").forEach(btn => {
    btn.classList.remove("active")
  })

  el.classList.add("active")
  document.getElementById("tipoAtualTexto").innerText = tipo.toUpperCase()
}

async function carregarUsuariosPorPermissao() {
  const modulo = getModuloAtual()
  const select = document.getElementById("destinatario")

  select.innerHTML = `<option value="">Selecione um usuário</option>`

  try {
    const res = await fetch(`http://localhost:5000/usuarios-por-permissao?modulo=${modulo}`)
    const users = await res.json()

    users.forEach(user => {
      const option = document.createElement("option")
      option.value = user.email
      option.textContent = user.email
      select.appendChild(option)
    })
  } catch (err) {
    console.error("Erro ao carregar usuários:", err)
  }
}

async function enviarSolicitacao() {
  const payload = getPayload()
  if (!payload) return

  const destinatario = document.getElementById("destinatario").value
  const nome = document.getElementById("nome").value.trim()
  const embalagem = document.getElementById("embalagem").value.trim()
  const file = document.getElementById("file").files[0]
  const modulo = getModuloAtual()
  const departamento = getDepartamentoAtual()

  if (!destinatario) {
    alert("Selecione um usuário")
    return
  }

  if (!nome) {
    alert("Digite o nome do arquivo")
    return
  }

  if (!file) {
    alert("Selecione um PDF")
    return
  }

  const formData = new FormData()
  formData.append("remetente", payload.email)
  formData.append("destinatario", destinatario)
  formData.append("nome", nome)
  formData.append("embalagem", embalagem)
  formData.append("tipo", tipoAtual)
  formData.append("modulo", modulo)
  formData.append("departamento", departamento)
  formData.append("file", file)

  try {
    const res = await fetch("http://localhost:5000/solicitacoes", {
      method: "POST",
      body: formData
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.error || "Erro ao enviar solicitação")
      return
    }

    alert(`Solicitação enviada para ${destinatario} com sucesso!`)

    document.getElementById("destinatario").value = ""
    document.getElementById("nome").value = ""
    document.getElementById("embalagem").value = ""
    document.getElementById("file").value = ""
  } catch (err) {
    alert("Erro de conexão com o servidor")
  }
}

function voltar() {
  window.location.href = "departamentos.html"
}

aplicarTemaModulo()
preencherCabecalho()
carregarUsuariosPorPermissao()