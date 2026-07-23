let dataAtual = new Date()
let docsGlobal = []
let filtroDepartamento = ""

async function carregarDados() {
  docsGlobal = await apiFetch("/financeiro")
  renderCalendario()
}

function setFiltroDepartamento() {
  filtroDepartamento = document.getElementById("filtroDepartamento").value
  renderCalendario()
}

function getUser() {
  const token = sessionStorage.getItem("hr_user")
  if (!token) return "Desconhecido"
  const payload = JSON.parse(token)
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
    calendario.appendChild(document.createElement("div"))
  }

const busca = (document.getElementById("buscaFinanceiro")?.value || "")
  .toLowerCase()
  .trim()

// 🌎 Total Geral
const docsGerais = docsGlobal.filter(d => {
  const texto =
    `${d.nome || ""} ${d.departamento || ""} ${d.anexado_por || ""}`
      .toLowerCase()

  const bateDepartamento =
    !filtroDepartamento || d.departamento === filtroDepartamento

  return bateDepartamento && texto.includes(busca)
})

// 📅 Apenas mês atual
const docsDoMes = docsGerais.filter(d =>
  Number(d.mes) === mes + 1 &&
  Number(d.ano) === ano
)

document.getElementById("resumoPeriodo").innerText =
  `${meses[mes]} / ${ano}`

document.getElementById("resumoTotalGeral").innerText =
  docsGerais.length

document.getElementById("resumoTotalMes").innerText =
  docsDoMes.length

document.getElementById("resumoPendentes").innerText =
  docsDoMes.filter(d => !d.confirmado_financeiro).length

document.getElementById("resumoConfirmados").innerText =
  docsDoMes.filter(d => d.confirmado_financeiro).length

// Continue usando docsDoMes para desenhar os eventos do calendário
const docsFiltrados = docsDoMes

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const div = document.createElement("div")
    div.className = "financeiro-dia"
    div.innerHTML = `<b>${dia}</b>`

    const hoje = new Date()
    if (dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear()) {
      div.style.border = "2px solid #4f6df5"
    }

   const eventos = docsFiltrados.filter(d =>
    d.dia == dia &&
    d.mes == mes + 1 &&
    d.ano == ano
  )

    eventos.slice(0, 3).forEach(doc => {
      const cor = getCorClasse(doc.modulo)
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
      mais.onclick = e => {
        e.stopPropagation()
        abrirListaDia(eventos)
      }
      div.appendChild(mais)
    }

    calendario.appendChild(div)
  }
}

function voltarLogin() {
  logoutSistema()
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
          <button
  class="btn-download"
  onclick="abrirPdfFinanceiro('${doc._id}')">
  👁 Abrir PDF
</button>
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

  let html = `
    <h3 class="financeiro-modal-titulo">Arquivos do dia</h3>
    <p class="financeiro-modal-subtitulo">
      Clique em um documento para abrir os detalhes e confirmar.
    </p>
  `

  ordenados.forEach(doc => {
    const corClasse = getCorClasse(doc.modulo)
    const icone = getIcone(doc.modulo)

    html += `
      <div class="financeiro-card-lista financeiro-card-click"
           onclick='abrirModal(${JSON.stringify(doc)})'>

        <div class="financeiro-card-titulo ${corClasse}">
          <span class="financeiro-card-icone">${icone}</span>
          <span>${doc.nome}</span>
        </div>

        <div class="financeiro-card-info">
          <p><b>Secretaria:</b> ${doc.departamento}</p>
          <p><b>Tipo:</b> ${doc.tipo}</p>
          <p><b>Confirmado:</b> ${doc.confirmado_financeiro ? "✅ Sim" : "⬜ Não"}</p>

          <span class="financeiro-abrir-detalhes">
            Abrir detalhes →
          </span>
        </div>
      </div>
    `
  })

  body.innerHTML = html
  modal.style.display = "block"
}


async function confirmarDocumento(id, confirmado) {
  const data = await apiFetch(`/documents/${id}/confirmar`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usuario: getUser(),
      confirmado
    })
  })

  if (data?.error) {
    alert(data.error)
    return
  }

  await carregarDados()
}

function abrirModalEditar(doc) {
  document.getElementById("editId").value = doc._id
  document.getElementById("editNome").value = doc.nome || ""
  document.getElementById("editObservação").value = doc.observacao || ""
  document.getElementById("editDepartamento").value = doc.departamento || "SAFE"
  document.getElementById("editModulo").value = doc.modulo || "notas"
  document.getElementById("editTipo").value = doc.tipo || "ativo"

  document.getElementById("modalEditar").style.display = "block"
}

function fecharModalEditar() {
  document.getElementById("modalEditar").style.display = "none"
}

