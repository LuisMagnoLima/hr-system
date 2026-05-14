const API_URL = "http://localhost:5000"

function getToken() {
  return localStorage.getItem("token")
}

async function apiFetch(url, options = {}) {
  options.headers = {
    ...(options.headers || {}),
    "Authorization": "Bearer " + getToken()
  }

  const res = await fetch(API_URL + url, options)

  if (res.status === 401) {
    alert("Sessão expirada")
    localStorage.clear()
    window.location = "login.html"
  }

  return res.json()
}