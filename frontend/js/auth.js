const loginForm = document.getElementById("loginForm")
const emailInput = document.getElementById("email")
const passwordInput = document.getElementById("senha")
const loginButton = document.getElementById("loginButton")
const loginMessage = document.getElementById("loginMessage")
const togglePasswordButton = document.getElementById("togglePassword")

function showLoginMessage(message, type = "error") {
  loginMessage.textContent = message
  loginMessage.className = `login-message ${type}`
}

function clearLoginMessage() {
  loginMessage.textContent = ""
  loginMessage.className = "login-message"
}

function setLoginLoading(isLoading) {
  loginButton.disabled = isLoading
  loginButton.textContent = isLoading ? "Entrando..." : "Entrar"
}

async function login() {
  const email = emailInput.value.trim().toLowerCase()
  const password = passwordInput.value

  clearLoginMessage()

  if (!email) {
    showLoginMessage("Informe o e-mail.")
    emailInput.focus()
    return
  }

  if (!password) {
    showLoginMessage("Informe a senha.")
    passwordInput.focus()
    return
  }

  setLoginLoading(true)

  try {
    const data = await apiFetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })

    const user = data.user
    currentUserCache = user
    sessionStorage.setItem("hr_user", JSON.stringify(user))

    if (user.role === "admin") {
  window.location.replace("/banco_dados.html")
} else if ((user.permissions || []).includes("financeiro")) {
  window.location.replace("/financeiro.html")
} else {
  window.location.replace("/menu.html")
}
  } catch (error) {
    showLoginMessage(error.message || "Não foi possível realizar o login.")
    passwordInput.select()
    passwordInput.focus()
  } finally {
    setLoginLoading(false)
  }
}

loginForm.addEventListener("submit", event => {
  event.preventDefault()

  if (!loginButton.disabled) {
    login()
  }
})

togglePasswordButton.addEventListener("click", () => {
  const passwordIsVisible = passwordInput.type === "text"

  passwordInput.type = passwordIsVisible ? "password" : "text"
  togglePasswordButton.textContent = passwordIsVisible ? "Mostrar" : "Ocultar"
  togglePasswordButton.setAttribute(
    "aria-label",
    passwordIsVisible ? "Mostrar senha" : "Ocultar senha"
  )
  togglePasswordButton.title = passwordIsVisible ? "Mostrar senha" : "Ocultar senha"
  passwordInput.focus()
})

emailInput.addEventListener("input", clearLoginMessage)
passwordInput.addEventListener("input", clearLoginMessage)
