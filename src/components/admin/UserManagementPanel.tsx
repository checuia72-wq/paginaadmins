import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, RefreshCw, UserPlus, UsersRound } from "lucide-react";
import {
  createManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  type ManagedUser,
  type ManagedUserRole,
} from "../../services/adminUsers.service";

const formatDate = (value?: string | null) => {
  if (!value) return "Nunca";
  try {
    return new Date(value).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
};

export default function UserManagementPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagedUserRole>("guia");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setUsers(await listManagedUsers());
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar los usuarios.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createUser = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await createManagedUser(cleanEmail, password, role);
      setSuccess(`Usuario ${cleanEmail} creado como ${role === "guia" ? "Guía" : "Coordinador"}. La contraseña fue establecida correctamente.`);
      setEmail("");
      setPassword("");
      setRole("guia");
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible crear el usuario.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!resetUser) return;
    if (resetPassword.length < 8) {
      setError("La nueva contraseña debe tener mínimo 8 caracteres.");
      return;
    }

    setResetting(true);
    setError("");
    setSuccess("");
    try {
      await resetManagedUserPassword(resetUser.user_id, resetPassword);
      setSuccess(`Contraseña actualizada para ${resetUser.email}.`);
      setResetUser(null);
      setResetPassword("");
      setShowResetPassword(false);
    } catch (e: any) {
      setError(e?.message || "No fue posible cambiar la contraseña.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <section className="snack-card">
        <div className="snack-card-title">
          <div><UserPlus size={18} /><strong>Crear usuario</strong></div>
          <span>Solo Administración</span>
        </div>

        <p className="snack-admin-note">
          Crea cuentas personales para guías y coordinadores. Por seguridad, Supabase no permite recuperar una contraseña existente:
          puedes definirla al crear la cuenta y, si se pierde, establecer una nueva desde aquí.
        </p>

        <div className="snack-user-form">
          <label>
            Correo electrónico *
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@empresa.com"
              autoComplete="off"
            />
          </label>

          <label>
            Rol *
            <select value={role} onChange={(e) => setRole(e.target.value as ManagedUserRole)}>
              <option value="guia">Guía</option>
              <option value="coordinador">Coordinador</option>
            </select>
          </label>

          <label>
            Contraseña *
            <div className="snack-password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          <button className="snack-btn primary" disabled={saving} onClick={createUser}>
            <UserPlus size={16} />
            {saving ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </section>

      <section className="snack-card">
        <div className="snack-card-title">
          <div><UsersRound size={18} /><strong>Usuarios de guías y coordinadores</strong></div>
          <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin-icon" : ""} />
            Actualizar
          </button>
        </div>

        <div className="snack-table-wrap">
          <table className="snack-table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Rol</th>
                <th>Creado</th>
                <th>Último ingreso</th>
                <th>Seguridad</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="snack-empty">Cargando usuarios…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="snack-empty">Todavía no hay guías o coordinadores registrados.</td></tr>
              ) : users.map((user) => (
                <tr key={user.user_id}>
                  <td><strong>{user.email}</strong></td>
                  <td>{user.role === "guia" ? "Guía" : user.role === "coordinador" ? "Coordinador" : user.role || "—"}</td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>{formatDate(user.last_sign_in_at)}</td>
                  <td>
                    <button
                      className="snack-btn secondary"
                      onClick={() => {
                        setResetUser(user);
                        setResetPassword("");
                        setShowResetPassword(false);
                        setError("");
                        setSuccess("");
                      }}
                    >
                      <KeyRound size={15} /> Cambiar contraseña
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {resetUser && (
        <div className="snack-modal-backdrop" onMouseDown={() => !resetting && setResetUser(null)}>
          <div className="snack-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="snack-card-title">
              <div><KeyRound size={18} /><strong>Nueva contraseña</strong></div>
              <span>{resetUser.email}</span>
            </div>

            <label className="snack-payment-label">
              Nueva contraseña *
              <div className="snack-password-field">
                <input
                  type={showResetPassword ? "text" : "password"}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowResetPassword((value) => !value)}>
                  {showResetPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <div className="snack-modal-actions">
              <button className="snack-btn secondary" disabled={resetting} onClick={() => setResetUser(null)}>Cancelar</button>
              <button className="snack-btn primary" disabled={resetting} onClick={changePassword}>
                <KeyRound size={15} /> {resetting ? "Actualizando…" : "Cambiar contraseña"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="snack-alert error">{error}</div>}
      {success && <div className="snack-alert success">{success}</div>}
    </>
  );
}
