import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff, User, Lock, ArrowRight, ShieldCheck, Mountain } from "lucide-react";
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
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        if (resetError.message.includes("rate limit")) {
          setError("Has intentado restablecer tu contraseña demasiadas veces. Por favor, espera una hora antes de intentarlo de nuevo.");
        } else {
          setError(resetError.message);
        }
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
        {/* Panel lateral con textos descriptivos */}
        <div className="login-side">
          <img src="/logo.png" alt="Logo Checua" className="login-logo-main" />
          <h2 className="login-side-title">Desierto de Checua</h2>
          <div className="login-ornament">
            <Mountain size={24} />
          </div>
          <p className="login-side-subtitle">
            Portal de Gestión Administrativa y Conservación Ambiental.
          </p>
          <div className="login-ornament">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-cactus">
              <path d="M8 22V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v14"/>
              <path d="M12 12h2a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h0"/>
              <path d="M8 10H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h0"/>
            </svg>
          </div>
          <p className="login-footer-text">
            Cuidamos nuestro patrimonio, protegemos el futuro.
          </p>
        </div>

        {/* Formulario de Login */}
        <div className="login-main">
          <form className="login-card" onSubmit={handleLogin}>
            <div className="login-card-header">
              <img src="/icono.png" alt="Icono Checua" className="login-header-logo" />
              <h1 className="login-title">Bienvenido de nuevo</h1>
              <p className="login-desc">Ingresa a tu cuenta para continuar</p>
            </div>

            <div className="login-separator">
              <div className="login-separator-diamond"></div>
            </div>

            {error && <div className="login-error">{error}</div>}
            {message && <div className="login-message">{message}</div>}

            <div className="login-group">
              <label htmlFor="email">Usuario</label>
              <div className="login-input-wrapper">
                <User size={18} className="login-input-icon" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(null); if (message) setMessage(null); }}
                  placeholder="nombre.apellido@ejemplo.com"
                  required
                />
              </div>
            </div>

            <div className="login-group">
              <label htmlFor="password">Contraseña</label>
              <div className="login-password-wrap">
                <div className="login-input-wrapper">
                  <Lock size={18} className="login-input-icon" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(null); if (message) setMessage(null); }}
                    placeholder="••••••••"
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
            </div>

            <div className="login-options">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Recordarme</span>
              </label>
              <button
                type="button"
                className="login-forgot-link"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? "Ingresando..." : (
                <>
                  Iniciar Sesión <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="login-card-footer">
              <ShieldCheck size={20} className="login-footer-icon" />
              <p className="login-footer-desc">
                Seguridad, gestión y conservación al servicio de nuestro desierto.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;