async function baixarArquivo(filename) {
  const token = sessionStorage.getItem("hr_user");

  const response = await fetch(`${API_URL}/files/${filename}`, { credentials: "include" });

  if (!response.ok) {
    const erro = await response.json().catch(() => ({}));
    alert(erro.error || "Erro ao baixar o arquivo.");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}



let pdfFinanceiroAtual = null

async function abrirPdfFinanceiro(id) {
  const doc = docsGlobal.find(item => item._id === id)
  const modal = document.getElementById("modalPdfFinanceiro")
  const viewer = document.getElementById("viewerPdfFinanceiro")
  const titulo = document.getElementById("tituloPdfFinanceiro")

  if (!modal || !viewer) return

  try {
    const response = await fetch(`${API_URL}/documents/${id}/pdf`, {
      credentials: "include"
    })

    if (!response.ok) {
      const erro = await response.json().catch(() => ({}))
      alert(erro.error || "Não foi possível abrir o PDF")
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    fecharPdfFinanceiro()

    pdfFinanceiroAtual = {
      url,
      nome: doc?.arquivo_nome || doc?.nome_original || doc?.arquivo || "documento.pdf"
    }

    if (titulo) {
      titulo.innerText = doc?.nome || "Visualizar PDF"
    }

    viewer.src = url
    modal.style.display = "block"
  } catch (error) {
    console.error(error)
    alert("Erro de conexão ao carregar o PDF")
  }
}

function fecharPdfFinanceiro() {
  const modal = document.getElementById("modalPdfFinanceiro")
  const viewer = document.getElementById("viewerPdfFinanceiro")

  if (viewer) viewer.src = ""

  if (pdfFinanceiroAtual?.url) {
    URL.revokeObjectURL(pdfFinanceiroAtual.url)
  }

  pdfFinanceiroAtual = null

  if (modal) modal.style.display = "none"
}

function baixarPdfFinanceiroAtual() {
  if (!pdfFinanceiroAtual) return

  const link = document.createElement("a")
  link.href = pdfFinanceiroAtual.url
  link.download = pdfFinanceiroAtual.nome
  document.body.appendChild(link)
  link.click()
  link.remove()
}


async function salvarEdicao() {
  const id = document.getElementById("editId").value

  const dados = {
    usuario: getUser(),
    nome: document.getElementById("editNome").value.trim(),
    observacao: document.getElementById("editObservação").value.trim(),
    departamento: document.getElementById("editDepartamento").value,
    modulo: document.getElementById("editModulo").value,
    tipo: document.getElementById("editTipo").value
  }

  if (!dados.nome) {
    alert("Digite o nome do documento")
    return
  }

  const data = await apiFetch(`/documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados)
  })

  if (data?.error) {
    alert(data.error)
    return
  }

  alert("Documento editado com sucesso")
  fecharModalEditar()
  fecharModal()
  carregarDados()
}

async function excluirDocumento(id) {
  if (!confirm("Deseja mover este documento para Arquivados? Ele ficará lá por 6 meses.")) return

  const data = await apiFetch(`/documents/${id}?usuario=${encodeURIComponent(getUser())}`, {
    method: "DELETE"
  })

  if (data?.error) {
    alert(data.error)
    return
  }

  alert(data?.msg || "Documento movido para Arquivados")
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
  const observacao = document.getElementById("finObservação").value.trim()
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
  formData.append("observacao", observacao)
  formData.append("departamento", departamento)
  formData.append("modulo", modulo)
  formData.append("tipo", tipo)
  formData.append("usuario", getUser())

  const data = await apiFetch("/financeiro/upload", {
    method: "POST",
    body: formData
  })

  if (data?.error) {
    alert(data.error)
    return
  }

  alert("Documento financeiro adicionado com sucesso")

  document.getElementById("finNome").value = ""
  document.getElementById("finObservação").value = ""
  document.getElementById("finFile").value = ""

  fecharModalCriar()
  carregarDados()
}

window.onclick = function(event) {
  const modal = document.getElementById("modal")
  const modalCriar = document.getElementById("modalCriar")
  const modalEditar = document.getElementById("modalEditar")
  const modalPdf = document.getElementById("modalPdfFinanceiro")

  if (event.target === modal) fecharModal()
  if (event.target === modalCriar) fecharModalCriar()
  if (event.target === modalEditar) fecharModalEditar()
  if (event.target === modalPdf) fecharPdfFinanceiro()
}

async function carregarSecretariasFinanceiro() {
  const secretarias = await apiFetch("/secretarias")
  const selects = [
    { id: "filtroDepartamento", manterTodas: true },
    { id: "finDepartamento", manterTodas: false },
    { id: "editDepartamento", manterTodas: false }
  ]

  selects.forEach(config => {
    const select = document.getElementById(config.id)
    if (!select) return
    const valorAtual = select.value
    select.innerHTML = config.manterTodas ? '<option value="">Todas as secretarias</option>' : ""
    secretarias.forEach(secretaria => {
      const option = document.createElement("option")
      option.value = secretaria.sigla
      option.textContent = `${secretaria.sigla} - ${secretaria.nome}`
      select.appendChild(option)
    })
    if ([...select.options].some(option => option.value === valorAtual)) select.value = valorAtual
  })
}

;(async () => { await carregarSecretariasFinanceiro(); await carregarDados() })()


document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") {
    fecharPdfFinanceiro()
  }
})
