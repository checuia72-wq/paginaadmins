import {
  CalendarDays,
  Package,
  Users,
  UserCheck,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Clock,
  HeadphonesIcon,
  CheckCheck,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  useLiveDashboard,
  type Reserva,
  type Plan,
  type Cliente,
  type EtapaConversacion,
  type Participante,
} from "../hooks/useLiveDashboard";

/* tipos importados desde ../hooks/useLiveDashboard */

/* ─── helpers ───────────────────────────────────────────── */

/** Resuelve el nombre del plan desde el objeto reserva */
const getPlanDeReserva = (r: Reserva, planes: Plan[]): string => {
  // Si el join ya trae el objeto plan
  if (r.plan?.nombre_plan) return r.plan.nombre_plan;
  // Si el servicio lo aplana
  if (r.nombre_plan) return r.nombre_plan;
  // Buscar en el array local por id_plan
  if (r.id_plan) {
    const found = planes.find((p) => p.id_plan === r.id_plan);
    if (found) return found.nombre_plan;
  }
  return "—";
};

/** Obtiene el plan de un participante:
 *  1. Usa nombre_plan normalizado por getParticipantes() (join reserva→plan)
 *  2. Fallback: busca la reserva en el array local si el join no llegó
 */
const getPlanDeParticipante = (p: Participante, reservas: Reserva[], planes: Plan[]): string => {
  if (p.nombre_plan) return p.nombre_plan;
  if (!p.id_reserva) return "—";
  const reserva = reservas.find((r) => r.id_reserva === p.id_reserva);
  if (!reserva) return "—";
  return getPlanDeReserva(reserva, planes);
};

/** Estado basado en el booleano "aprobado" real de la BD */
const estadoBadge = (r: Reserva) => {
  if (r.aprobado === true)
    return <span className="badge badge-green">Aprobada</span>;
  return <span className="badge badge-yellow">Pendiente</span>;
};

/** Formatea la fecha desde fecha_solicitud o fecha_aprobacion */
const formatFecha = (r: Reserva): string => {
  const raw = r.fecha_solicitud ?? r.fecha_aprobacion;
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Precio real del plan: precio_plan o precio como fallback */
const getPrecio = (pl: Plan): string => {
  const val = pl.precio_plan ?? pl.precio;
  if (!val) return "—";
  return `$${Number(val).toLocaleString("es-CO")}`;
};

const avatar = (name?: string, color = "#334155") => {
  const initials = (name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className="avatar" style={{ background: color }}>
      {initials}
    </span>
  );
};

const AVATAR_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#06b6d4", "#f97316", "#6366f1",
];

