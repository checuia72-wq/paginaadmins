import { useState } from "react";
import { login } from "../services/auth.service";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await login(email, password);

    if (error) {
      alert("Credenciales incorrectas");
      return;
    }

    window.location.href = "/dashboard";
  };

  return (
    <main>
      <form onSubmit={handleLogin}>
        <h1>Login Admin Forigua</h1>

        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit">Iniciar sesión</button>
      </form>
    </main>
  );
}

export default Login;