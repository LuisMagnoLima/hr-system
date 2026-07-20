function getPayload() {
  const token = sessionStorage.getItem("hr_user")

  if (!token) {
    window.location = "login.html"
    return null
  }

  try {
    return JSON.parse(token)
  } catch (e) {
    console.error("Token inválido")
    sessionStorage.removeItem("hr_user")
    window.location = "login.html"
    return null
  }
}

function renderMenu() {
  const payload = getPayload()
  if (!payload) return

  const menu = document.getElementById("menu")
  menu.innerHTML = ""

  // 🟢 DIÁRIAS
  if (payload.permissions.includes("diarias")) {
    menu.innerHTML += `
      <div class="menu-item diarias" onclick="go('diarias')">
        📋 Diárias
      </div>
    `
  }

  // 🔵 NOTAS
  if (payload.permissions.includes("notas")) {
    menu.innerHTML += `
      <div class="menu-item notas" onclick="go('notas')">
        📝 Notas
      </div>
    `
  }

  // 🟠 ADMISSÃO
  if (payload.permissions.includes("admissoes")) {
    menu.innerHTML += `
      <div class="menu-item admissao" onclick="go('admissoes')">
        👥 Admissão/Demissão
      </div>
    `
  }
}

function go(modulo) {
  localStorage.setItem("modulo", modulo)
  window.location.href = "./departamentos.html"
}

// 🚀 iniciar
renderMenu()