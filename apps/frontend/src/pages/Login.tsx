import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff } from "lucide-react";
import "../styles/login.css";

const DEMO_SESSION_KEY = "forigua:demo_session";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!supabase) {
        setError("Supabase no está configurado.");
        return;
      }

      const { data, error: supabaseError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (supabaseError) {
        setError("Credenciales incorrectas.");
        return;
      }

      if (data.session) {
        localStorage.setItem(
          DEMO_SESSION_KEY,
          JSON.stringify({ email })
        );

        window.location.href = "/app";
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-layout">
        {/* Panel lateral morado sólido */}
        <div className="login-side">
          <div className="login-side-content">
            <h2 className="login-side-title">Panel administrativo</h2>
            <p className="login-side-subtitle">Gestión de reservas, planes y clientes.</p>
          </div>
        </div>

        {/* Formulario */}
        <div className="login-main">
        <form className="login-card" onSubmit={handleLogin}>
          <h1 className="login-title">¡Bienvenido!</h1>
          <p className="login-desc">Ingresa tus credenciales para continuar</p>

          {error && <div className="login-error">{error}</div>}

          <div className="login-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
              placeholder="tucorreo@ejemplo.com"
              required
            />
          </div>

          <div className="login-group">
            <label htmlFor="password">Contraseña</label>
            <div className="login-password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                placeholder="Tu contraseña"
                required
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}

export default Login;