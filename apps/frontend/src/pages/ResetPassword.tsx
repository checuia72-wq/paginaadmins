import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff, Lock, ArrowRight, ShieldCheck } from "lucide-react";
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
    const checkSession = async () => {
      const { data } = await supabase?.auth.getSession() || {};
      if (!data?.session) {
        // Redirección opcional si no hay sesión
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
      <div className="login-layout" style={{ gridTemplateColumns: "1fr", maxWidth: "450px" }}>
        <div className="login-main">
          <form className="login-card" onSubmit={handleResetPassword}>
            <div className="login-card-header">
              <img src="/icono.png" alt="Icono Checua" className="login-header-logo" />
              <h1 className="login-title">Nueva contraseña</h1>
              <p className="login-desc">Ingresa tu nueva contraseña para recuperar el acceso</p>
            </div>

            <div className="login-separator">
              <div className="login-separator-diamond"></div>
            </div>

            {error && <div className="login-error">{error}</div>}
            {message && <div className="login-message">{message}</div>}

            <div className="login-group">
              <label htmlFor="password">Nueva contraseña</label>
              <div className="login-password-wrap">
                <div className="login-input-wrapper">
                  <Lock size={18} className="login-input-icon" />
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
            </div>

            <div className="login-group">
              <label htmlFor="confirmPassword">Confirmar contraseña</label>
              <div className="login-password-wrap">
                <div className="login-input-wrapper">
                  <Lock size={18} className="login-input-icon" />
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
            </div>

            <button type="submit" className="login-submit" disabled={loading || !!message}>
              {loading ? "Actualizando..." : (
                <>
                  Restablecer contraseña <ArrowRight size={18} />
                </>
              )}
            </button>
            
            <button 
              type="button" 
              className="login-forgot-link" 
              style={{ textAlign: "center", width: "100%", fontSize: "14px" }}
              onClick={() => navigate("/")}
            >
              Volver al inicio de sesión
            </button>

            <div className="login-card-footer" style={{ marginTop: "30px" }}>
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

export default ResetPassword;
