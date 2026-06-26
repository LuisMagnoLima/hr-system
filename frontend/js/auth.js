async function login() {
  const email = document.getElementById("email").value
  const password = document.getElementById("senha").value

  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  })

  const data = await res.json()

  if (data.token) {
    localStorage.setItem("token", data.token)

    const payload = JSON.parse(atob(data.token.split(".")[1]))

    if (payload.role === "admin") {
      window.location = "banco_dados.html"
      return
    }

    if (payload.permissions.includes("financeiro")) {
      window.location = "financeiro.html"
      return
    }

    window.location = "menu.html"
  } else {
    alert(data.error || "Login inválido")
  }
}