import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, HandCoins, RefreshCw } from "lucide-react";
import {
  confirmCashHandover,
  createCashHandover,
  getMyCashBalance,
  listCashCoordinators,
  listCashHandovers,
  type CashBalance,
  type CashCoordinator,
  type CashHandover,
} from "../services/cashHandover.service";
import { getCurrentRole, type AppRole } from "../services/role.service";
import "../styles/snacks.css";

const EMPTY_BALANCE: CashBalance = {
  efectivo_pendiente: 0,
  efectivo_hoy: 0,
  ventas_hoy: 0,
  ventas_efectivo_total: 0,
  entregas_registradas: 0,
};

const money = (value: number) => `$${Math.round(Number(value || 0)).toLocaleString("es-CO")}`;

const dateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  });
};

export default function EntregaEfectivoPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [balance, setBalance] = useState<CashBalance>(EMPTY_BALANCE);
  const [coordinators, setCoordinators] = useState<CashCoordinator[]>([]);
  const [handovers, setHandovers] = useState<CashHandover[]>([]);
  const [coordinatorId, setCoordinatorId] = useState("");
  const [observation, setObservation] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const current = await getCurrentRole();
      setRole(current?.role ?? null);

      const promises: Promise<any>[] = [listCashHandovers()];
      if (current?.role === "guia") {
        promises.push(getMyCashBalance(), listCashCoordinators());
      }

      const results = await Promise.all(promises);
      setHandovers(results[0] ?? []);

      if (current?.role === "guia") {
        setBalance(results[1] ?? EMPTY_BALANCE);
        const coordList = results[2] ?? [];
        setCoordinators(coordList);
        setCoordinatorId((currentValue) =>
          coordList.some((item: CashCoordinator) => item.user_id === currentValue)
            ? currentValue
            : (coordList[0]?.user_id ?? ""),
        );
      }
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar las entregas de efectivo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30000);
    const refresh = () => void load(true);
    window.addEventListener("snack-cash-handover-changed", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("snack-cash-handover-changed", refresh);
    };
  }, [load]);

  const pendingToConfirm = useMemo(
    () => handovers.filter((item) => item.estado === "pendiente"),
    [handovers],
  );

  const submit = async () => {
    if (!coordinatorId) {
      setError("Selecciona el coordinador que recibirá el efectivo.");
      return;
    }
    if (balance.efectivo_pendiente <= 0) {
      setError("No tienes efectivo pendiente por entregar.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result: any = await createCashHandover(coordinatorId, observation);
      setSuccess(`Entrega registrada por ${money(Number(result?.monto ?? balance.efectivo_pendiente))}. El coordinador debe confirmar que recibió el dinero.`);
      setObservation("");
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible registrar la entrega.");
    } finally {
      setSaving(false);
    }
  };

  const confirm = async (item: CashHandover) => {
    setConfirmingId(item.id_entrega);
    setError("");
    setSuccess("");
    try {
      await confirmCashHandover(item.id_entrega);
      setSuccess(`Recepción confirmada: ${money(item.monto)} entregados por ${item.guia_email}.`);
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible confirmar la entrega.");
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="snack-page">
      <div className="snack-page-head">
        <div>
          <h1>Entrega de efectivo</h1>
          <p>Trazabilidad del efectivo recibido en ventas de snacks y entregado de los guías a coordinación.</p>
        </div>
        <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="snack-alert error">{error}</div>}
      {success && <div className="snack-alert success">{success}</div>}

      {role === "guia" && (
        <>
          <div className="snack-kpis">
            <div><span>Efectivo pendiente</span><b>{money(balance.efectivo_pendiente)}</b></div>
            <div><span>Efectivo vendido hoy</span><b>{money(balance.efectivo_hoy)}</b></div>
            <div><span>Ventas en efectivo hoy</span><b>{balance.ventas_hoy}</b></div>
            <div><span>Entregas registradas</span><b>{balance.entregas_registradas}</b></div>
          </div>

          <section className="snack-card">
            <div className="snack-card-title">
              <div><HandCoins size={18} /><strong>Entregar efectivo a coordinación</strong></div>
              <span>Se entrega todo el efectivo pendiente</span>
            </div>

            <div className="snack-cash-form">
              <label>
                Coordinador que recibe *
                <select value={coordinatorId} onChange={(e) => setCoordinatorId(e.target.value)}>
                  <option value="">Seleccionar coordinador</option>
                  {coordinators.map((item) => (
                    <option key={item.user_id} value={item.user_id}>{item.email}</option>
                  ))}
                </select>
              </label>

              <label>
                Valor a entregar
                <input value={money(balance.efectivo_pendiente)} readOnly />
              </label>

              <label className="wide-field">
                Observación
                <input value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Ej. Cierre jornada tarde" />
              </label>

              <button className="snack-btn primary" onClick={submit} disabled={saving || balance.efectivo_pendiente <= 0 || !coordinatorId}>
                <Banknote size={16} /> {saving ? "Registrando…" : "Registrar entrega"}
              </button>
            </div>
          </section>
        </>
      )}

      {(role === "coordinador" || role === "administrador") && pendingToConfirm.length > 0 && (
        <section className="snack-card">
          <div className="snack-card-title">
            <div><Banknote size={18} /><strong>Entregas pendientes por confirmar</strong></div>
            <span>{pendingToConfirm.length}</span>
          </div>

          <div className="snack-table-wrap">
            <table className="snack-table">
              <thead><tr><th>Fecha</th><th>Guía</th><th>Coordinador</th><th>Ventas</th><th>Monto</th><th>Acción</th></tr></thead>
              <tbody>
                {pendingToConfirm.map((item) => (
                  <tr key={item.id_entrega}>
                    <td>{dateTime(item.created_at)}</td>
                    <td><strong>{item.guia_email}</strong></td>
                    <td>{item.coordinador_email}</td>
                    <td>{item.cantidad_ventas}</td>
                    <td><strong>{money(item.monto)}</strong></td>
                    <td>
                      <button className="snack-btn primary" disabled={confirmingId === item.id_entrega} onClick={() => confirm(item)}>
                        <CheckCircle2 size={15} /> {confirmingId === item.id_entrega ? "Confirmando…" : "Confirmar recibido"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="snack-card">
        <div className="snack-card-title">
          <div><HandCoins size={18} /><strong>Historial de entregas</strong></div>
          <span>{handovers.length} registros</span>
        </div>

        <div className="snack-table-wrap">
          <table className="snack-table">
            <thead>
              <tr><th>Fecha</th><th>Guía</th><th>Recibe</th><th>Ventas</th><th>Monto</th><th>Estado</th><th>Confirmado</th><th>Observación</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="snack-empty">Cargando entregas…</td></tr>
              ) : handovers.length === 0 ? (
                <tr><td colSpan={8} className="snack-empty">Todavía no hay entregas de efectivo registradas.</td></tr>
              ) : handovers.map((item) => (
                <tr key={item.id_entrega}>
                  <td>{dateTime(item.created_at)}</td>
                  <td><strong>{item.guia_email}</strong></td>
                  <td>{item.coordinador_email}</td>
                  <td>{item.cantidad_ventas}</td>
                  <td><strong>{money(item.monto)}</strong></td>
                  <td><span className={`snack-status ${item.estado === "confirmada" ? "active" : "inactive"}`}>{item.estado === "confirmada" ? "Confirmada" : "Pendiente"}</span></td>
                  <td>{dateTime(item.confirmado_at)}</td>
                  <td>{item.observacion || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
