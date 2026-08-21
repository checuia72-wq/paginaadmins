import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Banknote, CalendarDays, CircleDollarSign, Clock3, Package, Percent, RefreshCw, Trophy, TrendingDown, TrendingUp, UserCheck, Users, WalletCards, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getDashboardAnalytics, type DashboardAnalyticsData, type DashboardPlan, type DashboardReserva } from "../services/dashboardAnalytics.service";
import "../styles/overview-crm.css";

const EMPTY_DATA: DashboardAnalyticsData = { reservas: [], planes: [], clientes: [], participantes: [], pagos: [], devoluciones: [], metodosPago: [] };
const money = (value: number) => `$${Math.round(value || 0).toLocaleString("es-CO")}`;
const pct = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
const dateKey = (value?: string | null) => value ? value.slice(0, 10) : "";
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
const monthKey = (value?: string | null) => value ? value.slice(0, 7) : "";
const methodLabel = (value: string) => value.replace(/\b\w/g, c => c.toUpperCase());

function reservationDate(r: DashboardReserva) { return dateKey(r.fecha_reserva || r.fecha_aprobacion || r.fecha_solicitud); }
function planName(r: DashboardReserva, planes: DashboardPlan[]) { return r.plan?.nombre_plan || planes.find((p) => p.id_plan === r.id_plan)?.nombre_plan || `Plan #${r.id_plan ?? "—"}`; }
function totalReserva(r: DashboardReserva, planes: DashboardPlan[]) {
  const total = Number(r.valor_total || 0); if (total > 0) return total;
  const cantidad = Math.max(1, Number(r.cantidad_personas || 1)); const unitario = Number(r.precio_unitario || 0); if (unitario > 0) return unitario * cantidad;
  const precioPlan = Number(r.plan?.precio_plan || planes.find((p) => p.id_plan === r.id_plan)?.precio_plan || 0); return precioPlan * cantidad;
}
function growth(current: number, previous: number) { if (previous === 0) return current > 0 ? 100 : 0; return ((current - previous) / previous) * 100; }
function toInputDate(d: Date) { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }
function displayShortDate(value: string) { if (!value) return "—"; const [,m,d] = value.split("-"); return `${d}/${m}`; }
function monthLabel(date: Date) { return date.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""); }

