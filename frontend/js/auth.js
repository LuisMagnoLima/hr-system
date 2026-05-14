async function login() {
  const email = document.getElementById("email").value
  const password = document.getElementById("senha").value

  const res = await fetch("http://localhost:5000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  })

  const data = await res.json()

  if (data.token) {
    localStorage.setItem("token", data.token)

    const payload = JSON.parse(atob(data.token.split('.')[1]))

    if (payload.email === "arthur@inagro.com") {
      window.location = "banco_dados.html"
      return
    }

    if (payload.email === "teste@inagro.com" || payload.permissions.includes("financeiro")) {
      window.location = "financeiro.html"
      return
    }

    window.location = "menu.html"
  } else {
    alert("Login inválido")
  }
}