import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Package,
  Percent,
  RefreshCw,
  Trophy,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  getDashboardAnalytics,
  type DashboardAnalyticsData,
  type DashboardPlan,
  type DashboardReserva,
} from "../services/dashboardAnalytics.service";
import "../styles/overview-crm.css";

const EMPTY_DATA: DashboardAnalyticsData = {
  reservas: [],
  planes: [],
  clientes: [],
  participantes: [],
};

const money = (value: number) => `$${Math.round(value || 0).toLocaleString("es-CO")}`;
const pct = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

function monthKey(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
}

function planName(r: DashboardReserva, planes: DashboardPlan[]) {
  return r.plan?.nombre_plan || planes.find((p) => p.id_plan === r.id_plan)?.nombre_plan || `Plan #${r.id_plan ?? "—"}`;
}

function totalReserva(r: DashboardReserva, planes: DashboardPlan[]) {
  const total = Number(r.valor_total || 0);
  if (total > 0) return total;
  const cantidad = Math.max(1, Number(r.cantidad_personas || 1));
  const unitario = Number(r.precio_unitario || 0);
  if (unitario > 0) return unitario * cantidad;
  const precioPlan = Number(r.plan?.precio_plan || planes.find((p) => p.id_plan === r.id_plan)?.precio_plan || 0);
  return precioPlan * cantidad;
}

function cobradoReserva(r: DashboardReserva) {
  return Number(r.valor_abonado || 0) + Number(r.valor_saldo_pagado || 0);
}

