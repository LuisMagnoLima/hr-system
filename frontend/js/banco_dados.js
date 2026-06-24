let docsGlobal = []
let filtroModuloAtual = ""
let paginaAtual = 1
const itensPorPagina = 8

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
          <a class="bd-pdf-link" href="http://localhost:5000/files/${doc.arquivo}" target="_blank">
            Ver PDF
          </a>
        </td>
        <td>${doc.embalagem || "Sem armazenamento"}</td>
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

preencherUsuario()
carregarDados()