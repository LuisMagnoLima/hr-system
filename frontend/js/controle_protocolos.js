function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function dataBr(v){if(!v)return"-";const d=new Date(v);return Number.isNaN(d.getTime())?"-":d.toLocaleString("pt-BR")}
function payload(){try{return JSON.parse(sessionStorage.getItem("hr_user")||"null")}catch{return null}}
function proteger(){const u=payload();if(!u){location.href="login.html";return false}if(!["solicitante","admin"].includes(u.role)){alert("Acesso restrito à recepção e ao administrador");location.href="menu.html";return false}return true}
function params(){const mapa={protocolo:"fProtocolo",numero_oficio:"fOficio",interessado:"fInteressado",secretaria:"fSecretaria",setor:"fSetor",aceito_por:"fAceitoPor",situacao:"fSituacao",data_inicial:"fDataInicial",data_final:"fDataFinal"};const q=new URLSearchParams();Object.entries(mapa).forEach(([k,id])=>{const v=document.getElementById(id).value.trim();if(v)q.set(k,v)});return q}
let lista=[]
async function carregar(){const msg=document.getElementById("cpMensagem");msg.style.display="block";msg.textContent="Carregando protocolos...";try{const d=await apiFetch(`/controle-protocolos?${params()}`);lista=d.protocolos||[];document.getElementById("cardTotal").textContent=d.resumo.total;document.getElementById("cardPendentes").textContent=d.resumo.pendentes_aceite;document.getElementById("cardConfirmados").textContent=d.resumo.aceites_confirmados;document.getElementById("cardAtrasados").textContent=d.resumo.pendentes_mais_2_dias;document.getElementById("cardRecusados").textContent=d.resumo.recusados||0;render()}catch(e){msg.textContent=e.message}}
function render(){const tb=document.getElementById("cpTabela"),msg=document.getElementById("cpMensagem");tb.innerHTML="";if(!lista.length){msg.style.display="block";msg.textContent="Nenhum protocolo encontrado.";return}msg.style.display="none";lista.forEach(p=>{const tr=document.createElement("tr");tr.innerHTML=`<td><b>${esc(p.protocolo)}</b></td><td>${esc(p.numero_oficio)}</td><td>${esc(p.remetente)}</td><td>${dataBr(p.criado_em)}</td><td class="cp-actions"><button class="cp-print" onclick="imprimir('${p._id}')">Imprimir</button></td>`;tb.appendChild(tr)})}
function detalhar(id){try{const p=await apiFetch(`/controle-protocolos/${id}`);document.getElementById("cpDetalhes").innerHTML=`<h2>${esc(p.protocolo)}</h2><div class="cp-oficio">OFÍCIO ${esc(p.numero_oficio)}</div><p><b>Documento:</b> ${esc(p.nome_documento)}</p><p><b>Interessado:</b> ${esc(p.interessado||"Não informado")}</p><p><b>Secretaria / setor:</b> ${esc(p.secretaria)} / ${esc(p.setor_destino)}</p><p><b>Destinatário:</b> ${esc(p.destinatario)}</p><p><b>Observação:</b> ${esc(p.observacao||"Nenhuma")}</p>${p.status==="cancelado"?`<p><b>Justificativa do cancelamento:</b> ${esc(p.justificativa_cancelamento||"-")}</p>`:""}${p.status==="recusado_destinatario"?`<p><b>Recusado por:</b> ${esc(p.recusado_por||"-")}</p><p><b>Justificativa da recusa:</b> ${esc(p.justificativa_recusa||"-")}</p>`:""}<p><b>Reencaminhamentos:</b> ${esc(p.quantidade_reencaminhamentos||0)}</p><h3>Histórico do protocolo</h3><div class="cp-timeline">${(p.historico||[]).map(h=>`<div class="cp-event"><b>${esc(h.acao)}</b><div>${esc(h.usuario||"")}</div><small>${dataBr(h.data_hora)} • ${esc(h.situacao)}</small>${h.justificativa?`<p><b>Justificativa:</b> ${esc(h.justificativa)}</p>`:""}</div>`).join("")}</div>`;document.getElementById("cpModal").hidden=false}catch(e){alert(e.message)}}
function imprimir(id){const p=lista.find(x=>x._id===id);if(!p)return;const w=window.open("","_blank","width=800,height=700");w.document.write(`<!doctype html><html><head><title>${esc(p.protocolo)}</title><style>body{font-family:Arial;padding:35px;color:#222}h1{text-align:center}.box{border:2px solid #222;padding:20px;margin:20px 0}.oficio{font-size:28px;font-weight:bold;text-align:center;background:#eee;padding:15px}p{font-size:16px;border-bottom:1px solid #ddd;padding-bottom:8px}</style></head><body><h1>Comprovante de Protocolo</h1><div class="box"><h2>${esc(p.protocolo)}</h2><div class="oficio">OFÍCIO ${esc(p.numero_oficio)}</div><p><b>Documento:</b> ${esc(p.nome_documento)}</p><p><b>Interessado:</b> ${esc(p.interessado||"Não informado")}</p><p><b>Secretaria:</b> ${esc(p.secretaria)}</p><p><b>Setor de destino:</b> ${esc(p.setor_destino)}</p><p><b>Destinatário:</b> ${esc(p.destinatario)}</p><p><b>Situação:</b> ${esc(p.situacao)}</p><p><b>Cadastrado por:</b> ${esc(p.remetente)}</p><p><b>Data:</b> ${dataBr(p.criado_em)}</p></div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}
function limpar(){document.querySelectorAll(".cp-filtros input,.cp-filtros select").forEach(el=>el.value="");carregar()}
async function exportar(){const r=await fetch(`${API_URL}/controle-protocolos/exportar.csv?${params()}`,{credentials:"include"});if(!r.ok){const d=await r.json().catch(()=>({}));alert(d.error||"Erro ao exportar");return}const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="controle_protocolos.csv";a.click();URL.revokeObjectURL(u)}


function fecharEditModal(){
  document.getElementById("cpEditModal").hidden=true
}

function abrirEdicao(id){
  const p=lista.find(item=>item._id===id)
  if(!p)return

  document.getElementById("editId").value=p._id
  document.getElementById("editNumeroOficio").value=p.numero_oficio||""
  document.getElementById("editNomeDocumento").value=p.nome_documento||""
  document.getElementById("editInteressado").value=p.interessado||""
  document.getElementById("editSecretaria").value=p.secretaria||""
  document.getElementById("editSetor").value=p.setor_destino||""
  document.getElementById("editDestinatario").value=p.destinatario||""
  document.getElementById("editObservacao").value=p.observacao||""

  document.getElementById("cpEditModal").hidden=false
}

async function salvarEdicao(event){
  event.preventDefault()

  const id=document.getElementById("editId").value
  const dados={
    numero_oficio:document.getElementById("editNumeroOficio").value.trim(),
    nome_documento:document.getElementById("editNomeDocumento").value.trim(),
    interessado:document.getElementById("editInteressado").value.trim(),
    secretaria:document.getElementById("editSecretaria").value.trim(),
    setor_destino:document.getElementById("editSetor").value.trim(),
    destinatario:document.getElementById("editDestinatario").value.trim(),
    observacao:document.getElementById("editObservacao").value.trim()
  }

  try{
    const resposta=await apiFetch(`/solicitacoes/${id}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(dados)
    })
    alert(resposta.msg||"Protocolo atualizado")
    fecharEditModal()
    await carregar()
  }catch(e){
    alert(e.message)
  }
}

