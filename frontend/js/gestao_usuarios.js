function getPayload() {
  const token = sessionStorage.getItem("hr_user")
  if (!token) { window.location.href = "login.html"; return null }
  try { return JSON.parse(token) } catch { sessionStorage.clear(); window.location.href = "login.html"; return null }
}

function protegerAdmin() {
  const payload = getPayload()
  if (!payload) return false
  if (payload.role !== "admin") {
    alert("Apenas administradores podem acessar a Gestão de Usuários")
    window.location.href = "menu.html"
    return false
  }
  return true
}

function irDashboard(){ window.location.href = "dashboard.html" }
function irBanco(){ window.location.href = "banco_dados.html" }
function irAuditoria(){ window.location.href = "auditoria.html" }
function irFinanceiro(){ window.location.href = "financeiro.html" }
function logout(){ logoutSistema() }

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
    return email.includes(filtroUsuarioBusca) && (!filtroUsuarioRole || role === filtroUsuarioRole)
  })
}

function escaparHtml(valor) {
  return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;")
}

function renderUsuarios() {
  const tbody = document.getElementById("usuariosTabela")
  const pageNumeros = document.getElementById("usuariosPageNumeros")
  const contador = document.getElementById("usuariosContador")
  tbody.innerHTML = ""
  pageNumeros.innerHTML = ""
  const filtrados = filtrarUsuarios()
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / usuariosPorPagina))
  if (paginaUsuarios > totalPaginas) paginaUsuarios = totalPaginas
  const pagina = filtrados.slice((paginaUsuarios - 1) * usuariosPorPagina, paginaUsuarios * usuariosPorPagina)
  contador.innerText = `${filtrados.length} usuário(s) encontrado(s)`
  if (!pagina.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="users-empty">Nenhum usuário encontrado.</td></tr>'
  } else {
    pagina.forEach(user => {
      const tr = document.createElement("tr")
      tr.innerHTML = `<td>${escaparHtml(user.email)}</td><td><span class="role-badge role-${escaparHtml(user.role || "operador")}">${escaparHtml(user.role || "operador")}</span></td><td>${escaparHtml((user.permissions || []).join(", ") || "-")}</td><td><button class="btn-edit-user" onclick="editarUsuario('${user._id}')">Editar</button><button class="btn-pass-user" onclick="alterarSenha('${user._id}')">Senha</button><button class="btn-del-user" onclick="excluirUsuario('${user._id}')">Excluir</button></td>`
      tbody.appendChild(tr)
    })
  }
  for (let i=1; i<=totalPaginas; i++) {
    const btn=document.createElement("button")
    btn.className="user-page-num" + (i===paginaUsuarios ? " active" : "")
    btn.innerText=i
    btn.onclick=()=>{ paginaUsuarios=i; renderUsuarios() }
    pageNumeros.appendChild(btn)
  }
}

function filtrarUsuariosUI(){
  filtroUsuarioBusca=document.getElementById("filtroUsuarioBusca").value.toLowerCase().trim()
  filtroUsuarioRole=document.getElementById("filtroUsuarioRole").value
  paginaUsuarios=1
  renderUsuarios()
}
function paginaUsuariosAnterior(){ if(paginaUsuarios>1){paginaUsuarios--;renderUsuarios()} }
function proximaPaginaUsuarios(){ const total=Math.max(1,Math.ceil(filtrarUsuarios().length/usuariosPorPagina)); if(paginaUsuarios<total){paginaUsuarios++;renderUsuarios()} }

function abrirModalUsuario(){
  document.getElementById("modalUsuarioTitulo").innerText="Novo Usuário"
  document.getElementById("userId").value=""
  document.getElementById("userEmailInput").value=""
  document.getElementById("userSenhaInput").value=""
  document.getElementById("userSenhaInput").disabled=false
  document.getElementById("userRoleInput").value="operador"
  document.querySelectorAll(".permissoes-grid input").forEach(input=>input.checked=false)
  document.getElementById("modalUsuario").style.display="flex"
}
function fecharModalUsuario(){ document.getElementById("modalUsuario").style.display="none" }
function editarUsuario(id){
  const user=usuariosGlobal.find(u=>u._id===id); if(!user)return
  document.getElementById("modalUsuarioTitulo").innerText="Editar Usuário"
  document.getElementById("userId").value=user._id
  document.getElementById("userEmailInput").value=user.email
  document.getElementById("userSenhaInput").value=""
  document.getElementById("userSenhaInput").disabled=true
  document.getElementById("userRoleInput").value=user.role||"operador"
  const permissoes=user.permissions||[]
  document.querySelectorAll(".permissoes-grid input").forEach(input=>input.checked=permissoes.includes(input.value))
  document.getElementById("modalUsuario").style.display="flex"
}
function getPermissoesSelecionadas(){ return Array.from(document.querySelectorAll(".permissoes-grid input:checked")).map(input=>input.value) }

async function salvarUsuario(){
  const id=document.getElementById("userId").value
  const dados={email:document.getElementById("userEmailInput").value.trim(),password:document.getElementById("userSenhaInput").value,role:document.getElementById("userRoleInput").value,permissions:getPermissoesSelecionadas()}
  if(!dados.email){alert("Informe o email");return}
  let result
  if(id){ delete dados.password; result=await apiFetch(`/admin/users/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(dados)}) }
  else { if(!dados.password){alert("Informe a senha");return}; result=await apiFetch("/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(dados)}) }
  if(result?.error){alert(result.error);return}
  alert(result.msg||"Usuário salvo com sucesso")
  fecharModalUsuario(); carregarUsuarios()
}
async function alterarSenha(id){
  const novaSenha=prompt("Digite a nova senha:"); if(!novaSenha)return
  const result=await apiFetch(`/admin/users/${id}/password`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:novaSenha})})
  if(result?.error){alert(result.error);return}; alert("Senha alterada com sucesso")
}
async function excluirUsuario(id){
  if(!confirm("Tem certeza que deseja excluir este usuário?"))return
  const result=await apiFetch(`/admin/users/${id}`,{method:"DELETE"})
  if(result?.error){alert(result.error);return}; alert("Usuário excluído com sucesso"); carregarUsuarios()
}

window.onclick = event => { if(event.target === document.getElementById("modalUsuario")) fecharModalUsuario() }
if (protegerAdmin()) carregarUsuarios()