function growth(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export default function OverviewPage() {
  const [data, setData] = useState<DashboardAnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const result = await getDashboardAnalytics();
      setData(result);
      setLastUpdated(new Date());
    } catch (e: any) {
      console.error("[CRM Dashboard]", e);
      setError(e?.message || "No fue posible cargar el resumen comercial.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("crm-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reserva" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "plan" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "cliente" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "participante" }, () => load(true))
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [load]);

  const metrics = useMemo(() => {
    const { reservas, planes, clientes, participantes } = data;
    const aprobadas = reservas.filter((r) => r.aprobado === true);
    const pendientes = reservas.filter((r) => !r.aprobado);
    const ventasTotal = aprobadas.reduce((sum, r) => sum + totalReserva(r, planes), 0);
    const totalCobrado = aprobadas.reduce((sum, r) => sum + cobradoReserva(r), 0);
    const cartera = Math.max(0, ventasTotal - totalCobrado);
    const ticketPromedio = aprobadas.length ? ventasTotal / aprobadas.length : 0;
    const conversion = reservas.length ? (aprobadas.length / reservas.length) * 100 : 0;
    const ocupacionVendida = aprobadas.reduce((sum, r) => sum + Number(r.cantidad_personas || 0), 0);

    const now = new Date();
    const currentKey = monthKey(now.toISOString())!;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousKey = monthKey(prev.toISOString())!;
    const currentApproved = aprobadas.filter((r) => monthKey(r.fecha_aprobacion) === currentKey);
    const previousApproved = aprobadas.filter((r) => monthKey(r.fecha_aprobacion) === previousKey);
    const currentRevenue = currentApproved.reduce((sum, r) => sum + totalReserva(r, planes), 0);
    const previousRevenue = previousApproved.reduce((sum, r) => sum + totalReserva(r, planes), 0);
    const revenueGrowth = growth(currentRevenue, previousRevenue);

    const months = Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = monthKey(d.toISOString())!;
      const rows = aprobadas.filter((r) => monthKey(r.fecha_aprobacion) === key);
      return {
        key,
        label: monthLabel(d),
        ventas: rows.length,
        personas: rows.reduce((sum, r) => sum + Number(r.cantidad_personas || 0), 0),
        ingresos: rows.reduce((sum, r) => sum + totalReserva(r, planes), 0),
      };
    });

    const planMap = new Map<number, {
      id: number;
      nombre: string;
      reservas: number;
      personas: number;
      ingresos: number;
      cobrado: number;
    }>();

    for (const plan of planes) {
      planMap.set(plan.id_plan, { id: plan.id_plan, nombre: plan.nombre_plan, reservas: 0, personas: 0, ingresos: 0, cobrado: 0 });
    }
    for (const r of aprobadas) {
      if (!r.id_plan) continue;
      const current = planMap.get(r.id_plan) || {
        id: r.id_plan,
        nombre: planName(r, planes),
        reservas: 0,
        personas: 0,
        ingresos: 0,
        cobrado: 0,
      };
      current.reservas += 1;
      current.personas += Number(r.cantidad_personas || 0);
      current.ingresos += totalReserva(r, planes);
      current.cobrado += cobradoReserva(r);
      planMap.set(r.id_plan, current);
    }

    const ranking = [...planMap.values()]
      .map((p) => ({
        ...p,
        participacion: ventasTotal > 0 ? (p.ingresos / ventasTotal) * 100 : 0,
        ticket: p.reservas ? p.ingresos / p.reservas : 0,
      }))
      .sort((a, b) => b.ingresos - a.ingresos || b.reservas - a.reservas);

    const mejorPlan = ranking.find((p) => p.reservas > 0) || null;

    const efectivo = aprobadas.reduce((sum, r) => {
      let value = 0;
      if (r.metodo_pago_abono === "efectivo") value += Number(r.valor_abonado || 0);
      if (r.metodo_pago_saldo === "efectivo") value += Number(r.valor_saldo_pagado || 0);
      return sum + value;
    }, 0);
    const transferencia = aprobadas.reduce((sum, r) => {
      let value = 0;
      if (r.metodo_pago_abono === "transferencia") value += Number(r.valor_abonado || 0);
      if (r.metodo_pago_saldo === "transferencia") value += Number(r.valor_saldo_pagado || 0);
      return sum + value;
    }, 0);

    return {
      totalReservas: reservas.length,
      aprobadas: aprobadas.length,
      pendientes: pendientes.length,
      ventasTotal,
      totalCobrado,
      cartera,
      ticketPromedio,
      conversion,
      ocupacionVendida,
      totalClientes: clientes.length,
      participantes: participantes.length,
      requierenAtencion: clientes.filter((c) => c.atencion_humana).length,
      currentRevenue,
      previousRevenue,
      revenueGrowth,
      months,
      ranking,
      mejorPlan,
      efectivo,
      transferencia,
    };
  }, [data]);

  const maxMonthlyRevenue = Math.max(1, ...metrics.months.map((m) => m.ingresos));
  const maxPlanRevenue = Math.max(1, ...metrics.ranking.map((p) => p.ingresos));

  if (loading) {
    return <div className="crm-loading"><div className="spinner" /><span>Cargando analítica comercial…</span></div>;
  }

  return (
    <div className="crm-dashboard">
      <div className="crm-header">
        <div>
          <span className="crm-eyebrow">Inteligencia comercial</span>
          <h1>Resumen ejecutivo</h1>
          <p>Ventas, recaudo, cartera y desempeño real de los planes para apoyar decisiones administrativas.</p>
        </div>
        <div className="crm-live">
          <span className="crm-live-dot" />
          <span>{refreshing ? "Actualizando…" : "Datos en vivo"}</span>
          {lastUpdated && <small>{lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</small>}
          <button onClick={() => load(true)} disabled={refreshing} title="Actualizar"><RefreshCw size={15} className={refreshing ? "spin-icon" : ""} /></button>
        </div>
      </div>

      {error && <div className="crm-error">{error}</div>}

      <div className="crm-kpis">
        <Kpi icon={<CircleDollarSign size={20} />} label="Ventas aprobadas" value={money(metrics.ventasTotal)} helper={`${metrics.aprobadas} reservas`} tone="gold" />
        <Kpi icon={<Banknote size={20} />} label="Total recaudado" value={money(metrics.totalCobrado)} helper={metrics.ventasTotal ? `${pct((metrics.totalCobrado / metrics.ventasTotal) * 100)} recaudado` : "Sin ventas aprobadas"} tone="green" />
        <Kpi icon={<WalletCards size={20} />} label="Cartera pendiente" value={money(metrics.cartera)} helper="Saldo por cobrar" tone={metrics.cartera > 0 ? "red" : "green"} />
        <Kpi icon={<Percent size={20} />} label="Conversión" value={pct(metrics.conversion)} helper={`${metrics.aprobadas} de ${metrics.totalReservas} reservas`} tone="blue" />
        <Kpi icon={<TrendingUp size={20} />} label="Ticket promedio" value={money(metrics.ticketPromedio)} helper="Por reserva aprobada" tone="violet" />
        <Kpi icon={<UserCheck size={20} />} label="Personas vendidas" value={metrics.ocupacionVendida.toLocaleString("es-CO")} helper={`${metrics.participantes} participantes registrados`} tone="teal" />
      </div>

      <div className="crm-decision-strip">
        <div className="crm-decision-main">
          <div className={`crm-growth-icon ${metrics.revenueGrowth >= 0 ? "positive" : "negative"}`}>
            {metrics.revenueGrowth >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
          </div>
          <div>
            <span>Ventas del mes</span>
            <strong>{money(metrics.currentRevenue)}</strong>
            <small className={metrics.revenueGrowth >= 0 ? "positive-text" : "negative-text"}>
              {metrics.revenueGrowth >= 0 ? "+" : ""}{pct(metrics.revenueGrowth)} vs. mes anterior ({money(metrics.previousRevenue)})
            </small>
          </div>
        </div>
        <div className="crm-decision-item"><Trophy size={18} /><div><span>Plan líder</span><strong>{metrics.mejorPlan?.nombre || "Sin ventas aún"}</strong><small>{metrics.mejorPlan ? `${money(metrics.mejorPlan.ingresos)} · ${metrics.mejorPlan.reservas} reservas` : "Aparecerá con la primera aprobación"}</small></div></div>
        <div className="crm-decision-item"><Users size={18} /><div><span>Clientes</span><strong>{metrics.totalClientes}</strong><small>{metrics.requierenAtencion} requieren atención humana</small></div></div>
        <div className="crm-decision-item"><Clock3 size={18} /><div><span>Pendientes</span><strong>{metrics.pendientes}</strong><small>Reservas por convertir</small></div></div>
      </div>

      <div className="crm-grid crm-grid-main">
        <section className="crm-card crm-monthly-card">
          <div className="crm-card-head">
            <div><span className="crm-card-kicker">Evolución</span><h2>Progresión de ventas · 6 meses</h2><p>Ingresos de reservas aprobadas según fecha de aprobación.</p></div>
            <CalendarDays size={20} />
          </div>
          <div className="crm-chart">
            {metrics.months.map((m) => (
              <div className="crm-month" key={m.key}>
                <div className="crm-month-value">{m.ingresos > 0 ? money(m.ingresos) : "$0"}</div>
                <div className="crm-bar-track"><div className="crm-bar" style={{ height: `${Math.max(m.ingresos > 0 ? 10 : 2, (m.ingresos / maxMonthlyRevenue) * 100)}%` }} /></div>
                <strong>{m.label}</strong>
                <span>{m.ventas} ventas · {m.personas} pers.</span>
              </div>
            ))}
          </div>
        </section>

        <section className="crm-card crm-cash-card">
          <div className="crm-card-head">
            <div><span className="crm-card-kicker">Caja</span><h2>Recaudo y cartera</h2><p>Dinero efectivamente recibido frente al valor vendido.</p></div>
            <Banknote size={20} />
          </div>
          <div className="crm-cash-total"><span>Recaudado</span><strong>{money(metrics.totalCobrado)}</strong><small>de {money(metrics.ventasTotal)} vendidos</small></div>
          <div className="crm-progress"><div style={{ width: `${metrics.ventasTotal ? Math.min(100, (metrics.totalCobrado / metrics.ventasTotal) * 100) : 0}%` }} /></div>
          <div className="crm-cash-grid">
            <div><span>Efectivo</span><strong>{money(metrics.efectivo)}</strong></div>
            <div><span>Transferencia</span><strong>{money(metrics.transferencia)}</strong></div>
            <div className="pending"><span>Pendiente</span><strong>{money(metrics.cartera)}</strong></div>
          </div>
        </section>
      </div>

      <section className="crm-card crm-ranking-card">
        <div className="crm-card-head">
          <div><span className="crm-card-kicker">Portafolio</span><h2>Rentabilidad y demanda por plan</h2><p>Comparación comercial para identificar qué experiencias generan mayor valor.</p></div>
          <Package size={20} />
        </div>
        {!metrics.ranking.length ? <div className="crm-empty">Aún no hay planes registrados.</div> : <div className="crm-ranking-table">
          <div className="crm-ranking-row header"><span>Plan</span><span>Reservas</span><span>Personas</span><span>Ingresos</span><span>Ticket</span><span>Participación</span></div>
          {metrics.ranking.map((p, index) => (
            <div className="crm-ranking-row" key={p.id}>
              <div className="crm-plan-name"><span className={`crm-rank ${index < 3 ? `top-${index + 1}` : ""}`}>{index + 1}</span><div><strong>{p.nombre}</strong><div className="crm-mini-track"><div style={{ width: `${(p.ingresos / maxPlanRevenue) * 100}%` }} /></div></div></div>
              <strong>{p.reservas}</strong><strong>{p.personas}</strong><strong>{money(p.ingresos)}</strong><span>{money(p.ticket)}</span><span>{pct(p.participacion)}</span>
            </div>
          ))}
        </div>}
      </section>

      <div className="crm-grid crm-grid-bottom">
        <section className="crm-card crm-funnel-card">
          <div className="crm-card-head"><div><span className="crm-card-kicker">Conversión</span><h2>Embudo comercial</h2></div><Percent size={20} /></div>
          <div className="crm-funnel">
            <div><span>Reservas recibidas</span><strong>{metrics.totalReservas}</strong><div className="crm-funnel-bar"><i style={{ width: "100%" }} /></div></div>
            <div><span>Aprobadas</span><strong>{metrics.aprobadas}</strong><div className="crm-funnel-bar"><i style={{ width: `${metrics.totalReservas ? (metrics.aprobadas / metrics.totalReservas) * 100 : 0}%` }} /></div></div>
            <div><span>Pendientes</span><strong>{metrics.pendientes}</strong><div className="crm-funnel-bar pending"><i style={{ width: `${metrics.totalReservas ? (metrics.pendientes / metrics.totalReservas) * 100 : 0}%` }} /></div></div>
          </div>
        </section>
        <section className="crm-card crm-actions-card">
          <div className="crm-card-head"><div><span className="crm-card-kicker">Acción</span><h2>Prioridades comerciales</h2></div><ArrowRight size={20} /></div>
          <NavLink to="/app/reservas"><div><Clock3 size={17} /><span><strong>{metrics.pendientes} reservas pendientes</strong><small>Revisar y convertir solicitudes</small></span></div><ArrowRight size={17} /></NavLink>
          <NavLink to="/app/control-operativo"><div><WalletCards size={17} /><span><strong>{money(metrics.cartera)} por cobrar</strong><small>Gestionar saldos de reservas aprobadas</small></span></div><ArrowRight size={17} /></NavLink>
          <NavLink to="/app/planes"><div><Trophy size={17} /><span><strong>{metrics.mejorPlan?.nombre || "Planes"}</strong><small>{metrics.mejorPlan ? "Plan con mayor ingreso acumulado" : "Configurar portafolio comercial"}</small></span></div><ArrowRight size={17} /></NavLink>
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, helper, tone }: { icon: React.ReactNode; label: string; value: string; helper: string; tone: string }) {
  return <div className={`crm-kpi ${tone}`}><div className="crm-kpi-top"><div className="crm-kpi-icon">{icon}</div><span>{label}</span></div><strong>{value}</strong><small>{helper}</small></div>;
}
