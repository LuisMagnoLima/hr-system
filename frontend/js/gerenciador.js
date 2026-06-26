let filtroAtual = "ativo"

function bloquearSolicitante() {
  const token = localStorage.getItem("token")
  if (!token) return

  const payload = JSON.parse(atob(token.split(".")[1]))

  if (payload.role === "solicitante") {
    alert("Você não tem acesso ao gerenciador")
    window.location.href = "menu.html"
  }
}

bloquearSolicitante()

function getModuloAtual() {
  return localStorage.getItem("modulo") || "notas"
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

function getUser() {
  const token = localStorage.getItem("token")
  if (!token) return "Desconhecido"

  const payload = JSON.parse(atob(token.split(".")[1]))
  return payload.email
}

function getDepartamentoAtual() {
  return localStorage.getItem("departamento") || "SAFE"
}

function atualizarTitulo() {
  const dep = getDepartamentoAtual()
  const titulo = document.getElementById("tituloDepartamento")
  if (titulo) titulo.innerText = `Gerenciador - ${dep}`
}

function atualizarStatusVisual() {
  const tipoUpper = filtroAtual.toUpperCase()

  const statusAtual = document.getElementById("statusAtual")
  const modalTitulo = document.getElementById("modalTitulo")
  const modalTipoTexto = document.getElementById("modalTipoTexto")
  const btnAdicionarTipo = document.getElementById("btnAdicionarTipo")

  if (statusAtual) statusAtual.innerText = tipoUpper
  if (modalTitulo) modalTitulo.innerText = `Adicionar Documento em ${tipoUpper}`
  if (modalTipoTexto) modalTipoTexto.innerText = tipoUpper
  if (btnAdicionarTipo) btnAdicionarTipo.innerText = `Adicionar em ${tipoUpper}`
}

function abrirModal() {
  atualizarStatusVisual()

  const nome = document.getElementById("nome")
  const embalagem = document.getElementById("embalagem")
  const file = document.getElementById("file")
  const modal = document.getElementById("modal")

  if (nome) nome.value = ""
  if (embalagem) embalagem.value = ""
  if (file) file.value = ""
  if (modal) modal.style.display = "flex"
}

function fecharModal() {
  const modal = document.getElementById("modal")
  if (modal) modal.style.display = "none"
}

function voltar() {
  window.location.href = "departamentos.html"
}

function aplicarCorBotao() {
  const btn = document.getElementById("btnVoltar")
  if (!btn) return

  const tema = getTemaModulo()
  btn.style.background = tema.cor
  btn.style.color = "#fff"
  btn.style.border = "none"
  btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)"
}

async function upload() {
  const file = document.getElementById("file").files[0]
  const nome = document.getElementById("nome").value.trim()
  const embalagem = document.getElementById("embalagem").value.trim()

  if (!file) {
    alert("Selecione um arquivo PDF")
    return
  }

  if (!nome) {
    alert("Digite o nome do documento")
    return
  }

  const modulo = localStorage.getItem("modulo")
  const departamento = getDepartamentoAtual()

  const formData = new FormData()
  formData.append("file", file)
  formData.append("nome", nome)
  formData.append("embalagem", embalagem)
  formData.append("usuario", getUser())
  formData.append("tipo", filtroAtual)
  formData.append("modulo", modulo)
  formData.append("departamento", departamento)

  try {
    const data = await apiFetch("/upload", {
      method: "POST",
      body: formData
    })

    if (data?.error) {
      alert(data.error)
      return
    }

    alert("✅ Documento enviado com sucesso")
    fecharModal()
    loadDocs()
  } catch (err) {
    alert("Erro de conexão com servidor")
  }
}

function setFiltro(tipo, el) {
  filtroAtual = tipo

  document.querySelectorAll(".ger-tab").forEach(btn => {
    btn.classList.remove("active")
  })

  if (el) el.classList.add("active")

  atualizarStatusVisual()
  loadDocs()
}

async function loadDocs() {
  atualizarTitulo()

  const modulo = localStorage.getItem("modulo")
  const departamento = getDepartamentoAtual()
  const buscaInput = document.getElementById("busca")
  const busca = buscaInput ? buscaInput.value.toLowerCase().trim() : ""

  const docs = await apiFetch(`/documents?modulo=${modulo}&departamento=${departamento}`)

  const lista = document.getElementById("lista")
  lista.innerHTML = ""

  const filtrados = docs
    .filter(doc => doc.tipo === filtroAtual)
    .filter(doc => (doc.nome || "").toLowerCase().includes(busca))

  const contadorDocs = document.getElementById("contadorDocs")
  if (contadorDocs) {
    contadorDocs.innerText = `${filtrados.length} documento(s) encontrado(s)`
  }

  if (filtrados.length === 0) {
    lista.innerHTML = `
      <div class="ger-empty">
        <div class="ger-empty-icon">📄</div>
        <h3>Nenhum documento encontrado</h3>
        <p>Adicione um novo registro ou altere o filtro</p>
      </div>
    `
    return
  }

  filtrados.forEach(doc => {
    lista.innerHTML += `
      <div class="ger-card">
        <h3>${doc.nome}</h3>

        <div class="ger-badges">
          <span class="ger-badge ger-badge-tipo">${doc.tipo.toUpperCase()}</span>
        </div>

        <p>📦 ${doc.embalagem || "Sem embalagem"}</p>
        <p>👤 ${doc.anexado_por}</p>
        <p>📂 ${doc.departamento}</p>

        <div class="ger-card-actions">
          <button
            class="ger-download-btn"
            onclick="baixarArquivo('${doc.arquivo}')">
             📥 Baixar
          </button>
          <button class="ger-delete-btn" onclick="remover('${doc._id}')">🗑</button>
        </div>
      </div>
    `
  })
}


async function baixarArquivo(filename) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/files/${filename}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

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
async function remover(id) {
  const data = await apiFetch(`/documents/${id}?usuario=${encodeURIComponent(getUser())}`, {
    method: "DELETE"
  })

  if (data?.error) {
    alert(data.error)
    return
  }

  loadDocs()
}

window.onclick = function(event) {
  const modal = document.getElementById("modal")
  if (event.target === modal) fecharModal()
}

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") fecharModal()
})

aplicarTemaModulo()
atualizarTitulo()
atualizarStatusVisual()
aplicarCorBotao()
loadDocs()