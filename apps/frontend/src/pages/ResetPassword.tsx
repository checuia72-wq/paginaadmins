import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff, Lock } from "lucide-react";
import "../styles/login.css";

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase maneja automáticamente la sesión desde el hash de la URL
    // al cargar la página si el cliente está inicializado.
    const checkSession = async () => {
      const { data } = await supabase?.auth.getSession() || {};
      if (!data?.session) {
        // Si no hay sesión (token inválido o expirado), redirigir al login
        // Pero damos un pequeño margen por si el hash tarda en procesarse
      }
    };
    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      if (!supabase) {
        setError("Supabase no está configurado.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage("Contraseña actualizada con éxito. Redirigiendo al inicio de sesión...");
        setTimeout(() => {
          navigate("/");
        }, 3000);
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-layout" style={{ gridTemplateColumns: "1fr" }}>
        <div className="login-main">
          <form className="login-card" onSubmit={handleResetPassword}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <div style={{ background: "var(--lg-violet)", padding: "12px", borderRadius: "12px", color: "white" }}>
                <Lock size={32} />
              </div>
            </div>
            
            <h1 className="login-title" style={{ textAlign: "center" }}>Nueva contraseña</h1>
            <p className="login-desc" style={{ textAlign: "center" }}>Ingresa tu nueva contraseña para recuperar el acceso</p>

            {error && <div className="login-error">{error}</div>}
            {message && <div className="login-message">{message}</div>}

            <div className="login-group">
              <label htmlFor="password">Nueva contraseña</label>
              <div className="login-password-wrap">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="login-group">
              <label htmlFor="confirmPassword">Confirmar contraseña</label>
              <div className="login-password-wrap">
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading || !!message}>
              {loading ? "Actualizando..." : "Restablecer contraseña"}
            </button>
            
            <button 
              type="button" 
              className="login-forgot-link" 
              style={{ marginTop: "16px", textAlign: "center", width: "100%" }}
              onClick={() => navigate("/")}
            >
              Volver al inicio de sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
