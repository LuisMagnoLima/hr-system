const departamentos = ["AGERP", "ITERMA", "SAF", "SEDES", "SEGOV"]

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
  const token = localStorage.getItem("token")
  if (!token) return "Desconhecido"

  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
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

function renderDepartamentos() {
  const container = document.getElementById("deps")
  container.innerHTML = ""

  departamentos.forEach(dep => {
    container.innerHTML += `
      <div class="deps-card" onclick="selectDep('${dep}')">
        <h3>${dep}</h3>
        <p>Secretaria ${dep}</p>
      </div>
    `
  })
}

function getPayload() {
  const token = localStorage.getItem("token")
  if (!token) return null

  try {
    return JSON.parse(atob(token.split(".")[1]))
  } catch {
    return null
  }
}

function getPayload() {
  const token = localStorage.getItem("token")
  if (!token) return null

  try {
    return JSON.parse(atob(token.split(".")[1]))
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
renderDepartamentos()