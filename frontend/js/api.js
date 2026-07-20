const API_URL =
  ["localhost", "127.0.0.1", ""].includes(window.location.hostname)
    ? "http://127.0.0.1:5000"
    : window.location.origin

let currentUserCache = null

async function apiFetch(url, options = {}) {
  const config = {
    ...options,
    credentials: "include",
    headers: { ...(options.headers || {}) }
  }

  let response
  try {
    response = await fetch(API_URL + url, config)
  } catch (_error) {
    throw new Error("Não foi possível conectar ao servidor")
  }

  const contentType = response.headers.get("content-type") || ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text()

  if (response.status === 401) {
    currentUserCache = null
    sessionStorage.removeItem("hr_user")
    if (!window.location.pathname.endsWith("/login.html")) {
    window.location.replace("/login.html")
    }
    throw new Error(data?.error || "Sessão expirada")
  }

  if (response.status === 403) {
    throw new Error(data?.error || "Você não tem permissão para acessar esta função")
  }

  if (!response.ok) {
    throw new Error(data?.error || `Erro na requisição (${response.status})`)
  }

  return data
}

async function getCurrentUser(force = false) {
  if (currentUserCache && !force) return currentUserCache
  currentUserCache = await apiFetch("/me")
  sessionStorage.setItem("hr_user", JSON.stringify(currentUserCache))
  return currentUserCache
}

async function requireCurrentUser() {
  try {
    return await getCurrentUser()
  } catch (_error) {
    return null
  }
}

async function logoutSistema() {
  try {
    await apiFetch("/logout", { method: "POST" })
  } catch (_error) {
    // A sessão local deve ser removida mesmo quando a API estiver indisponível.
  } finally {
    currentUserCache = null
    sessionStorage.removeItem("hr_user")
    localStorage.removeItem("modulo")
    localStorage.removeItem("departamento")
    window.location.replace("login.html")
  }
}

async function baixarArquivo(filename) {
  const novaAba = window.open("", "_blank")
  try {
    const response = await fetch(`${API_URL}/files/${encodeURI(filename)}`, { credentials: "include" })
    if (!response.ok) {
      const erro = await response.json().catch(() => ({}))
      throw new Error(erro.error || "Erro ao abrir o PDF")
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    if (novaAba) novaAba.location.href = url
    else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    alert(error.message || "Erro de conexão ao abrir o PDF")
    if (novaAba) novaAba.close()
  }
}
