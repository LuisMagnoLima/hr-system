let docsGlobal = []
let filtroModuloAtual = ""
let paginaAtual = 1
const itensPorPagina = 8

function getPayload() {
  const token = sessionStorage.getItem("hr_user")
  if (!token) {
    window.location.href = "login.html"
    return null
  }

  try {
    return JSON.parse(token)
  } catch (e) {
    window.location.href = "login.html"
    return null
  }
}

function preencherUsuario() {
  const payload = getPayload()
  if (!payload) return

  const usuario = document.getElementById("usuarioLogado")
  usuario.innerText = payload.email || "USUÁRIO"
}

function voltar() {
  window.location.href = "menu.html"
}

function atualizarDados() {
  carregarDados()
}

function aoFiltrar() {
  paginaAtual = 1
  renderTabela()
}

function setFiltroModulo(modulo, el) {
  filtroModuloAtual = modulo
  paginaAtual = 1

  document.querySelectorAll(".bd-tab").forEach(btn => {
    btn.classList.remove("active")
  })

  el.classList.add("active")
  renderTabela()
}

function nomeModulo(modulo) {
  if (modulo === "diarias") return "Diárias"
  if (modulo === "notas") return "Notas"
  if (modulo === "admissoes") return "Admissão/Demissão"
  return modulo || "-"
}

function classeModulo(modulo) {
  if (modulo === "diarias") return "bd-diarias"
  if (modulo === "notas") return "bd-notas"
  if (modulo === "admissoes") return "bd-admissoes"
  return ""
}

async function carregarDados() {
  try {
    docsGlobal = await apiFetch("/financeiro")
    paginaAtual = 1
    renderTabela()
  } catch (err) {
    console.error("Erro ao carregar dados:", err)
  }
}

function filtrarDocumentos() {
  const busca = document.getElementById("filtroBusca").value.toLowerCase().trim()

  let docs = [...docsGlobal]

  if (filtroModuloAtual) {
    docs = docs.filter(doc => doc.modulo === filtroModuloAtual)
  }

  docs = docs.filter(doc => {
    const nome = (doc.nome || "").toLowerCase()
    const email = (doc.anexado_por || "").toLowerCase()
    const departamento = (doc.departamento || "").toLowerCase()
    const modulo = (doc.modulo || "").toLowerCase()
    const armazenamento = (doc.embalagem || "").toLowerCase()

    return (
      nome.includes(busca) ||
      email.includes(busca) ||
      departamento.includes(busca) ||
      modulo.includes(busca) ||
      armazenamento.includes(busca)
    )
  })

  return docs
}

function renderTabela() {
  const body = document.getElementById("tabelaBody")
  const vazio = document.getElementById("bd-vazio")
  const paginacao = document.getElementById("bdPaginacao")
  const pageNumeros = document.getElementById("bdPageNumeros")

  body.innerHTML = ""
  pageNumeros.innerHTML = ""

  const docs = filtrarDocumentos()
  const totalPaginas = Math.max(1, Math.ceil(docs.length / itensPorPagina))

  if (paginaAtual > totalPaginas) {
    paginaAtual = totalPaginas
  }

  const inicio = (paginaAtual - 1) * itensPorPagina
  const fim = inicio + itensPorPagina
  const docsPagina = docs.slice(inicio, fim)

  if (docs.length === 0) {
    vazio.style.display = "block"
    paginacao.style.display = "none"
    return
  }

  vazio.style.display = "none"
  paginacao.style.display = "flex"

  docsPagina.forEach(doc => {
    body.innerHTML += `
      <tr>
        <td class="bd-nome-arquivo">${doc.nome || "-"}</td>
        <td>${doc.anexado_por || "-"}</td>
        <td>${doc.departamento || "-"}</td>
        <td>
          <span class="bd-badge ${classeModulo(doc.modulo)}">
            ${nomeModulo(doc.modulo)}
          </span>
        </td>
        <td>
         <button class="bd-pdf-link" type="button" onclick="abrirPdfBanco('${doc._id}')">
              Ver PDF
        </button>
        </td>
        <td>${doc.embalagem || "Sem armazenamento"}</td>
        <td>
          <button class="bd-btn-arquivar-item" onclick="arquivarDocumento('${doc._id}')">
            🗑 Arquivar
          </button>
        </td>
      </tr>
    `
  })

  renderNumerosPagina(totalPaginas)
  atualizarEstadoBotoes(totalPaginas)
}

