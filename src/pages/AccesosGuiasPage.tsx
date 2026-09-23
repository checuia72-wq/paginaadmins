import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Store, TicketCheck } from "lucide-react";
import {
  listGuideSalesAccess,
  setGuideSalesAccess,
  type GuideSalesAccessRow,
} from "../services/guideSalesAccess.service";
import { getCurrentRole } from "../services/role.service";
import UserManagementPanel from "../components/admin/UserManagementPanel";
import "../styles/snacks.css";

export default function AccesosGuiasPage() {
  const [guides, setGuides] = useState<GuideSalesAccessRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setGuides(await listGuideSalesAccess());
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar los guías.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    getCurrentRole()
      .then((current) => setIsAdmin(current?.role === "administrador"))
      .catch(() => setIsAdmin(false));
  }, []);

  const toggle = async (
    guide: GuideSalesAccessRow,
    location: "taquilla_1" | "enclave",
    enabled: boolean,
  ) => {
    const key = `${guide.user_id}:${location}`;
    setSavingKey(key);
    setError("");
    setSuccess("");
    try {
      await setGuideSalesAccess(guide.user_id, location, enabled);
      setGuides((current) => current.map((item) =>
        item.user_id === guide.user_id
          ? { ...item, [location]: enabled }
          : item,
      ));
      setSuccess(
        `${enabled ? "Venta habilitada" : "Venta deshabilitada"} para ${guide.email} en ${location === "taquilla_1" ? "Taquilla 1" : "Enclave"}.`,
      );
    } catch (e: any) {
      setError(e?.message || "No fue posible actualizar el acceso del guía.");
    } finally {
      setSavingKey("");
    }
  };

  return (
    <div className="snack-page">
      <div className="snack-page-head">
        <div>
          <h1>Accesos de ventas para guías</h1>
          <p>Habilita de forma individual qué guía puede vender en Taquilla 1, Enclave o ambos puntos.</p>
        </div>
        <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="snack-alert error">{error}</div>}
      {success && <div className="snack-alert success">{success}</div>}

      <div className="snack-kpis">
        <div><span>Guías registrados</span><b>{guides.length}</b></div>
        <div><span>Con Taquilla 1</span><b>{guides.filter((g) => g.taquilla_1).length}</b></div>
        <div><span>Con Enclave</span><b>{guides.filter((g) => g.enclave).length}</b></div>
        <div><span>Sin ventas habilitadas</span><b>{guides.filter((g) => !g.taquilla_1 && !g.enclave).length}</b></div>
      </div>

      {isAdmin && <UserManagementPanel />}

      <section className="snack-card">
        <div className="snack-card-title">
          <div><ShieldCheck size={18} /><strong>Permisos por persona</strong></div>
          <span>Los cambios aplican inmediatamente</span>
        </div>

        <div className="snack-table-wrap">
          <table className="snack-table">
            <thead>
              <tr>
                <th>Guía</th>
                <th><TicketCheck size={14} /> Taquilla 1</th>
                <th><Store size={14} /> Enclave</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="snack-empty">Cargando guías…</td></tr>
              ) : guides.length === 0 ? (
                <tr><td colSpan={4} className="snack-empty">No hay usuarios con rol guía. Crea la cuenta y asígnale el rol guia para que aparezca aquí.</td></tr>
              ) : guides.map((guide) => (
                <tr key={guide.user_id}>
                  <td><strong>{guide.email || guide.user_id}</strong></td>
                  <td>
                    <label className="snack-check">
                      <input
                        type="checkbox"
                        checked={guide.taquilla_1}
                        disabled={savingKey === `${guide.user_id}:taquilla_1`}
                        onChange={(e) => toggle(guide, "taquilla_1", e.target.checked)}
                      />
                      {guide.taquilla_1 ? "Habilitado" : "Sin acceso"}
                    </label>
                  </td>
                  <td>
                    <label className="snack-check">
                      <input
                        type="checkbox"
                        checked={guide.enclave}
                        disabled={savingKey === `${guide.user_id}:enclave`}
                        onChange={(e) => toggle(guide, "enclave", e.target.checked)}
                      />
                      {guide.enclave ? "Habilitado" : "Sin acceso"}
                    </label>
                  </td>
                  <td>
                    <span className={`snack-status ${guide.taquilla_1 || guide.enclave ? "active" : "inactive"}`}>
                      {guide.taquilla_1 && guide.enclave
                        ? "Ambos puntos"
                        : guide.taquilla_1
                          ? "Solo Taquilla 1"
                          : guide.enclave
                            ? "Solo Enclave"
                            : "Sin ventas"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