export default function OverviewPage() {
  const [data, setData] = useState<DashboardAnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState<string | null>(null); const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fromDate, setFromDate] = useState(""); const [toDate, setToDate] = useState("");

  const load = useCallback(async (silent = false) => { silent ? setRefreshing(true) : setLoading(true); setError(null); try { const result = await getDashboardAnalytics(); setData(result); setLastUpdated(new Date()); } catch (e: any) { console.error("[CRM Dashboard]", e); setError(e?.message || "No fue posible cargar el resumen comercial."); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { load(); const timer = window.setInterval(() => load(true), 30_000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => {
    const client = supabase; if (!client) return;
    const channel = client.channel("crm-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reserva" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "reserva_pago" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "reserva_devolucion" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "plan" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "cliente" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "participante" }, () => load(true)).subscribe();
    return () => { client.removeChannel(channel); };
  }, [load]);

  const pagosPorReserva = useMemo(() => { const map = new Map<number, typeof data.pagos>(); for (const p of data.pagos) { if (!map.has(p.id_reserva)) map.set(p.id_reserva, []); map.get(p.id_reserva)!.push(p); } return map; }, [data.pagos]);
  const devolucionesPorReserva = useMemo(() => { const map=new Map<number,number>(); for(const d of data.devoluciones) map.set(d.id_reserva,(map.get(d.id_reserva)||0)+d.monto); return map; }, [data.devoluciones]);

  const filteredReservas = useMemo(() => data.reservas.filter((r) => { const referenceDate = reservationDate(r); if (fromDate && (!referenceDate || referenceDate < fromDate)) return false; if (toDate && (!referenceDate || referenceDate > toDate)) return false; return true; }), [data.reservas, fromDate, toDate]);

  const metrics = useMemo(() => {
    const planes = data.planes;
    const aprobadas = filteredReservas.filter(r => r.aprobado === true && r.estado_operativo !== "cancelada");
    const canceladas = filteredReservas.filter(r => r.aprobado === true && r.estado_operativo === "cancelada");
    const pendientes = filteredReservas.filter(r => r.aprobado !== true);
    const ventasTotal = aprobadas.reduce((s,r) => s + totalReserva(r,planes), 0);

    const recaudoMap = new Map<string,number>(); let totalCobradoBruto = 0; let totalDevuelto = 0;
    for (const r of aprobadas) {
      const abono = Number(r.valor_abonado || 0); const medioAbono = normalize(r.metodo_pago_abono);
      if (abono > 0) { totalCobradoBruto += abono; if (medioAbono) recaudoMap.set(medioAbono, (recaudoMap.get(medioAbono) || 0) + abono); }
      const saldoMovs = (pagosPorReserva.get(r.id_reserva) || []).filter(p => p.tipo_pago === "saldo" && p.monto > 0);
      if (saldoMovs.length) { for (const p of saldoMovs) { totalCobradoBruto += p.monto; recaudoMap.set(p.medio_pago, (recaudoMap.get(p.medio_pago) || 0) + p.monto); } }
      else { const saldoLegacy = Number(r.valor_saldo_pagado || 0); const medioSaldo = normalize(r.metodo_pago_saldo); if (saldoLegacy > 0) { totalCobradoBruto += saldoLegacy; if (medioSaldo) recaudoMap.set(medioSaldo, (recaudoMap.get(medioSaldo) || 0) + saldoLegacy); } }
      totalDevuelto += devolucionesPorReserva.get(r.id_reserva) || 0;
    }
    const totalCobrado = Math.max(0,totalCobradoBruto-totalDevuelto);
    if(totalDevuelto>0) recaudoMap.set("devoluciones",-totalDevuelto);
    const recaudoPorMedio = [...recaudoMap.entries()].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const cartera = Math.max(0, ventasTotal-totalCobrado); const ticketPromedio = aprobadas.length ? ventasTotal/aprobadas.length : 0;
    const conversion = filteredReservas.length ? aprobadas.length/filteredReservas.length*100 : 0; const ocupacionVendida = aprobadas.reduce((s,r) => s + Number(r.cantidad_personas || 0), 0);

    const buildRanking = (reservas: DashboardReserva[]) => {
      const map = new Map<number,{id:number;nombre:string;reservas:number;personas:number;ingresos:number}>(); for (const p of planes) map.set(p.id_plan,{id:p.id_plan,nombre:p.nombre_plan,reservas:0,personas:0,ingresos:0});
      for (const r of reservas) { if (!r.id_plan) continue; const item=map.get(r.id_plan)||{id:r.id_plan,nombre:planName(r,planes),reservas:0,personas:0,ingresos:0}; item.reservas+=1; item.personas+=Number(r.cantidad_personas||0); item.ingresos+=totalReserva(r,planes); map.set(r.id_plan,item); }
      const total = reservas.reduce((s,r)=>s+totalReserva(r,planes),0); return [...map.values()].map(p=>({...p,ticket:p.reservas?p.ingresos/p.reservas:0,participacion:total?p.ingresos/total*100:0})).sort((a,b)=>b.ingresos-a.ingresos||b.reservas-a.reservas);
    };

    const ranking=buildRanking(aprobadas); const mejorPlan=ranking.find(p=>p.reservas>0)||null;
    const dayMap=new Map<string,{key:string;ventas:number;personas:number;ingresos:number}>(); for (const r of aprobadas) { const key=reservationDate(r); if(!key) continue; const item=dayMap.get(key)||{key,ventas:0,personas:0,ingresos:0}; item.ventas+=1; item.personas+=Number(r.cantidad_personas||0); item.ingresos+=totalReserva(r,planes); dayMap.set(key,item); }
    const daily=[...dayMap.values()].sort((a,b)=>a.key.localeCompare(b.key)).slice(-14);

    const now=new Date(); const allApproved=data.reservas.filter(r=>r.aprobado===true&&r.estado_operativo!=="cancelada");
    const monthly=Array.from({length:6},(_,index)=>{ const d=new Date(now.getFullYear(),now.getMonth()-(5-index),1); const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; const rows=allApproved.filter(r=>monthKey(reservationDate(r))===key); return { key, label:monthLabel(d), ventas:rows.length, personas:rows.reduce((s,r)=>s+Number(r.cantidad_personas||0),0), ingresos:rows.reduce((s,r)=>s+totalReserva(r,planes),0) }; });
    const historicalRanking=buildRanking(allApproved).filter(p=>p.reservas>0).slice(0,5);
    const thisFrom=toInputDate(new Date(now.getFullYear(),now.getMonth(),1)); const thisTo=toInputDate(now); const prevFrom=toInputDate(new Date(now.getFullYear(),now.getMonth()-1,1)); const prevTo=toInputDate(new Date(now.getFullYear(),now.getMonth(),0));
    const thisMonthRevenue=allApproved.filter(r=>{const d=reservationDate(r);return d>=thisFrom&&d<=thisTo;}).reduce((s,r)=>s+totalReserva(r,planes),0); const prevMonthRevenue=allApproved.filter(r=>{const d=reservationDate(r);return d>=prevFrom&&d<=prevTo;}).reduce((s,r)=>s+totalReserva(r,planes),0);

    return { aprobadas:aprobadas.length, canceladas:canceladas.length, pendientes:pendientes.length, ventasTotal,totalCobrado,totalCobradoBruto,totalDevuelto,cartera,ticketPromedio,conversion,ocupacionVendida,ranking,mejorPlan,recaudoPorMedio,daily,monthly,historicalRanking,revenueGrowth:growth(thisMonthRevenue,prevMonthRevenue),thisMonthRevenue,prevMonthRevenue };
  }, [filteredReservas, data.planes, data.reservas, pagosPorReserva, devolucionesPorReserva]);

  const maxDaily=Math.max(1,...metrics.daily.map(d=>d.ingresos)); const maxMonthly=Math.max(1,...metrics.monthly.map(d=>d.ingresos)); const maxPlan=Math.max(1,...metrics.ranking.map(p=>p.ingresos)); const maxHistoricalPlan=Math.max(1,...metrics.historicalRanking.map(p=>p.ingresos));
  const dateFilterActive=!!fromDate||!!toDate; const clearDateFilter=()=>{setFromDate("");setToDate("");};

  if (loading) return <div className="crm-loading"><div className="spinner" /><span>Cargando analítica comercial…</span></div>;
  return <div className="crm-dashboard">
    <div className="crm-header"><div><span className="crm-eyebrow">Inteligencia comercial</span><h1>Resumen ejecutivo</h1><p>Ventas activas, recaudo neto, devoluciones, cartera y desempeño real de los planes.</p></div><div className="crm-live"><span className="crm-live-dot"/><span>{refreshing?"Actualizando…":"Datos en vivo"}</span>{lastUpdated&&<small>{lastUpdated.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</small>}<button onClick={()=>load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing?"spin-icon":""}/></button></div></div>
    {error&&<div className="crm-error">{error}</div>}

    <section className="crm-filter-card"><div className="crm-filter-title"><CalendarDays size={17}/><div><strong>Periodo personalizado</strong><span>Deja las fechas vacías para ver toda la información. Selecciona un rango solo cuando necesites analizar días específicos.</span></div></div><div className="crm-filter-grid"><label><span>Desde</span><input type="date" value={fromDate} max={toDate||undefined} onChange={e=>setFromDate(e.target.value)}/></label><label><span>Hasta</span><input type="date" value={toDate} min={fromDate||undefined} onChange={e=>setToDate(e.target.value)}/></label><button className="crm-filter-clear" onClick={clearDateFilter} disabled={!dateFilterActive}><X size={14}/> Limpiar fechas</button></div><div className="crm-filter-result">Mostrando <b>{filteredReservas.length}</b> reservas {dateFilterActive?`· ${fromDate||"inicio"} a ${toDate||"hoy"}`:"· todo el histórico"}{metrics.canceladas?` · ${metrics.canceladas} canceladas excluidas de ventas`:""}</div></section>

    <div className="crm-kpis"><Kpi icon={<CircleDollarSign size={20}/>} label="Ventas activas" value={money(metrics.ventasTotal)} helper={`${metrics.aprobadas} reservas vigentes`} tone="gold"/><Kpi icon={<Banknote size={20}/>} label="Recaudo neto" value={money(metrics.totalCobrado)} helper={metrics.totalDevuelto?`${money(metrics.totalDevuelto)} devuelto`:metrics.ventasTotal?`${pct(metrics.totalCobrado/metrics.ventasTotal*100)} recaudado`:"Sin ventas"} tone="green"/><Kpi icon={<WalletCards size={20}/>} label="Cartera pendiente" value={money(metrics.cartera)} helper="Saldo por cobrar" tone="red"/><Kpi icon={<Percent size={20}/>} label="Conversión" value={pct(metrics.conversion)} helper={`${metrics.aprobadas} activas · ${metrics.pendientes} pendientes`} tone="blue"/><Kpi icon={<TrendingUp size={20}/>} label="Ticket promedio" value={money(metrics.ticketPromedio)} helper="Por reserva activa" tone="violet"/><Kpi icon={<UserCheck size={20}/>} label="Personas vendidas" value={metrics.ocupacionVendida.toLocaleString("es-CO")} helper="Excluye reservas canceladas" tone="teal"/></div>

    <div className="crm-decision-strip"><div className="crm-decision-main"><div className={`crm-growth-icon ${metrics.revenueGrowth>=0?"positive":"negative"}`}>{metrics.revenueGrowth>=0?<TrendingUp size={22}/>:<TrendingDown size={22}/>}</div><div><span>Ventas del mes</span><strong>{money(metrics.thisMonthRevenue)}</strong><small className={metrics.revenueGrowth>=0?"positive-text":"negative-text"}>{metrics.revenueGrowth>=0?"+":""}{pct(metrics.revenueGrowth)} vs. mes anterior ({money(metrics.prevMonthRevenue)})</small></div></div><div className="crm-decision-item"><Trophy size={18}/><div><span>Plan líder</span><strong>{metrics.mejorPlan?.nombre||"Sin ventas"}</strong><small>{metrics.mejorPlan?`${money(metrics.mejorPlan.ingresos)} · ${metrics.mejorPlan.reservas} reservas`:"Sin resultados"}</small></div></div><div className="crm-decision-item"><Users size={18}/><div><span>Clientes</span><strong>{data.clientes.length}</strong><small>{data.clientes.filter(c=>c.atencion_humana).length} requieren atención</small></div></div><div className="crm-decision-item"><Clock3 size={18}/><div><span>Pendientes</span><strong>{metrics.pendientes}</strong><small>{metrics.canceladas?`${metrics.canceladas} canceladas · `:""}reservas por convertir</small></div></div></div>

    <div className="crm-grid crm-grid-main"><section className="crm-card crm-monthly-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Ventas por día</span><h2>Ingresos diarios</h2><p>Últimos 14 días con ventas activas dentro del periodo visible.</p></div><CalendarDays size={20}/></div>{!metrics.daily.length?<div className="crm-empty">No hay ventas activas en este periodo.</div>:<div className="crm-chart crm-daily-chart">{metrics.daily.map(d=><div className="crm-month" key={d.key}><div className="crm-month-value">{money(d.ingresos)}</div><div className="crm-bar-track"><div className="crm-bar" style={{height:`${Math.max(8,d.ingresos/maxDaily*100)}%`}}/></div><strong>{displayShortDate(d.key)}</strong><span>{d.ventas} vtas · {d.personas} pers.</span></div>)}</div>}</section><section className="crm-card crm-cash-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Caja</span><h2>Recaudo, devoluciones y cartera</h2><p>El recaudo mostrado es neto de devoluciones registradas en Control Operativo.</p></div><Banknote size={20}/></div><div className="crm-cash-total"><span>Recaudo neto</span><strong>{money(metrics.totalCobrado)}</strong><small>{money(metrics.totalCobradoBruto)} bruto · {money(metrics.totalDevuelto)} devuelto</small></div><div className="crm-progress"><div style={{width:`${metrics.ventasTotal?Math.min(100,metrics.totalCobrado/metrics.ventasTotal*100):0}%`}}/></div><div className="crm-cash-grid">{metrics.recaudoPorMedio.map(([medio,valor])=><div key={medio} className={medio==="devoluciones"?"pending":undefined}><span>{methodLabel(medio)}</span><strong>{money(valor)}</strong></div>)}{!metrics.recaudoPorMedio.length&&<div><span>Sin recaudo</span><strong>$0</strong></div>}<div className="pending"><span>Pendiente</span><strong>{money(metrics.cartera)}</strong></div></div></section></div>

    <section className="crm-card crm-monthly-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Evolución histórica</span><h2>Progresión de ventas · 6 meses</h2><p>Vista mensual de reservas activas según la fecha real reservada.</p></div><CalendarDays size={20}/></div><div className="crm-chart">{metrics.monthly.map(m=><div className="crm-month" key={m.key}><div className="crm-month-value">{m.ingresos?money(m.ingresos):"$0"}</div><div className="crm-bar-track"><div className="crm-bar" style={{height:`${Math.max(m.ingresos>0?8:2,m.ingresos/maxMonthly*100)}%`}}/></div><strong>{m.label}</strong><span>{m.ventas} ventas · {m.personas} pers.</span></div>)}</div></section>

    <section className="crm-card crm-ranking-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Top histórico</span><h2>Planes con mayor ingreso</h2><p>Vista gráfica de los 5 planes con mayor venta activa.</p></div><Trophy size={20}/></div>{!metrics.historicalRanking.length?<div className="crm-empty">Aún no hay ventas activas.</div>:<div style={{padding:"16px 18px 20px",display:"grid",gap:"14px"}}>{metrics.historicalRanking.map((p,index)=><div key={p.id} style={{display:"grid",gridTemplateColumns:"minmax(180px,1.5fr) minmax(180px,2fr) auto",gap:"14px",alignItems:"center"}}><div className="crm-plan-name"><span className={`crm-rank ${index<3?`top-${index+1}`:""}`}>{index+1}</span><div><strong>{p.nombre}</strong><span style={{display:"block",fontSize:"10px",color:"#8d7e73",marginTop:"2px"}}>{p.reservas} reservas · {p.personas} personas</span></div></div><div className="crm-mini-track" style={{height:"12px",marginTop:0}}><div style={{width:`${Math.max(3,p.ingresos/maxHistoricalPlan*100)}%`,height:"100%"}}/></div><strong style={{whiteSpace:"nowrap",fontSize:"13px"}}>{money(p.ingresos)}</strong></div>)}</div>}</section>

    <section className="crm-card crm-ranking-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Portafolio</span><h2>Rentabilidad y demanda por plan</h2><p>Comparación del periodo visible, excluyendo reservas canceladas.</p></div><Package size={20}/></div>{!metrics.ranking.some(p=>p.reservas>0)?<div className="crm-empty">No hay ventas por plan en este periodo.</div>:<div className="crm-ranking-table"><div className="crm-ranking-row header"><span>Plan</span><span>Reservas</span><span>Personas</span><span>Ingresos</span><span>Ticket</span><span>Participación</span></div>{metrics.ranking.filter(p=>p.reservas>0).map((p,index)=><div className="crm-ranking-row" key={p.id}><div className="crm-plan-name"><span className={`crm-rank ${index<3?`top-${index+1}`:""}`}>{index+1}</span><div><strong>{p.nombre}</strong><div className="crm-mini-track"><div style={{width:`${p.ingresos/maxPlan*100}%`}}/></div></div></div><strong>{p.reservas}</strong><strong>{p.personas}</strong><strong>{money(p.ingresos)}</strong><span>{money(p.ticket)}</span><span>{pct(p.participacion)}</span></div>)}</div>}</section>

    <div className="crm-grid crm-grid-bottom"><section className="crm-card crm-funnel-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Conversión</span><h2>Embudo comercial</h2></div><Percent size={20}/></div><div className="crm-funnel"><div><span>Reservas recibidas</span><strong>{filteredReservas.length}</strong><div className="crm-funnel-bar"><i style={{width:"100%"}}/></div></div><div><span>Aprobadas activas</span><strong>{metrics.aprobadas}</strong><div className="crm-funnel-bar"><i style={{width:`${filteredReservas.length?metrics.aprobadas/filteredReservas.length*100:0}%`}}/></div></div><div><span>Pendientes</span><strong>{metrics.pendientes}</strong><div className="crm-funnel-bar pending"><i style={{width:`${filteredReservas.length?metrics.pendientes/filteredReservas.length*100:0}%`}}/></div></div></div></section><section className="crm-card crm-actions-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Acción</span><h2>Prioridades comerciales</h2></div><ArrowRight size={20}/></div><NavLink to="/app/reservas"><div><Clock3 size={17}/><span><strong>{metrics.pendientes} reservas pendientes</strong><small>Revisar solicitudes</small></span></div><ArrowRight size={17}/></NavLink><NavLink to="/app/control-operativo"><div><WalletCards size={17}/><span><strong>{money(metrics.cartera)} por cobrar</strong><small>{metrics.totalDevuelto?`${money(metrics.totalDevuelto)} devuelto · `:""}gestionar operación y saldos</small></span></div><ArrowRight size={17}/></NavLink><NavLink to="/app/planes"><div><Trophy size={17}/><span><strong>{metrics.mejorPlan?.nombre||"Planes"}</strong><small>Revisar portafolio</small></span></div><ArrowRight size={17}/></NavLink></section></div>
  </div>;
}

function Kpi({ icon, label, value, helper, tone }: { icon: React.ReactNode; label: string; value: string; helper: string; tone: string }) { return <div className={`crm-kpi crm-kpi-${tone}`}><div className="crm-kpi-top"><div className="crm-kpi-icon">{icon}</div><span>{label}</span></div><strong>{value}</strong><small>{helper}</small></div>; }
