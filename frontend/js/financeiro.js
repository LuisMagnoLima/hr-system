let dataAtual = new Date()
let docsGlobal = []
let filtroDepartamento = ""

async function carregarDados() {
  const res = await fetch("http://localhost:5000/financeiro")
  docsGlobal = await res.json()
  renderCalendario()
}

function setFiltroDepartamento() {
  filtroDepartamento = document.getElementById("filtroDepartamento").value
  renderCalendario()
}

function getUser() {
  const token = localStorage.getItem("token")
  if (!token) return "Desconhecido"

  const payload = JSON.parse(atob(token.split(".")[1]))
  return payload.email
}

function renderCalendario() {
  const calendario = document.getElementById("calendario")
  calendario.innerHTML = ""

  const mes = dataAtual.getMonth()
  const ano = dataAtual.getFullYear()

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ]

  document.getElementById("mesAno").innerText = `${meses[mes]} ${ano}`

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]

  diasSemana.forEach(d => {
    const el = document.createElement("div")
    el.className = "financeiro-dia-semana"
    el.innerText = d
    calendario.appendChild(el)
  })

  const primeiroDia = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()

  for (let i = 0; i < primeiroDia; i++) {
    const vazio = document.createElement("div")
    calendario.appendChild(vazio)
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const div = document.createElement("div")
    div.className = "financeiro-dia"
    div.innerHTML = `<b>${dia}</b>`

    const hoje = new Date()
    if (
      dia === hoje.getDate() &&
      mes === hoje.getMonth() &&
      ano === hoje.getFullYear()
    ) {
      div.style.border = "2px solid #4f6df5"
    }

    const eventos = docsGlobal.filter(d =>
      d.dia == dia &&
      d.mes == mes + 1 &&
      d.ano == ano &&
      (!filtroDepartamento || d.departamento === filtroDepartamento)
    )

    eventos.slice(0, 3).forEach(doc => {
      let cor = "financeiro-verde"
      if (doc.modulo === "notas") cor = "financeiro-azul"
      if (doc.modulo === "admissoes") cor = "financeiro-laranja"

      const confirmado = doc.confirmado_financeiro ? "financeiro-confirmado-card" : ""

      const el = document.createElement("div")
      el.className = `financeiro-evento ${cor} ${confirmado}`

      el.innerHTML = `
        <strong>${doc.nome}</strong>
        <span class="financeiro-status-texto">${doc.tipo}</span>
        ${doc.confirmado_financeiro ? `<span class="financeiro-check-mini">✅ Confirmado</span>` : ""}
      `

      el.onclick = () => abrirModal(doc)
      div.appendChild(el)
    })

    if (eventos.length > 3) {
      const mais = document.createElement("button")
      mais.className = "financeiro-mais"
      mais.type = "button"
      mais.innerText = `+${eventos.length - 3} mais`
      mais.onclick = (e) => {
        e.stopPropagation()
        abrirListaDia(eventos)
      }
      div.appendChild(mais)
    }

    calendario.appendChild(div)
  }
}

function proximoMes() {
  dataAtual.setMonth(dataAtual.getMonth() + 1)
  renderCalendario()
}

function mesAnterior() {
  dataAtual.setMonth(dataAtual.getMonth() - 1)
  renderCalendario()
}

function getCorClasse(modulo) {
  if (modulo === "notas") return "financeiro-azul"
  if (modulo === "admissoes") return "financeiro-laranja"
  return "financeiro-verde"
}

function getIcone(modulo) {
  if (modulo === "notas") return "📝"
  if (modulo === "admissoes") return "👥"
  return "📋"
}

function abrirModal(doc) {
  const modal = document.getElementById("modal")
  const body = document.getElementById("modal-body")

  const corClasse = getCorClasse(doc.modulo)
  const icone = getIcone(doc.modulo)

  body.innerHTML = `
    <div class="financeiro-card-lista">
      <div class="financeiro-card-titulo ${corClasse}">
        <span class="financeiro-card-icone">${icone}</span>
        <span>${doc.nome}</span>
      </div>

      <div class="financeiro-card-info">
        <div class="financeiro-linha-topo">
          <span class="financeiro-badge-modulo ${corClasse}">${doc.modulo}</span>
          <span class="financeiro-status-texto">${doc.tipo}</span>
        </div>

        <label class="financeiro-check">
          <input type="checkbox" ${doc.confirmado_financeiro ? "checked" : ""}
            onchange="confirmarDocumento('${doc._id}', this.checked)">
          Confirmado pelo financeiro
        </label>

        <p><b>Secretaria:</b> ${doc.departamento}</p>
        <p><b>Origem:</b> ${doc.origem || "gerenciador"}</p>
        <p><b>Protegido exclusão:</b> ${doc.protegido_exclusao ? "Sim" : "Não"}</p>
        <p><b>Confirmado por:</b> ${doc.confirmado_por || "-"}</p>
        <p><b>Enviado por:</b> ${doc.anexado_por}</p>
        <p><b>Data:</b> ${doc.dia}/${doc.mes}/${doc.ano} ${doc.hora}</p>
        <p><b>Arquivo salvo:</b> ${doc.arquivo}</p>

        <div class="financeiro-acoes">
          <a href="http://localhost:5000/files/${doc.arquivo}" target="_blank">📥 Baixar arquivo</a>
          <button class="btn-editar" onclick='abrirModalEditar(${JSON.stringify(doc)})'>✏️ Editar</button>
          <button class="btn-excluir" onclick="excluirDocumento('${doc._id}')">🗑 Excluir</button>
        </div>
      </div>
    </div>
  `

  modal.style.display = "block"
}