async function cancelarProtocolo(id){
  const p=lista.find(item=>item._id===id)
  if(!p)return

  const justificativa=prompt(
    `Informe a justificativa para cancelar o protocolo ${p.protocolo}:`
  )

  if(justificativa===null)return
  if(justificativa.trim().length<5){
    alert("A justificativa precisa ter pelo menos 5 caracteres.")
    return
  }

  if(!confirm("Confirma o cancelamento? O protocolo permanecerá no histórico.")){
    return
  }

  try{
    const resposta=await apiFetch(`/solicitacoes/${id}/cancelar`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({justificativa:justificativa.trim()})
    })
    alert(resposta.msg||"Protocolo cancelado")
    await carregar()
  }catch(e){
    alert(e.message)
  }
}



function fecharReencaminharModal(){document.getElementById("cpReencaminharModal").hidden=true}
function abrirReencaminhamento(id){
  const p=lista.find(item=>item._id===id); if(!p)return
  document.getElementById("reencaminharId").value=p._id
  document.getElementById("reencaminharSecretaria").value=p.secretaria||""
  document.getElementById("reencaminharSetor").value=p.setor_destino||""
  document.getElementById("reencaminharDestinatario").value=p.destinatario||""
  document.getElementById("reencaminharObservacao").value=p.observacao||""
  document.getElementById("reencaminharMotivo").textContent=`Motivo da recusa: ${p.justificativa_recusa||"Não informado"}`
  document.getElementById("cpReencaminharModal").hidden=false
}
async function salvarReencaminhamento(event){
  event.preventDefault()
  const id=document.getElementById("reencaminharId").value
  const dados={secretaria:document.getElementById("reencaminharSecretaria").value.trim(),setor_destino:document.getElementById("reencaminharSetor").value.trim(),destinatario:document.getElementById("reencaminharDestinatario").value.trim(),observacao:document.getElementById("reencaminharObservacao").value.trim()}
  try{const resposta=await apiFetch(`/solicitacoes/${id}/reencaminhar`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(dados)});alert(resposta.msg);fecharReencaminharModal();await carregar()}catch(e){alert(e.message)}
}

if(proteger()){document.getElementById("btnFiltrar").onclick=carregar;document.getElementById("btnLimpar").onclick=limpar;document.getElementById("btnExportar").onclick=exportar;document.getElementById("btnFecharModal").onclick=()=>document.getElementById("cpModal").hidden=true;document.getElementById("btnFecharEditModal").onclick=fecharEditModal;document.getElementById("btnCancelarEdicao").onclick=fecharEditModal;document.getElementById("cpEditForm").onsubmit=salvarEdicao;document.getElementById("btnFecharReencaminharModal").onclick=fecharReencaminharModal;document.getElementById("btnCancelarReencaminhamento").onclick=fecharReencaminharModal;document.getElementById("cpReencaminharForm").onsubmit=salvarReencaminhamento;document.getElementById("cpModal").onclick=e=>{if(e.target.id==="cpModal")e.currentTarget.hidden=true};document.getElementById("cpEditModal").onclick=e=>{if(e.target.id==="cpEditModal")fecharEditModal()};document.getElementById("cpReencaminharModal").onclick=e=>{if(e.target.id==="cpReencaminharModal")fecharReencaminharModal()};carregar()}
