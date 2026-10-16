import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Pencil, RefreshCw, UserPlus, UsersRound } from "lucide-react";
import {
  createManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUserProfile,
  type ManagedUser,
  type ManagedUserRole,
} from "../../services/adminUsers.service";

const roleLabel = (role: string) => {
  if (role === "administrador") return "Administrador";
  if (role === "atencion") return "Atención";
  if (role === "coordinador") return "Coordinador";
  if (role === "guia") return "Guía";
  return role || "—";
};

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
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagedUserRole>("guia");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
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
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
      setError("El nombre de usuario debe tener entre 3 y 30 caracteres y solo usar letras minúsculas, números, punto, guion o guion bajo.");
      return;
    }

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
      await createManagedUser(cleanUsername, cleanEmail, password, role);
      setSuccess(`Usuario ${cleanUsername} (${cleanEmail}) creado como ${roleLabel(role)}. La contraseña fue establecida correctamente.`);
      setUsername("");
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

  const saveProfile = async () => {
    if (!editUser) return;

    const cleanUsername = editUsername.trim().toLowerCase();
    const cleanEmail = editEmail.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
      setError("El nombre de usuario debe tener entre 3 y 30 caracteres y solo usar letras minúsculas, números, punto, guion o guion bajo.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }

    setEditingProfile(true);
    setError("");
    setSuccess("");
    try {
      await updateManagedUserProfile(editUser.user_id, cleanUsername, cleanEmail);
      setSuccess(`Perfil de @${cleanUsername} actualizado correctamente.`);
      setEditUser(null);
      setEditUsername("");
      setEditEmail("");
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible actualizar el perfil.");
    } finally {
      setEditingProfile(false);
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
          Crea cuentas personales para cualquier rol del sistema. Por seguridad, Supabase no permite recuperar una contraseña existente:
          puedes definirla al crear la cuenta y, si se pierde, establecer una nueva desde aquí.
        </p>

        <div className="snack-user-form">
          <label>
            Nombre de usuario *
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30))}
              placeholder="ej. juan.perez"
              autoComplete="off"
            />
            <small>3 a 30 caracteres. Letras minúsculas, números, punto, guion o guion bajo.</small>
          </label>

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
              <option value="administrador">Administrador</option>
              <option value="atencion">Atención</option>
              <option value="coordinador">Coordinador</option>
              <option value="guia">Guía</option>
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
          <div><UsersRound size={18} /><strong>Usuarios del sistema</strong></div>
          <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin-icon" : ""} />
            Actualizar
          </button>
        </div>

        <div className="snack-table-wrap">
          <table className="snack-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Creado</th>
                <th>Último ingreso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="snack-empty">Cargando usuarios…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="snack-empty">Todavía no hay usuarios registrados.</td></tr>
              ) : users.map((user) => (
                <tr key={user.user_id}>
                  <td><strong>@{user.username || "sin-usuario"}</strong></td>
                  <td>{user.email}</td>
                  <td>{roleLabel(user.role)}</td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>{formatDate(user.last_sign_in_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="snack-btn secondary"
                        onClick={() => {
                          setEditUser(user);
                          setEditUsername(user.username || "");
                          setEditEmail(user.email || "");
                          setError("");
                          setSuccess("");
                        }}
                      >
                        <Pencil size={15} /> Editar perfil
                      </button>

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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editUser && (
        <div className="snack-modal-backdrop" onMouseDown={() => !editingProfile && setEditUser(null)}>
          <div className="snack-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="snack-card-title">
              <div><Pencil size={18} /><strong>Editar perfil</strong></div>
              <span>{editUser.email}</span>
            </div>

            <label className="snack-payment-label">
              Nombre de usuario *
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30))}
                placeholder="ej. juan.perez"
                autoComplete="off"
                disabled={editingProfile}
              />
              <small>3 a 30 caracteres. Debe ser único.</small>
            </label>

            <label className="snack-payment-label">
              Correo electrónico *
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="persona@empresa.com"
                autoComplete="off"
                disabled={editingProfile}
              />
            </label>

            <div className="snack-modal-actions">
              <button
                className="snack-btn secondary"
                disabled={editingProfile}
                onClick={() => setEditUser(null)}
              >
                Cancelar
              </button>
              <button
                className="snack-btn primary"
                disabled={editingProfile}
                onClick={saveProfile}
              >
                <Pencil size={15} /> {editingProfile ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

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
