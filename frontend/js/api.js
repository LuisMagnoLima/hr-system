const API_URL = "http://localhost:5000"

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