/* ─── componente principal ──────────────────────────────── */
export default function OverviewPage() {
  const {
    reservas,
    planes,
    clientes,
    participantes,
    loading,
    refreshing,
    lastUpdated,
    refresh,
  } = useLiveDashboard({ intervalMs: 30_000 });

  /* stats derivados */
  const totalReservas      = reservas.length;
  const aprobadas          = reservas.filter((r) => r.aprobado === true).length;
  const pendientes         = reservas.filter((r) => !r.aprobado).length;
  const planesActivos      = planes.length;
  const totalClientes      = clientes.length;
  const totalParticipantes = participantes.length;
  const necesitanAtencion  = clientes.filter((c) => c.atencion_humana).length;

  // Conteo por etapa de conversación
  const ETAPAS: { key: EtapaConversacion; label: string; color: string; bg: string }[] = [
    { key: "saludo",            label: "Saludo",          color: "#6366f1", bg: "#eef2ff" },
    { key: "descripcionincluye",label: "Descripción",     color: "#3b82f6", bg: "#eff6ff" },
    { key: "como_reservar",     label: "Cómo reservar",   color: "#f59e0b", bg: "#fffbeb" },
    { key: "por_confirmar",     label: "Por confirmar",   color: "#f97316", bg: "#fff7ed" },
    { key: "confirmada",        label: "Confirmada",      color: "#22c55e", bg: "#f0fdf4" },
  ];
  const etapaCounts = ETAPAS.map((e) => ({
    ...e,
    count: clientes.filter((c) => c.etapaconversacion === e.key).length,
  }));
  const sinEtapa = clientes.filter((c) => !c.etapaconversacion).length;

  const ultimasReservas      = reservas.slice(0, 4);
  const ultimosClientes      = clientes.slice(0, 5);
  const ultimosParticipantes = participantes.slice(0, 5);

  if (loading) {
    return (
      <div className="overview-loading">
        <div className="spinner" />
        <p>Cargando resumen…</p>
      </div>
    );
  }

  return (
    <div className="overview">
      {/* encabezado */}
      <div className="overview-header">
        <div>
          <h1 className="overview-title">Resumen General</h1>
          <p className="overview-sub">
            Bienvenido al panel administrativo. Vista rápida de todas las secciones.
          </p>
        </div>
        <div className="live-status">
          <span className={`live-dot ${refreshing ? "live-dot-pulse" : "live-dot-on"}`} />
          <span className="live-label">
            {refreshing ? "Actualizando…" : "En vivo"}
          </span>
          {lastUpdated && (
            <span className="live-time">
              · {lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            className="live-refresh-btn"
            onClick={refresh}
            disabled={refreshing}
            title="Actualizar ahora"
          >
            <RefreshCw size={13} className={refreshing ? "spin-icon" : ""} />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <KpiCard icon={<CalendarDays size={20} />} label="Total Reservas"   value={totalReservas}      delta="+12%" color="blue"   />
        <KpiCard icon={<Package size={20} />}      label="Planes Activos"   value={planesActivos}      delta="+1"   color="amber"  />
        <KpiCard icon={<Users size={20} />}        label="Clientes"         value={totalClientes}      delta="+8"   color="violet" />
        <KpiCard icon={<UserCheck size={20} />}    label="Participantes"    value={totalParticipantes} delta="+5%"  color="teal"   />
      </div>

      {/* grid principal */}
      <div className="main-grid">

        {/* ── Reservas ── */}
        <section className="card">
          <div className="card-header">
            <div className="card-title-group">
              <CalendarDays size={16} className="card-icon blue" />
              <div>
                <h2 className="card-title">Reservas</h2>
                <p className="card-sub">Últimas reservas</p>
              </div>
            </div>
            <NavLink to="/app/reservas" className="see-all">
              Ver todas <ArrowRight size={14} />
            </NavLink>
          </div>

          <div className="mini-stats">
            <div className="mini-stat">
              <CheckCircle2 size={14} className="text-green-500" />
              <span className="mini-stat-val green">{aprobadas}</span>
              <span className="mini-stat-label">Aprobadas</span>
            </div>
            <div className="mini-stat">
              <Clock size={14} className="text-yellow-500" />
              <span className="mini-stat-val yellow">{pendientes}</span>
              <span className="mini-stat-label">Pendientes</span>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Plan</th>
                <th>Fecha solicitud</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ultimasReservas.length === 0 ? (
                <tr><td colSpan={5} className="empty-cell">Sin reservas</td></tr>
              ) : (
                ultimasReservas.map((r) => (
                  <tr key={r.id_reserva}>
                    <td className="id-cell">{r.id_reserva}</td>
                    <td>{r.telefono_cliente ?? "—"}</td>
                    <td>{getPlanDeReserva(r, planes)}</td>
                    <td>{formatFecha(r)}</td>
                    <td>{estadoBadge(r)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="card-footer">
            <TrendingUp size={12} className="text-green-500" />
            <span>+12% vs. mes anterior</span>
          </div>
        </section>

        {/* ── Planes ── */}
        <section className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Package size={16} className="card-icon amber" />
              <div>
                <h2 className="card-title">Planes</h2>
                <p className="card-sub">{planesActivos} planes activos</p>
              </div>
            </div>
            <NavLink to="/app/planes" className="see-all">
              Gestionar <ArrowRight size={14} />
            </NavLink>
          </div>

          <div className="planes-list">
            {planes.length === 0 ? (
              <p className="empty-text">Sin planes registrados</p>
            ) : (
              planes.slice(0, 6).map((pl, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                return (
                  <div key={pl.id_plan} className="plan-row">
                    <div className="plan-icon" style={{ background: color + "22", color }}>
                      <Package size={14} />
                    </div>
                    <span className="plan-name">{pl.nombre_plan}</span>
                    <span className="plan-price-right">{getPrecio(pl)}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── Clientes ── */}
        <section className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Users size={16} className="card-icon violet" />
              <div>
                <h2 className="card-title">Clientes</h2>
                <p className="card-sub">Clientes registrados</p>
              </div>
            </div>
            <NavLink to="/app/clientes" className="see-all">
              Ver todos <ArrowRight size={14} />
            </NavLink>
          </div>

          {/* KPI mini: total + necesitan atención */}
          <div className="client-stats">
            <div className="client-stat-block">
              <span className="csb-val">{totalClientes}</span>
              <span className="csb-label">Total</span>
            </div>
            {necesitanAtencion > 0 && (
              <div className="client-stat-block">
                <span className="csb-val" style={{ color: "#dc2626" }}>{necesitanAtencion}</span>
                <span className="csb-label">Necesitan atención</span>
              </div>
            )}
          </div>

          {/* Etapas de conversación: tabla con conteo por estado */}
          <div className="etapas-header">
            <span className="etapas-title">Estado de conversación</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Etapa</th>
                <th style={{ textAlign: "right" }}>Usuarios</th>
                <th style={{ textAlign: "right" }}>% del total</th>
              </tr>
            </thead>
            <tbody>
              {etapaCounts.map((e) => (
                <tr key={e.key}>
                  <td>
                    <span
                      className="etapa-badge"
                      style={{ background: e.bg, color: e.color }}
                    >
                      {e.label}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {e.count}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="etapa-bar-wrap">
                      <div className="etapa-bar-track">
                        <div
                          className="etapa-bar-fill"
                          style={{
                            width: totalClientes > 0 ? `${Math.round((e.count / totalClientes) * 100)}%` : "0%",
                            background: e.color,
                          }}
                        />
                      </div>
                      <span className="etapa-pct">
                        {totalClientes > 0 ? Math.round((e.count / totalClientes) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {sinEtapa > 0 && (
                <tr>
                  <td>
                    <span className="etapa-badge" style={{ background: "#f1f5f9", color: "#94a3b8" }}>
                      Sin etapa
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{sinEtapa}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="etapa-bar-wrap">
                      <div className="etapa-bar-track">
                        <div
                          className="etapa-bar-fill"
                          style={{
                            width: totalClientes > 0 ? `${Math.round((sinEtapa / totalClientes) * 100)}%` : "0%",
                            background: "#94a3b8",
                          }}
                        />
                      </div>
                      <span className="etapa-pct">
                        {totalClientes > 0 ? Math.round((sinEtapa / totalClientes) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="card-footer">
            <TrendingUp size={12} className="text-green-500" />
            <span>+8 nuevos en los últimos 7 días</span>
          </div>
        </section>

        {/* ── Participantes ── */}
        <section className="card">
          <div className="card-header">
            <div className="card-title-group">
              <UserCheck size={16} className="card-icon teal" />
              <div>
                <h2 className="card-title">Participantes</h2>
                <p className="card-sub">Lista de participantes</p>
              </div>
            </div>
            <NavLink to="/app/participantes" className="see-all">
              Ver todos <ArrowRight size={14} />
            </NavLink>
          </div>

          <div className="client-stats">
            <div className="client-stat-block">
              <span className="csb-val">{totalParticipantes}</span>
              <span className="csb-label">Total</span>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Plan (vía reserva)</th>
                <th>Reserva</th>
              </tr>
            </thead>
            <tbody>
              {ultimosParticipantes.length === 0 ? (
                <tr><td colSpan={3} className="empty-cell">Sin participantes</td></tr>
              ) : (
                ultimosParticipantes.map((p, i) => (
                  <tr key={p.id_participante}>
                    <td>
                      <div className="flex items-center gap-2">
                        {avatar(p.nombre, AVATAR_COLORS[i % AVATAR_COLORS.length])}
                        <span>{p.nombre ?? "—"}</span>
                      </div>
                    </td>
                    <td>{getPlanDeParticipante(p, reservas, planes)}</td>
                    <td className="id-cell">{p.id_reserva ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

      </div>
    </div>
  );
}

/* ─── KpiCard ────────────────────────────────────────────── */
function KpiCard({
  icon, label, value, delta, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  delta: string;
  color: "blue" | "amber" | "violet" | "teal";
}) {
  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className={`kpi-icon-wrap kpi-icon-${color}`}>{icon}</div>
      <div className="kpi-body">
        <p className="kpi-label">{label}</p>
        <p className="kpi-value">{value}</p>
      </div>
      <div className="kpi-delta">
        <TrendingUp size={12} />
        {delta}
      </div>
    </div>
  );
}