function renderNumerosPagina(totalPaginas) {
  const pageNumeros = document.getElementById("bdPageNumeros")
  pageNumeros.innerHTML = ""

  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement("button")
    btn.className = "bd-page-num"
    if (i === paginaAtual) {
      btn.classList.add("active")
    }

    btn.innerText = i
    btn.onclick = () => {
      paginaAtual = i
      renderTabela()
    }

    pageNumeros.appendChild(btn)
  }
}

function atualizarEstadoBotoes(totalPaginas) {
  const botoes = document.querySelectorAll(".bd-page-btn")
  const btnAnterior = botoes[0]
  const btnProximo = botoes[1]

  if (btnAnterior) btnAnterior.disabled = paginaAtual === 1
  if (btnProximo) btnProximo.disabled = paginaAtual === totalPaginas
}

function paginaAnterior() {
  if (paginaAtual > 1) {
    paginaAtual--
    renderTabela()
  }
}

function proximaPagina() {
  const docs = filtrarDocumentos()
  const totalPaginas = Math.max(1, Math.ceil(docs.length / itensPorPagina))

  if (paginaAtual < totalPaginas) {
    paginaAtual++
    renderTabela()
  }
}

let arquivadosGlobal = []
let intervaloArquivados = null

async function abrirArquivados() {
  document.getElementById("modalArquivados").style.display = "flex"

  await carregarArquivados()

  intervaloArquivados = setInterval(() => {
    carregarArquivados()
  }, 10000)
}

function fecharArquivados() {
  document.getElementById("modalArquivados").style.display = "none"

  if (intervaloArquivados) {
    clearInterval(intervaloArquivados)
    intervaloArquivados = null
  }
}

async function carregarArquivados() {
  const dados = await apiFetch("/arquivamentos")
  if (!dados) return

  arquivadosGlobal = dados
  renderArquivados()
}