function abrirListaDia(eventos) {
  const modal = document.getElementById("modal")
  const body = document.getElementById("modal-body")

  const ordenados = [...eventos].sort((a, b) => {
    const horaA = a.hora || "00:00"
    const horaB = b.hora || "00:00"
    return horaA.localeCompare(horaB)
  })

  let html = `<h3 class="financeiro-modal-titulo">Arquivos do dia</h3>`

  ordenados.forEach(doc => {
    const corClasse = getCorClasse(doc.modulo)
    const icone = getIcone(doc.modulo)

    html += `
      <div class="financeiro-card-lista">
        <div class="financeiro-card-titulo ${corClasse}">
          <span class="financeiro-card-icone">${icone}</span>
          <span>${doc.nome}</span>
        </div>

        <div class="financeiro-card-info">
          <p><b>Secretaria:</b> ${doc.departamento}</p>
          <p><b>Tipo:</b> ${doc.tipo}</p>
          <p><b>Confirmado:</b> ${doc.confirmado_financeiro ? "Sim" : "Não"}</p>

          <div class="financeiro-acoes">
            <button class="btn-editar" onclick='abrirModalEditar(${JSON.stringify(doc)})'>✏️ Editar</button>
            <button class="btn-excluir" onclick="excluirDocumento('${doc._id}')">🗑 Excluir</button>
          </div>
        </div>
      </div>
    `
  })

  body.innerHTML = html
  modal.style.display = "block"
}

async function confirmarDocumento(id, confirmado) {
  const res = await fetch(`http://localhost:5000/documents/${id}/confirmar`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usuario: getUser(),
      confirmado
    })
  })

  const data = await res.json()

  if (!res.ok) {
    alert(data.error || "Erro ao confirmar documento")
    return
  }

  await carregarDados()
}

function abrirModalEditar(doc) {
  document.getElementById("editId").value = doc._id
  document.getElementById("editNome").value = doc.nome || ""
  document.getElementById("editEmbalagem").value = doc.embalagem || ""
  document.getElementById("editDepartamento").value = doc.departamento || "SAFE"
  document.getElementById("editModulo").value = doc.modulo || "notas"
  document.getElementById("editTipo").value = doc.tipo || "ativo"

  document.getElementById("modalEditar").style.display = "block"
}

function fecharModalEditar() {
  document.getElementById("modalEditar").style.display = "none"
}

async function salvarEdicao() {
  const id = document.getElementById("editId").value

  const dados = {
    usuario: getUser(),
    nome: document.getElementById("editNome").value.trim(),
    embalagem: document.getElementById("editEmbalagem").value.trim(),
    departamento: document.getElementById("editDepartamento").value,
    modulo: document.getElementById("editModulo").value,
    tipo: document.getElementById("editTipo").value
  }

  if (!dados.nome) {
    alert("Digite o nome do documento")
    return
  }

  const res = await fetch(`http://localhost:5000/documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados)
  })

  const data = await res.json()

  if (!res.ok) {
    alert(data.error || "Erro ao editar")
    return
  }

  alert("Documento editado com sucesso")
  fecharModalEditar()
  fecharModal()
  carregarDados()
}

async function excluirDocumento(id) {
  if (!confirm("Tem certeza que deseja excluir este documento?")) return

  const res = await fetch(`http://localhost:5000/documents/${id}?usuario=${encodeURIComponent(getUser())}`, {
    method: "DELETE"
  })

  const data = await res.json()

  if (!res.ok) {
    alert(data.error || "Erro ao excluir")
    return
  }

  alert("Documento excluído com sucesso")
  fecharModal()
  carregarDados()
}

function abrirModalCriar() {
  document.getElementById("modalCriar").style.display = "block"
}

function fecharModalCriar() {
  document.getElementById("modalCriar").style.display = "none"
}

function fecharModal() {
  document.getElementById("modal").style.display = "none"
}

async function uploadFinanceiro() {
  const file = document.getElementById("finFile").files[0]
  const nome = document.getElementById("finNome").value.trim()
  const embalagem = document.getElementById("finEmbalagem").value.trim()
  const departamento = document.getElementById("finDepartamento").value
  const modulo = document.getElementById("finModulo").value
  const tipo = document.getElementById("finTipo").value

  if (!file) {
    alert("Selecione um PDF")
    return
  }

  if (!nome) {
    alert("Digite o nome do documento")
    return
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("nome", nome)
  formData.append("embalagem", embalagem)
  formData.append("departamento", departamento)
  formData.append("modulo", modulo)
  formData.append("tipo", tipo)
  formData.append("usuario", getUser())

  const res = await fetch("http://localhost:5000/financeiro/upload", {
    method: "POST",
    body: formData
  })

  const data = await res.json()

  if (!res.ok) {
    alert(data.error || "Erro ao adicionar")
    return
  }

  alert("Documento financeiro adicionado com sucesso")

  document.getElementById("finNome").value = ""
  document.getElementById("finEmbalagem").value = ""
  document.getElementById("finFile").value = ""

  fecharModalCriar()
  carregarDados()
}

window.onclick = function(event) {
  const modal = document.getElementById("modal")
  const modalCriar = document.getElementById("modalCriar")
  const modalEditar = document.getElementById("modalEditar")

  if (event.target === modal) fecharModal()
  if (event.target === modalCriar) fecharModalCriar()
  if (event.target === modalEditar) fecharModalEditar()
}

carregarDados()