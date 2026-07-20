let departamentos = []


function getModuloAtual() {
  return localStorage.getItem("modulo") || "notas"
}

function getMenuNome(modulo) {
  if (modulo === "diarias") return "Diárias"
  if (modulo === "admissoes") return "Admissão e Demissão"
  return "Notas"
}

function getTemaModulo() {
  const modulo = getModuloAtual()

  if (modulo === "diarias") {
    return "#28a745"
  }

  if (modulo === "admissoes") {
    return "#ff8c00"
  }

  return "#4f6df5"
}

function aplicarTemaModulo() {
  document.documentElement.style.setProperty("--cor-modulo", getTemaModulo())
}

function getUserEmail() {
  const token = sessionStorage.getItem("hr_user")
  if (!token) return "Desconhecido"

  try {
    const payload = JSON.parse(token)
    return payload.email || "Desconhecido"
  } catch {
    return "Desconhecido"
  }
}

function preencherCabecalho() {
  const modulo = getModuloAtual()
  const menuNome = getMenuNome(modulo)

  document.getElementById("menuEscolhidoLateral").innerText = menuNome
  document.getElementById("menuEscolhidoTitulo").innerText = `${menuNome} - Secretarias`
  document.getElementById("userEmail").innerText = getUserEmail()
}

async function carregarDepartamentos() {
  try {
    departamentos = await apiFetch("/secretarias")
    renderDepartamentos()
  } catch (erro) {
    alert(erro.message)
  }
}

function renderDepartamentos() {
  const container = document.getElementById("deps")
  container.innerHTML = ""

  departamentos.forEach(dep => {
    container.innerHTML += `
      <div class="deps-card" onclick="selectDep('${dep.sigla}')">
        <h3>${dep.sigla}</h3>
        <p>${dep.nome}</p>
      </div>
    `
  })
}

function getPayload() {
  const token = sessionStorage.getItem("hr_user")
  if (!token) return null

  try {
    return JSON.parse(token)
  } catch {
    return null
  }
}

function selectDep(dep) {
  localStorage.setItem("departamento", dep)

  const payload = getPayload()

  if (payload && payload.role === "solicitante") {
    window.location.href = "solicitacao.html"
  } else {
    window.location.href = "gerenciador.html"
  }
}

function voltarMenu() {
  window.location.href = "menu.html"
}

aplicarTemaModulo()
preencherCabecalho()
carregarDepartamentos()