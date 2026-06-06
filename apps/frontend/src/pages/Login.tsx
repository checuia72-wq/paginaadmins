import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff } from "lucide-react";
import "../styles/login.css";

const DEMO_SESSION_KEY = "forigua:demo_session";
const REMEMBER_ME_KEY = "forigua:remember_me";
const SAVED_EMAIL_KEY = "forigua:saved_email";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    const savedRememberMe = localStorage.getItem(REMEMBER_ME_KEY) === "true";
    if (savedRememberMe && savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

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

      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setError("Por favor, verifica tu correo electrónico antes de iniciar sesión.");
        return;
      }

      if (data.session) {
        if (rememberMe) {
          localStorage.setItem(SAVED_EMAIL_KEY, email);
          localStorage.setItem(REMEMBER_ME_KEY, "true");
        } else {
          localStorage.removeItem(SAVED_EMAIL_KEY);
          localStorage.removeItem(REMEMBER_ME_KEY);
        }

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

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Por favor, ingresa tu correo electrónico primero.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!supabase) {
        setError("Supabase no está configurado.");
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage("Se ha enviado un correo para restablecer tu contraseña.");
      }
    } catch {
      setError("Ocurrió un error al intentar enviar el correo de recuperación.");
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
          {message && <div className="login-message">{message}</div>}

          <div className="login-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null); if (message) setMessage(null); }}
              placeholder="tucorreo@ejemplo.com"
              required
            />
          </div>

          <div className="login-group">
            <div className="login-label-row">
              <label htmlFor="password">Contraseña</label>
              <button
                type="button"
                className="login-forgot-link"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="login-password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(null); if (message) setMessage(null); }}
                placeholder="Tu contraseña"
                required={!message}
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

          <div className="login-options">
            <label className="login-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Recordar cuenta</span>
            </label>
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