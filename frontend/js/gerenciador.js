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
  resetarUploadProgress()
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
    const data = await enviarArquivoComProgresso("/upload", formData, file)

    if (data?.error) {
      alert(data.error)
      resetarUploadProgress()
      return
    }

    marcarUploadConcluido()

    setTimeout(() => {
      fecharModal()
      resetarUploadProgress()
      loadDocs()
    }, 900)
  } catch (err) {
    alert(err?.error || "Erro de conexão com servidor")
    marcarUploadErro()
  }
}

function formatarMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + " MB"
}

function formatarTempo(segundos) {
  if (!Number.isFinite(segundos) || segundos < 0) return "Calculando tempo..."

  if (segundos < 60) {
    return Math.ceil(segundos) + "s restantes"
  }

  const minutos = Math.floor(segundos / 60)
  const resto = Math.ceil(segundos % 60)
  return `${minutos}min ${resto}s restantes`
}

function prepararUploadProgress(file) {
  const uploadArea = document.getElementById("uploadArea")
  const nomeArquivo = document.getElementById("uploadNomeArquivo")
  const tamanhoArquivo = document.getElementById("uploadTamanhoArquivo")
  const porcentagem = document.getElementById("uploadPorcentagem")
  const barra = document.getElementById("uploadBarFill")
  const velocidade = document.getElementById("uploadVelocidade")
  const tempo = document.getElementById("uploadTempoRestante")
  const botao = document.getElementById("btnAdicionarTipo")

  if (uploadArea) uploadArea.style.display = "flex"
  if (nomeArquivo) nomeArquivo.innerText = file.name
  if (tamanhoArquivo) tamanhoArquivo.innerText = formatarMB(file.size)
  if (porcentagem) porcentagem.innerText = "0%"
  if (barra) {
    barra.style.width = "0%"
    barra.classList.remove("upload-success", "upload-error")
  }
  if (velocidade) velocidade.innerText = "Preparando envio..."
  if (tempo) tempo.innerText = "Calculando tempo..."
  if (botao) {
    botao.disabled = true
    botao.innerText = "Enviando..."
  }
}

function atualizarUploadProgress(event, inicio) {
  if (!event.lengthComputable) return

  const porcentagemNumero = Math.round((event.loaded / event.total) * 100)
  const segundos = (Date.now() - inicio) / 1000
  const mbEnviados = event.loaded / 1024 / 1024
  const velocidadeMB = segundos > 0 ? mbEnviados / segundos : 0
  const restanteBytes = event.total - event.loaded
  const restanteMB = restanteBytes / 1024 / 1024
  const tempoRestante = velocidadeMB > 0 ? restanteMB / velocidadeMB : Infinity

  const barra = document.getElementById("uploadBarFill")
  const porcentagem = document.getElementById("uploadPorcentagem")
  const velocidade = document.getElementById("uploadVelocidade")
  const tempo = document.getElementById("uploadTempoRestante")

  if (barra) barra.style.width = porcentagemNumero + "%"
  if (porcentagem) porcentagem.innerText = porcentagemNumero + "%"
  if (velocidade) velocidade.innerText = velocidadeMB.toFixed(2) + " MB/s"
  if (tempo) tempo.innerText = formatarTempo(tempoRestante)
}

function marcarUploadConcluido() {
  const barra = document.getElementById("uploadBarFill")
  const porcentagem = document.getElementById("uploadPorcentagem")
  const velocidade = document.getElementById("uploadVelocidade")
  const tempo = document.getElementById("uploadTempoRestante")

  if (barra) {
    barra.style.width = "100%"
    barra.classList.add("upload-success")
  }
  if (porcentagem) porcentagem.innerText = "100%"
  if (velocidade) velocidade.innerText = "Upload concluído"
  if (tempo) tempo.innerText = "Documento enviado com sucesso"
}

function marcarUploadErro() {
  const barra = document.getElementById("uploadBarFill")
  const velocidade = document.getElementById("uploadVelocidade")
  const tempo = document.getElementById("uploadTempoRestante")
  const botao = document.getElementById("btnAdicionarTipo")

  if (barra) barra.classList.add("upload-error")
  if (velocidade) velocidade.innerText = "Erro no upload"
  if (tempo) tempo.innerText = "Tente novamente"
  if (botao) {
    botao.disabled = false
    atualizarStatusVisual()
  }
}

function resetarUploadProgress() {
  const uploadArea = document.getElementById("uploadArea")
  const barra = document.getElementById("uploadBarFill")
  const porcentagem = document.getElementById("uploadPorcentagem")
  const botao = document.getElementById("btnAdicionarTipo")

  if (uploadArea) uploadArea.style.display = "none"
  if (barra) {
    barra.style.width = "0%"
    barra.classList.remove("upload-success", "upload-error")
  }
  if (porcentagem) porcentagem.innerText = "0%"
  if (botao) {
    botao.disabled = false
    atualizarStatusVisual()
  }
}

function enviarArquivoComProgresso(url, formData, file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const inicio = Date.now()

    prepararUploadProgress(file)

    xhr.upload.addEventListener("progress", event => {
      atualizarUploadProgress(event, inicio)
    })

    xhr.onload = () => {
      let data = {}

      try {
        data = JSON.parse(xhr.responseText || "{}")
      } catch (e) {
        data = { error: "Erro ao processar resposta do servidor" }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
      } else {
        reject(data)
      }
    }

    xhr.onerror = () => {
      reject({ error: "Erro de conexão com servidor" })
    }

    xhr.open("POST", API_URL + url)
    xhr.setRequestHeader("Authorization", "Bearer " + localStorage.getItem("token"))
    xhr.send(formData)
  })
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