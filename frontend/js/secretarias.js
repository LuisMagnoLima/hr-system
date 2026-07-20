let secretarias = []

function escapar(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

async function garantirAdmin() {
  const usuario = await requireCurrentUser()
  if (!usuario) return false
  if (usuario.role !== "admin") {
    alert("Apenas administradores podem gerenciar secretarias.")
    window.location.href = "menu.html"
    return false
  }
  return true
}

async function carregarSecretarias() {
  try {
    secretarias = await apiFetch("/secretarias?incluir_inativas=true")
    renderizar()
  } catch (erro) {
    alert(erro.message)
  }
}

function renderizar() {
  const corpo = document.getElementById("secretariasBody")
  const vazio = document.getElementById("estadoVazio")
  const busca = document.getElementById("busca").value.trim().toLowerCase()
  const status = document.getElementById("filtroStatus").value

  const filtradas = secretarias.filter(item => {
    const texto = `${item.sigla} ${item.nome}`.toLowerCase()
    const bateBusca = texto.includes(busca)
    const bateStatus = status === "todas" || (status === "ativas" && item.ativa) || (status === "inativas" && !item.ativa)
    return bateBusca && bateStatus
  })

  corpo.innerHTML = filtradas.map(item => `
    <tr>
      <td><strong>${escapar(item.sigla)}</strong></td>
      <td>${escapar(item.nome)}</td>
      <td><span class="badge ${item.ativa ? "ativa" : "inativa"}">${item.ativa ? "Ativa" : "Inativa"}</span></td>
      <td class="actions">
        <button onclick="editarSecretaria('${item._id}')">Editar</button>
        <button class="danger" onclick="excluirSecretaria('${item._id}')">Excluir</button>
      </td>
    </tr>
  `).join("")

  vazio.hidden = filtradas.length > 0
}

function abrirModal(item = null) {
  document.getElementById("modalTitulo").innerText = item ? "Editar secretaria" : "Nova secretaria"
  document.getElementById("secretariaId").value = item?._id || ""
  document.getElementById("sigla").value = item?.sigla || ""
  document.getElementById("nome").value = item?.nome || ""
  document.getElementById("ativa").checked = item ? Boolean(item.ativa) : true
  document.getElementById("modal").hidden = false
  document.getElementById("sigla").focus()
}

function fecharModal() {
  document.getElementById("modal").hidden = true
}

function editarSecretaria(id) {
  abrirModal(secretarias.find(item => item._id === id))
}

async function salvarSecretaria() {
  const id = document.getElementById("secretariaId").value
  const dados = {
    sigla: document.getElementById("sigla").value.trim().toUpperCase(),
    nome: document.getElementById("nome").value.trim(),
    ativa: document.getElementById("ativa").checked
  }

  if (!dados.sigla || !dados.nome) {
    alert("Preencha a sigla e o nome.")
    return
  }

  try {
    await apiFetch(id ? `/admin/secretarias/${id}` : "/admin/secretarias", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    })
    fecharModal()
    await carregarSecretarias()
  } catch (erro) {
    alert(erro.message)
  }
}

async function excluirSecretaria(id) {
  const item = secretarias.find(sec => sec._id === id)
  if (!item || !confirm(`Excluir a secretaria ${item.sigla}?`)) return

  try {
    await apiFetch(`/admin/secretarias/${id}`, { method: "DELETE" })
    await carregarSecretarias()
  } catch (erro) {
    alert(erro.message)
  }
}

;(async () => {
  if (await garantirAdmin()) await carregarSecretarias()
})()
