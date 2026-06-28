const API_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === ""
    ? "http://localhost:5000"
    : "https://inagrohrsystem.onrender.com"

function getToken() {
  return localStorage.getItem("token")
}

async function apiFetch(url, options = {}) {
  options.headers = {
    ...(options.headers || {}),
    Authorization: "Bearer " + getToken()
  }

  const res = await fetch(API_URL + url, options)

  if (res.status === 401) {
    alert("Sessão expirada ou usuário inválido")
    localStorage.clear()
    window.location.href = "login.html"
    return null
  }

  if (res.status === 403) {
    alert("Você não tem permissão para acessar essa função")
    window.history.back()
    return null
  }

  return res.json()
}

async function baixarArquivo(filename) {
  const token = localStorage.getItem("token")

  // abre a aba imediatamente para não ser bloqueada pelo navegador
  const novaAba = window.open("", "_blank")

  try {
    const response = await fetch(`${API_URL}/files/${filename}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const erro = await response.json().catch(() => ({}))
      alert(erro.error || "Erro ao abrir o PDF.")
      if (novaAba) novaAba.close()
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    if (novaAba) {
      novaAba.location.href = url
    } else {
      window.location.href = url
    }
  } catch (err) {
    alert("Erro de conexão ao abrir o PDF.")
    if (novaAba) novaAba.close()
  }
}

