function getPayload() {
  const token = localStorage.getItem("token")

  if (!token) {
    window.location.href = "login.html"
    return null
  }

  try {
    return JSON.parse(atob(token.split(".")[1]))
  } catch {
    localStorage.clear()
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
  localStorage.clear()
  window.location.href = "login.html"
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

let usuariosGlobal = []
let paginaUsuarios = 1
const usuariosPorPagina = 5
let filtroUsuarioBusca = ""
let filtroUsuarioRole = ""
async function carregarUsuarios() {
  const users = await apiFetch("/admin/users")
  if (!users) return

  usuariosGlobal = users
  paginaUsuarios = 1
  renderUsuarios()
}

function filtrarUsuarios() {
  return usuariosGlobal.filter(user => {
    const email = (user.email || "").toLowerCase()
    const role = user.role || "operador"

    const bateBusca = email.includes(filtroUsuarioBusca)
    const bateRole = !filtroUsuarioRole || role === filtroUsuarioRole

    return bateBusca && bateRole
  })
}

function renderUsuarios() {
  const tbody = document.getElementById("usuariosTabela")
  const pageNumeros = document.getElementById("usuariosPageNumeros")
  const contador = document.getElementById("usuariosContador")

  if (!tbody || !pageNumeros) return

  tbody.innerHTML = ""
  pageNumeros.innerHTML = ""

  const filtrados = filtrarUsuarios()
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / usuariosPorPagina))

  if (paginaUsuarios > totalPaginas) {
    paginaUsuarios = totalPaginas
  }

  const inicio = (paginaUsuarios - 1) * usuariosPorPagina
  const fim = inicio + usuariosPorPagina
  const pagina = filtrados.slice(inicio, fim)

  if (contador) {
    contador.innerText = `${filtrados.length} usuário(s) encontrado(s)`
  }

  if (pagina.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="users-empty">
          Nenhum usuário encontrado.
        </td>
      </tr>
    `
    return
  }

  pagina.forEach(user => {
    tbody.innerHTML += `
      <tr>
        <td>${user.email}</td>
        <td><span class="role-badge role-${user.role || "operador"}">${user.role || "operador"}</span></td>
        <td>${(user.permissions || []).join(", ") || "-"}</td>
        <td>
          <button class="btn-edit-user" onclick="editarUsuario('${user._id}')">Editar</button>
          <button class="btn-pass-user" onclick="alterarSenha('${user._id}')">Senha</button>
          <button class="btn-del-user" onclick="excluirUsuario('${user._id}')">Excluir</button>
        </td>
      </tr>
    `
  })

  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement("button")
    btn.className = "user-page-num"

    if (i === paginaUsuarios) {
      btn.classList.add("active")
    }

    btn.innerText = i
    btn.onclick = () => {
      paginaUsuarios = i
      renderUsuarios()
    }

    pageNumeros.appendChild(btn)
  }
}

function filtrarUsuariosUI() {
  filtroUsuarioBusca = document.getElementById("filtroUsuarioBusca").value.toLowerCase().trim()
  filtroUsuarioRole = document.getElementById("filtroUsuarioRole").value
  paginaUsuarios = 1
  renderUsuarios()
}

function paginaUsuariosAnterior() {
  if (paginaUsuarios > 1) {
    paginaUsuarios--
    renderUsuarios()
  }
}

function proximaPaginaUsuarios() {
  const totalPaginas = Math.max(1, Math.ceil(filtrarUsuarios().length / usuariosPorPagina))

  if (paginaUsuarios < totalPaginas) {
    paginaUsuarios++
    renderUsuarios()
  }
}

function abrirModalUsuario() {
  document.getElementById("modalUsuarioTitulo").innerText = "Novo Usuário"
  document.getElementById("userId").value = ""
  document.getElementById("userEmailInput").value = ""
  document.getElementById("userSenhaInput").value = ""
  document.getElementById("userSenhaInput").disabled = false
  document.getElementById("userRoleInput").value = "operador"

  document.querySelectorAll(".permissoes-grid input").forEach(input => {
    input.checked = false
  })

  document.getElementById("modalUsuario").style.display = "flex"
}

function fecharModalUsuario() {
  document.getElementById("modalUsuario").style.display = "none"
}

function editarUsuario(id) {
  const user = usuariosGlobal.find(u => u._id === id)
  if (!user) return

  document.getElementById("modalUsuarioTitulo").innerText = "Editar Usuário"
  document.getElementById("userId").value = user._id
  document.getElementById("userEmailInput").value = user.email
  document.getElementById("userSenhaInput").value = ""
  document.getElementById("userSenhaInput").disabled = true
  document.getElementById("userRoleInput").value = user.role || "operador"

  const permissoes = user.permissions || []

  document.querySelectorAll(".permissoes-grid input").forEach(input => {
    input.checked = permissoes.includes(input.value)
  })

  document.getElementById("modalUsuario").style.display = "flex"
}

function getPermissoesSelecionadas() {
  return Array.from(document.querySelectorAll(".permissoes-grid input:checked"))
    .map(input => input.value)
}

async function salvarUsuario() {
  const id = document.getElementById("userId").value

  const dados = {
    email: document.getElementById("userEmailInput").value.trim(),
    password: document.getElementById("userSenhaInput").value,
    role: document.getElementById("userRoleInput").value,
    permissions: getPermissoesSelecionadas()
  }

  if (!dados.email) {
    alert("Informe o email")
    return
  }

  let result

  if (id) {
    delete dados.password

    result = await apiFetch(`/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    })
  } else {
    if (!dados.password) {
      alert("Informe a senha")
      return
    }

    result = await apiFetch("/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    })
  }

  if (result?.error) {
    alert(result.error)
    return
  }

  alert(result.msg || "Usuário salvo com sucesso")
  fecharModalUsuario()
  carregarUsuarios()
  carregarDashboard()
}

async function alterarSenha(id) {
  const novaSenha = prompt("Digite a nova senha:")

  if (!novaSenha) return

  const result = await apiFetch(`/admin/users/${id}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: novaSenha })
  })

  if (result?.error) {
    alert(result.error)
    return
  }

  alert("Senha alterada com sucesso")
}

async function excluirUsuario(id) {
  if (!confirm("Tem certeza que deseja excluir este usuário?")) return

  const result = await apiFetch(`/admin/users/${id}`, {
    method: "DELETE"
  })

  if (result?.error) {
    alert(result.error)
    return
  }

  alert("Usuário excluído com sucesso")
  carregarUsuarios()
  carregarDashboard()
}

carregarUsuarios()

carregarDashboard()