function renderArquivados() {
  const tbody = document.getElementById("tabelaArquivados")
  const busca = (document.getElementById("buscaArquivados")?.value || "")
    .toLowerCase()
    .trim()

  tbody.innerHTML = ""

  const filtrados = arquivadosGlobal.filter(doc => {
    const texto = `${doc.nome || ""} ${doc.departamento || ""} ${doc.modulo || ""}`.toLowerCase()
    return texto.includes(busca)
  })

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:20px;">
          Nenhum documento arquivado encontrado.
        </td>
      </tr>
    `
    return
  }

  filtrados.forEach(doc => {
    tbody.innerHTML += `
      <tr>
        <td>${doc.nome || "-"}</td>
        <td>${doc.departamento || "-"}</td>
        <td>${doc.modulo || "-"}</td>
        <td>${formatarDataArquivamento(doc)}</td>
        <td>${calcularExpiraEm(doc)}</td>
        <td>${formatarContagemRegressiva(doc)}</td>
        <td>
          <button class="bd-btn-restaurar" onclick="restaurarArquivamento('${doc._id}')">
            ↩ Restaurar
          </button>
          <button class="bd-btn-excluir-definitivo" onclick="excluirArquivamentoDefinitivamente('${doc._id}')">
            🗑 Apagar definitivamente
          </button>
        </td>
      </tr>
    `
  })
}

function formatarDataArquivamento(doc) {
  if (!doc.data_arquivamento) return "-"

  const data = new Date(doc.data_arquivamento)
  return data.toLocaleDateString("pt-BR")
}

function calcularExpiraEm(doc) {
  if (!doc.data_arquivamento) return "-"

  const data = new Date(doc.data_arquivamento)
  data.setMonth(data.getMonth() + 6)

  return data.toLocaleDateString("pt-BR")
}

function formatarContagemRegressiva(doc) {
  let segundos = Number(doc.segundos_restantes)
  if (!Number.isFinite(segundos)) {
    const expira = doc.data_exclusao_definitiva
      ? new Date(doc.data_exclusao_definitiva)
      : null
    segundos = expira ? Math.max(0, Math.floor((expira.getTime() - Date.now()) / 1000)) : 0
  }

  if (segundos <= 0) return "Aguardando exclusão automática"

  const dias = Math.floor(segundos / 86400)
  const horas = Math.floor((segundos % 86400) / 3600)
  return `${dias} dia(s) e ${horas} hora(s)`
}

async function arquivarDocumento(id) {
  if (!confirm("Deseja mover este documento para Arquivados? Ele ficará lá por 6 meses.")) return

  const data = await apiFetch(`/documents/${id}`, { method: "DELETE" })
  if (data?.error) {
    alert(data.error)
    return
  }

  alert(data?.msg || "Documento movido para Arquivados")
  await carregarDados()
}

async function excluirArquivamentoDefinitivamente(id) {
  if (!confirm("ATENÇÃO: esta ação apagará o documento definitivamente e não poderá ser desfeita. Continuar?")) return

  const data = await apiFetch(`/arquivamentos/${id}`, { method: "DELETE" })
  if (data?.error) {
    alert(data.error)
    return
  }

  alert("Documento excluído definitivamente")
  await carregarArquivados()
}

async function restaurarArquivamento(id) {
  if (!confirm("Deseja restaurar este documento? A contagem de 5 anos será reiniciada.")) return

  const data = await apiFetch(`/arquivamentos/${id}/restaurar`, {
    method: "POST"
  })

  if (data?.error) {
    alert(data.error)
    return
  }

  alert("Documento restaurado com sucesso")

  await carregarArquivados()
  await carregarDados()
}



let pdfBancoAtual = null

async function abrirPdfBanco(id) {
  const doc = docsGlobal.find(item => item._id === id)
  const modal = document.getElementById("modalPdfBanco")
  const viewer = document.getElementById("viewerPdfBanco")
  const titulo = document.getElementById("tituloPdfBanco")

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

    fecharPdfBanco()

    pdfBancoAtual = {
      url,
      nome: doc?.arquivo_nome || doc?.nome_original || doc?.arquivo || "documento.pdf"
    }

    if (titulo) {
      titulo.innerText = doc?.nome || "Visualizar PDF"
    }

    viewer.src = url
    modal.style.display = "flex"
  } catch (error) {
    console.error(error)
    alert("Erro de conexão ao carregar o PDF")
  }
}

function fecharPdfBanco() {
  const modal = document.getElementById("modalPdfBanco")
  const viewer = document.getElementById("viewerPdfBanco")

  if (viewer) viewer.src = ""

  if (pdfBancoAtual?.url) {
    URL.revokeObjectURL(pdfBancoAtual.url)
  }

  pdfBancoAtual = null

  if (modal) modal.style.display = "none"
}

function baixarPdfBancoAtual() {
  if (!pdfBancoAtual) return

  const link = document.createElement("a")
  link.href = pdfBancoAtual.url
  link.download = pdfBancoAtual.nome
  document.body.appendChild(link)
  link.click()
  link.remove()
}



window.addEventListener("click", function(event) {
  const modalPdf = document.getElementById("modalPdfBanco")
  if (event.target === modalPdf) fecharPdfBanco()
})

document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") fecharPdfBanco()
})

preencherUsuario()
carregarDados()