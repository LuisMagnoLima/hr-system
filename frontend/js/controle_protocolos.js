function esc(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function dataBr(valor) {
  if (!valor) return "-"
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? "-" : data.toLocaleString("pt-BR")
}

function obterUsuario() {
  try {
    return JSON.parse(sessionStorage.getItem("hr_user") || "null")
  } catch {
    return null
  }
}

function proteger() {
  const usuario = obterUsuario()

  if (!usuario) {
    window.location.href = "login.html"
    return false
  }

  if (!["solicitante", "admin"].includes(usuario.role)) {
    alert("Acesso restrito à recepção e ao administrador.")
    window.location.href = "menu.html"
    return false
  }

  return true
}

function parametros() {
  const mapa = {
    protocolo: "fProtocolo",
    numero_oficio: "fOficio",
    data_inicial: "fDataInicial",
    data_final: "fDataFinal"
  }

  const query = new URLSearchParams()

  Object.entries(mapa).forEach(([campo, id]) => {
    const valor = document.getElementById(id).value.trim()
    if (valor) query.set(campo, valor)
  })

  return query
}

let protocolos = []

async function carregar() {
  const mensagem = document.getElementById("cpMensagem")
  mensagem.style.display = "block"
  mensagem.textContent = "Carregando protocolos..."

  try {
    const resposta = await apiFetch(`/controle-protocolos?${parametros()}`)
    protocolos = resposta.protocolos || []
    document.getElementById("cardTotal").textContent = resposta.resumo?.total || 0
    renderizar()
  } catch (erro) {
    mensagem.textContent = erro.message || "Erro ao carregar protocolos."
  }
}

function renderizar() {
  const tabela = document.getElementById("cpTabela")
  const mensagem = document.getElementById("cpMensagem")
  tabela.innerHTML = ""

  if (!protocolos.length) {
    mensagem.style.display = "block"
    mensagem.textContent = "Nenhum protocolo encontrado."
    return
  }

  mensagem.style.display = "none"

  protocolos.forEach(item => {
    const linha = document.createElement("tr")

    linha.innerHTML = `
      <td><strong>${esc(item.protocolo)}</strong></td>
      <td>${esc(item.numero_oficio)}</td>
      <td>${esc(item.remetente)}</td>
      <td>${dataBr(item.criado_em)}</td>
      <td class="cp-actions">
        <button class="cp-print" type="button" onclick="imprimir('${item._id}')">
          Imprimir
        </button>
        <button class="cp-edit" type="button" onclick="editar('${item._id}')">
          Editar
        </button>
      </td>
    `

    tabela.appendChild(linha)
  })
}

async function editar(id) {
  const item = protocolos.find(protocolo => protocolo._id === id)
  if (!item) return

  const novoNumero = window.prompt("Informe o novo número do ofício:", item.numero_oficio)
  if (novoNumero === null) return

  const numeroOficio = novoNumero.trim()
  if (!numeroOficio) {
    alert("O número do ofício não pode ficar vazio.")
    return
  }

  try {
    const resposta = await apiFetch(`/solicitacoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero_oficio: numeroOficio })
    })

    alert(resposta.msg || "Protocolo atualizado.")
    await carregar()
  } catch (erro) {
    alert(erro.message || "Erro ao atualizar o protocolo.")
  }
}

function imprimir(id) {
  const item = protocolos.find(protocolo => protocolo._id === id)
  if (!item) return

  const janela = window.open("", "_blank", "width=800,height=700")
  if (!janela) {
    alert("O navegador bloqueou a janela de impressão.")
    return
  }

  janela.document.write(`
    <!doctype html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <title>${esc(item.protocolo)}</title>
      <style>
        body{font-family:Arial;padding:35px;color:#222}
        h1{text-align:center}
        .box{border:2px solid #222;padding:22px;margin-top:22px}
        .oficio{font-size:30px;font-weight:bold;text-align:center;background:#eee;padding:18px}
        p{font-size:16px;border-bottom:1px solid #ddd;padding-bottom:9px}
      </style>
    </head>
    <body>
      <h1>Comprovante de Protocolo</h1>
      <div class="box">
        <h2>${esc(item.protocolo)}</h2>
        <div class="oficio">OFÍCIO ${esc(item.numero_oficio)}</div>
        <p><b>Cadastrado por:</b> ${esc(item.remetente)}</p>
        <p><b>Data:</b> ${dataBr(item.criado_em)}</p>
      </div>
      <script>window.onload = () => window.print()<\/script>
    </body>
    </html>
  `)

  janela.document.close()
}

function limpar() {
  document.querySelectorAll(".cp-filtros input").forEach(campo => {
    campo.value = ""
  })
  carregar()
}

async function exportar() {
  try {
    const resposta = await fetch(
      `${API_URL}/controle-protocolos/exportar.csv?${parametros()}`,
      { credentials: "include" }
    )

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}))
      throw new Error(erro.error || "Erro ao exportar.")
    }

    const arquivo = await resposta.blob()
    const url = URL.createObjectURL(arquivo)
    const link = document.createElement("a")
    link.href = url
    link.download = "controle_protocolos.csv"
    link.click()
    URL.revokeObjectURL(url)
  } catch (erro) {
    alert(erro.message || "Erro ao exportar.")
  }
}

if (proteger()) {
  document.getElementById("btnFiltrar").addEventListener("click", carregar)
  document.getElementById("btnLimpar").addEventListener("click", limpar)
  document.getElementById("btnExportar").addEventListener("click", exportar)
  carregar()
}
