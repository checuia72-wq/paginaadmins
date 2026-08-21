import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CalendarClock, Download, Filter, History, Pencil, Plus, RefreshCw, RotateCcw, Search, SlidersHorizontal, Trash2, UserCheck, X } from "lucide-react";
import {
  cambiarEstadoOperativo,
  getControlOperativo,
  getDevolucionesControlOperativo,
  getPagosControlOperativo,
  getReservaOperacionHistorial,
  getReservaPagos,
  registrarDevolucionReserva,
  reprogramarReservaOperativa,
  replaceSaldoPagos,
  updateControlParticipante,
  updateControlReserva,
  type ControlOperativoRow,
  type EstadoOperativo,
  type ReservaDevolucion,
  type ReservaOperacionHistorial,
  type ReservaPago,
} from "../services/controlOperativo.service";
import { getMetodosPagoActivos } from "../services/medioPago.service";
import { getRestaurantesActivos } from "../services/restaurante.service";
import {
  cambiarCodigoOperativoReserva,
  codigosCompatibles,
  getCodigosOperativos,
  type CodigoOperativo,
} from "../services/codigoOperativo.service";
import "../styles/control-operativo.css";
import "../styles/control-operativo-estados.css";

const money = (v: number) => `$${Number(v || 0).toLocaleString("es-CO")}`;
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const dk = (v: string) => (v ? v.slice(0, 10) : "");
const hk = (v: string) => (v ? v.slice(0, 5) : "");
const fmt = (v: string) => { const k = dk(v); if (!k) return "—"; const [y, m, d] = k.split("-"); return `${d}/${m}/${y}`; };
const num = (v: string) => (v === "" ? ("" as any) : Number(v.replace(/[^0-9]/g, "")));
const saved = (v: unknown) => (v === "" || v == null ? 0 : Number(v));
const phone = (v: string) => String(v || "").replace(/\D/g, "");
const fmtPago = (value?: string | null) => value ? new Date(value).toLocaleString("es-CO", { timeZone:"America/Bogota", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone:"America/Bogota" });
type Split = { monto: number; medio_pago: string };

type RefundForm = { monto:number; medio_pago:string; tipo_devolucion:"parcial"|"total"; motivo:string; observacion:string };
const emptyRefund = ():RefundForm => ({monto:0,medio_pago:"",tipo_devolucion:"parcial",motivo:"",observacion:""});

const ESTADOS: Array<{value:EstadoOperativo;label:string}> = [
  {value:"programada",label:"Programada"},
  {value:"asistio",label:"Asistió"},
  {value:"no_asistio",label:"No asistió"},
  {value:"reprogramada",label:"Reprogramada"},
  {value:"cancelada",label:"Cancelada"},
];
const estadoLabel=(e:string)=>ESTADOS.find(x=>x.value===e)?.label||e||"Programada";

export default function ControlOperativoPage() {
  const [rows, setRows] = useState<ControlOperativoRow[]>([]);
  const [metodos, setMetodos] = useState<string[]>([]);
  const [restaurantes, setRestaurantes] = useState<string[]>([]);
  const [codigos, setCodigos] = useState<CodigoOperativo[]>([]);
  const [pagos, setPagos] = useState<ReservaPago[]>([]);
  const [devoluciones, setDevoluciones] = useState<ReservaDevolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [fecha, setFecha] = useState("");
  const [plan, setPlan] = useState("");
  const [hora, setHora] = useState("");
  const [mina, setMina] = useState("");
  const [refrigerio, setRefrigerio] = useState("");
  const [restaurante, setRestaurante] = useState("");
  const [almuerzo, setAlmuerzo] = useState("");
  const [saldo, setSaldo] = useState("");
  const [estado, setEstado] = useState("");

  const [editing, setEditing] = useState<ControlOperativoRow | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [saving, setSaving] = useState(false);
  const [medioDetalle, setMedioDetalle] = useState<string | null>(null);

  const [estadoDraft,setEstadoDraft]=useState<EstadoOperativo>("programada");
  const [motivoEstado,setMotivoEstado]=useState("");
  const [reprogFecha,setReprogFecha]=useState("");
  const [reprogHora,setReprogHora]=useState<number|null>(null);
  const [reprogMotivo,setReprogMotivo]=useState("");
  const [refundForm,setRefundForm]=useState<RefundForm>(emptyRefund());
  const [historial,setHistorial]=useState<ReservaOperacionHistorial[]>([]);
  const [opSaving,setOpSaving]=useState(false);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true); setError(null);
    try {
      const [operativo, medios, restaurantesData, pagosData, codigosData, devolucionesData] = await Promise.all([
        getControlOperativo(), getMetodosPagoActivos(), getRestaurantesActivos(), getPagosControlOperativo(), getCodigosOperativos(), getDevolucionesControlOperativo(),
      ]);
      setRows(operativo); setMetodos(medios); setRestaurantes(restaurantesData); setPagos(pagosData); setCodigos(codigosData); setDevoluciones(devolucionesData);
    } catch (e: any) { setError(e?.message || "No fue posible cargar el control operativo."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const planes = useMemo(() => [...new Set(rows.map((r) => r.plan).filter(Boolean))].sort(), [rows]);
  const horas = useMemo(() => [...new Set(rows.map((r) => hk(r.hora)).filter(Boolean))].sort(), [rows]);
  const planOpts = useMemo(() => [...new Map(codigos.filter((c) => c.activo && c.id_plan != null && c.plan?.nombre_plan).map((c) => [c.id_plan!, c.plan!.nombre_plan])).entries()].sort((a,b)=>a[1].localeCompare(b[1])), [codigos]);
  const planMeta = useMemo(() => editing?.id_plan == null ? null : codigos.find((c)=>c.activo && c.id_plan===editing.id_plan && c.plan)?.plan ?? null, [codigos,editing?.id_plan]);
  const horaOpts = useMemo(() => {
    if (!planMeta || planMeta.tipo_hora === "sin_hora") return [];
    return (planMeta.plan_horas ?? []).map((h)=>[h.id_hora,h.hora] as [number,string]).sort((a,b)=>a[1].localeCompare(b[1]));
  }, [planMeta]);
  const fechaOpts = useMemo(() => (planMeta?.plan_fechas ?? []).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)), [planMeta]);

  const devolucionMap = useMemo(()=>{
    const map=new Map<number,number>();
    devoluciones.forEach(d=>map.set(d.id_reserva,(map.get(d.id_reserva)||0)+d.monto));
    return map;
  },[devoluciones]);

  const filtered = useMemo(() => rows.filter((r) => {
    const q = norm(search);
    if (fecha && dk(r.fecha) !== fecha) return false;
    if (plan && r.plan !== plan) return false;
    if (hora && hk(r.hora) !== hora) return false;
    if (mina && String(!!r.mina) !== (mina === "si" ? "true" : "false")) return false;
    if (refrigerio && String(!!r.refrigerio) !== (refrigerio === "si" ? "true" : "false")) return false;
    if (restaurante && r.restaurante !== restaurante) return false;
    if (almuerzo === "si" && !r.incluye_almuerzo) return false;
    if (almuerzo === "no" && r.incluye_almuerzo) return false;
    if (saldo === "pendiente" && r.saldo_pendiente <= 0) return false;
    if (saldo === "pagado" && r.saldo_pendiente > 0) return false;
    if (estado && r.estado_operativo !== estado) return false;
    return !q || [r.reserva_codigo,r.plan,r.nombre,r.documento,r.contacto,r.observacion,r.medio_abono,r.medio_saldo,r.estado_operativo,r.motivo_estado_operativo].map(norm).join(" ").includes(q);
  }), [rows,search,fecha,plan,hora,mina,refrigerio,restaurante,almuerzo,saldo,estado]);

  const reservas = [...new Map(filtered.map((r) => [r.id_reserva, r])).values()];
  const reservaIds = useMemo(() => new Set(reservas.map((r) => r.id_reserva)), [reservas]);
  const pagosVista = useMemo(() => pagos.filter((p) => reservaIds.has(p.id_reserva)), [pagos,reservaIds]);
  const devolucionesVista = useMemo(()=>devoluciones.filter(d=>reservaIds.has(d.id_reserva)),[devoluciones,reservaIds]);
  const cajaMedios = useMemo(() => { const map=new Map<string,number>(); pagosVista.forEach((p)=>map.set(p.medio_pago,(map.get(p.medio_pago)||0)+p.monto)); return [...map.entries()].sort((a,b)=>b[1]-a[1]); }, [pagosVista]);
  const movimientosDetalle = useMemo(() => medioDetalle ? pagosVista.filter((p)=>p.medio_pago===medioDetalle) : [], [pagosVista,medioDetalle]);
  const rowByReserva = useMemo(() => new Map(rows.map((r)=>[r.id_reserva,r])), [rows]);

  const chOptions = useMemo(() => editing ? codigosCompatibles(codigos, editing.id_plan, !!editing.incluye_almuerzo, editing.restaurante) : [], [codigos,editing]);

  const syncCH = (next: ControlOperativoRow) => {
    const meta = next.id_plan == null ? null : codigos.find((c)=>c.activo && c.id_plan===next.id_plan && c.plan)?.plan ?? null;
    const cantidad = Math.max(1, Number(next.cantidad || 1));
    const precio = meta?.precio_plan == null ? null : Number(meta.precio_plan);
    const total = precio != null && Number.isFinite(precio) ? precio * cantidad : next.total;
    const planHoras = meta?.tipo_hora === "sin_hora" ? [] : (meta?.plan_horas ?? []);
    let id_hora = next.id_hora;
    let horaReserva = next.hora;
    if (!planHoras.length) { id_hora = null; horaReserva = ""; }
    else if (!planHoras.some((h)=>h.id_hora===next.id_hora)) {
      const sameClock = planHoras.find((h)=>hk(h.hora)===hk(next.hora));
      const fallback = sameClock ?? (planHoras.length===1 ? planHoras[0] : undefined);
      id_hora = fallback?.id_hora ?? null; horaReserva = fallback?.hora ?? "";
    }
    const compatibles = codigosCompatibles(codigos, next.id_plan, !!next.incluye_almuerzo, next.restaurante);
    const currentValid = compatibles.some((c)=>c.id_codigo_operativo===next.id_codigo_operativo);
    return { ...next,total,id_hora,hora:horaReserva,id_codigo_operativo:currentValid?next.id_codigo_operativo:(compatibles[0]?.id_codigo_operativo??null) };
  };

  const handlePlanChange = (id: number | null) => {
    if (!editing) return;
    const codesForPlan = codigos.filter((c)=>c.activo && c.id_plan===id);
    const name = planOpts.find(([planId])=>planId===id)?.[1] ?? editing.plan;
    let next: ControlOperativoRow = { ...editing, id_plan:id, plan:name };
    if (!codigosCompatibles(codigos,id,!!next.incluye_almuerzo,next.restaurante).length && codesForPlan.length) {
      const exactRestaurant = codesForPlan.find((c)=>c.restaurante && norm(c.restaurante)===norm(next.restaurante));
      const preferred = exactRestaurant ?? [...codesForPlan].sort((a,b)=>b.prioridad-a.prioridad)[0];
      next = {...next,incluye_almuerzo:preferred.incluye_almuerzo,restaurante:preferred.incluye_almuerzo?(preferred.restaurante??next.restaurante):"",id_codigo_operativo:preferred.id_codigo_operativo};
    }
    setModalError(null); setReprogFecha(""); setReprogHora(null); setEditing(syncCH(next));
  };

  const openEdit = async (r: ControlOperativoRow) => {
    setError(null); setModalError(null); setEstadoDraft(r.estado_operativo||"programada"); setMotivoEstado(r.motivo_estado_operativo||""); setReprogFecha(r.fecha||""); setReprogHora(r.id_hora); setReprogMotivo(""); setRefundForm(emptyRefund()); setHistorial([]);
    setEditing(syncCH({ ...r }));
    try {
      const [pagosReserva,hist]=await Promise.all([getReservaPagos(r.id_reserva),getReservaOperacionHistorial(r.id_reserva)]);
      const saldos=pagosReserva.filter((p)=>p.tipo_pago==="saldo").map((p)=>({monto:p.monto,medio_pago:p.medio_pago}));
      setSplits(saldos.length?saldos:r.pago_saldo>0?[{monto:r.pago_saldo,medio_pago:r.medio_saldo}]:[{monto:0,medio_pago:""}]);
      setHistorial(hist);
    } catch { setSplits(r.pago_saldo>0?[{monto:r.pago_saldo,medio_pago:r.medio_saldo}]:[{monto:0,medio_pago:""}]); }
  };

  const totalSplit=splits.reduce((s,p)=>s+saved(p.monto),0);
  const pendienteEdit=editing?Math.max(0,saved(editing.total)-saved(editing.abono)-totalSplit):0;
  const devolucionesReserva=editing?devoluciones.filter(d=>d.id_reserva===editing.id_reserva):[];
  const devueltoEdit=devolucionesReserva.reduce((s,d)=>s+d.monto,0);
  const cobradoEdit=editing?saved(editing.abono)+totalSplit:0;
  const netoEdit=Math.max(0,cobradoEdit-devueltoEdit);
  const devolucionDisponible=Math.max(0,cobradoEdit-devueltoEdit);
  const totalVentas=reservas.filter(r=>r.estado_operativo!=="cancelada").reduce((s,r)=>s+r.total,0);
  const totalDevuelto=devolucionesVista.reduce((s,d)=>s+d.monto,0);
  const totalRecaudo=pagosVista.reduce((s,p)=>s+p.monto,0);

  const save = async () => {
    if (!editing) return;
    const invalid=splits.some((p)=>(saved(p.monto)>0&&!p.medio_pago)||(p.medio_pago&&saved(p.monto)<=0));
    if(invalid){setModalError("Cada pago de saldo debe tener un valor mayor a cero y un medio de pago.");return;}
    if(saved(editing.abono)+totalSplit>saved(editing.total)){setModalError(`El total del plan es ${money(saved(editing.total))}, pero hay ${money(saved(editing.abono)+totalSplit)} registrados entre abono y saldo. Ajusta los pagos antes de guardar.`);return;}
    if(!editing.id_plan){setModalError("Selecciona un plan válido.");return;}
    if(!editing.id_codigo_operativo){setModalError("No hay un CH compatible. Revisa Plan, Almuerzo y Restaurante o vincula el CH en Códigos operativos.");return;}
    if(planMeta?.tipo_hora!=="sin_hora" && (planMeta?.plan_horas?.length||0)>0 && !editing.id_hora){setModalError("Selecciona un horario válido para el nuevo plan.");return;}
    setSaving(true);setModalError(null);
    try {
      await cambiarCodigoOperativoReserva({id_reserva:editing.id_reserva,id_plan:editing.id_plan,incluye_almuerzo:!!editing.incluye_almuerzo,restaurante:editing.incluye_almuerzo?editing.restaurante:null,id_codigo_operativo:editing.id_codigo_operativo});
      await updateControlReserva(editing.id_reserva,{id_hora:editing.id_hora,mina:editing.mina,refrigerio:editing.refrigerio,valor_total:saved(editing.total),valor_abonado:saved(editing.abono),metodo_pago_abono:editing.medio_abono||null,observacion:editing.observacion||null});
      await replaceSaldoPagos(editing.id_reserva,splits);
      if(editing.id_participante){await updateControlParticipante(editing.id_participante,{nombre:editing.nombre||null,edad:editing.edad===("" as any)?null:editing.edad,nacionalidad:editing.nacionalidad||null,numero_documento:editing.documento||null,telefono_participante:phone(editing.contacto)!==phone(editing.contacto_cliente)?editing.contacto.trim()||null:null,tipo_almuerzo:editing.almuerzo.trim()||null});}
      setEditing(null);await load(true);
    } catch(e:any){setModalError(e?.message||"No fue posible guardar los cambios.");}
    finally{setSaving(false);}
  };

  const applyEstado=async()=>{
    if(!editing)return;
    if(estadoDraft==="reprogramada"){setModalError("Para marcar una reserva como reprogramada usa la sección Reprogramar reserva, seleccionando la nueva fecha y hora.");return;}
    if((estadoDraft==="cancelada"||estadoDraft==="no_asistio")&&!motivoEstado.trim()){setModalError("Indica el motivo para dejar trazabilidad de este cambio.");return;}
    setOpSaving(true);setModalError(null);
    try{await cambiarEstadoOperativo(editing.id_reserva,estadoDraft,motivoEstado);const hist=await getReservaOperacionHistorial(editing.id_reserva);setHistorial(hist);setEditing({...editing,estado_operativo:estadoDraft,motivo_estado_operativo:motivoEstado});await load(true);}catch(e:any){setModalError(e?.message||"No fue posible cambiar el estado operativo.");}finally{setOpSaving(false);}
  };

  const doReprogram=async()=>{
    if(!editing||!editing.id_plan)return;
    if(!reprogFecha){setModalError("Selecciona la nueva fecha de la reserva.");return;}
    if(planMeta?.tipo_hora!=="sin_hora"&&(planMeta?.plan_horas?.length||0)>0&&!reprogHora){setModalError("Selecciona la nueva hora de la reserva.");return;}
    setOpSaving(true);setModalError(null);
    try{const idFecha=await reprogramarReservaOperativa({id_reserva:editing.id_reserva,id_plan:editing.id_plan,fecha:reprogFecha,id_hora:reprogHora,motivo:reprogMotivo});const hist=await getReservaOperacionHistorial(editing.id_reserva);setHistorial(hist);setEstadoDraft("reprogramada");setEditing({...editing,id_fecha:idFecha,fecha:reprogFecha,id_hora:reprogHora,hora:horaOpts.find(([id])=>id===reprogHora)?.[1]||"",estado_operativo:"reprogramada",motivo_estado_operativo:reprogMotivo});await load(true);}catch(e:any){setModalError(e?.message||"No fue posible reprogramar la reserva.");}finally{setOpSaving(false);}
  };

  const doRefund=async()=>{
    if(!editing)return;
    const amount=saved(refundForm.monto);
    if(amount<=0){setModalError("Indica un valor de devolución mayor a cero.");return;}
    if(!refundForm.medio_pago){setModalError("Selecciona el medio por el cual se realizó la devolución.");return;}
    if(amount>devolucionDisponible){setModalError(`Solo hay ${money(devolucionDisponible)} disponibles para devolver después de descontar devoluciones anteriores.`);return;}
    setOpSaving(true);setModalError(null);
    try{await registrarDevolucionReserva({id_reserva:editing.id_reserva,monto:amount,medio_pago:refundForm.medio_pago,tipo_devolucion:refundForm.tipo_devolucion,motivo:refundForm.motivo,observacion:refundForm.observacion});const data=await getDevolucionesControlOperativo();setDevoluciones(data);setRefundForm(emptyRefund());await load(true);}catch(e:any){setModalError(e?.message||"No fue posible registrar la devolución.");}finally{setOpSaving(false);}
  };

  const clear=()=>{setSearch("");setFecha("");setPlan("");setHora("");setMina("");setRefrigerio("");setRestaurante("");setAlmuerzo("");setSaldo("");setEstado("");setMedioDetalle(null);};
  if(loading)return <div className="op-loading">Cargando control operativo…</div>;
  let prev:number|null=null;

  return <div className="op-page">
    <div className="op-head"><div><h1>Control Operativo</h1><p>Reservas, asistencia, reprogramaciones, devoluciones, servicios, códigos CH y pagos.</p></div><div className="op-head-actions"><button className="op-btn secondary" onClick={()=>load(true)}><RefreshCw size={16} className={refreshing?"spin-icon":""}/> Actualizar</button><button className="op-btn primary" onClick={()=>window.print()}><Download size={16}/> Exportar</button></div></div>
    {error&&<div className="op-error">{error}</div>}

    <div className="op-filters">
      <div className="op-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar código, nombre, documento…"/></div>
      <label><span>Fecha reserva</span><input type="date" value={fecha} onChange={(e)=>{setFecha(e.target.value);setMedioDetalle(null)}}/></label>
      <label><span>Plan</span><select value={plan} onChange={(e)=>setPlan(e.target.value)}><option value="">Todos</option>{planes.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label><span>Estado operativo</span><select value={estado} onChange={(e)=>setEstado(e.target.value)}><option value="">Todos</option>{ESTADOS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
      <label><span>Horario</span><select value={hora} onChange={(e)=>setHora(e.target.value)}><option value="">Todos</option>{horas.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label><span>Mina</span><select value={mina} onChange={(e)=>setMina(e.target.value)}><option value="">Todos</option><option value="si">Sí</option><option value="no">No</option></select></label>
      <label><span>Refrigerio</span><select value={refrigerio} onChange={(e)=>setRefrigerio(e.target.value)}><option value="">Todos</option><option value="si">Sí</option><option value="no">No</option></select></label>
      <label><span>Restaurante</span><select value={restaurante} onChange={(e)=>setRestaurante(e.target.value)}><option value="">Todos</option>{restaurantes.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label><span>Almuerzo</span><select value={almuerzo} onChange={(e)=>setAlmuerzo(e.target.value)}><option value="">Todos</option><option value="si">Con almuerzo</option><option value="no">Sin almuerzo</option></select></label>
      <label><span>Saldo</span><select value={saldo} onChange={(e)=>setSaldo(e.target.value)}><option value="">Todos</option><option value="pendiente">Pendiente</option><option value="pagado">Pagado</option></select></label>
      <button className="op-clear" onClick={clear}><X size={14}/> Limpiar</button>
    </div>

    <div className="op-summary"><span><Filter size={14}/>{filtered.length} filas</span><span>{reservas.length} reservas</span><span>Ventas activas: <b>{money(totalVentas)}</b></span><span>Recaudado: <b>{money(totalRecaudo)}</b></span><span>Devuelto: <b>{money(totalDevuelto)}</b></span><span>Neto caja: <b>{money(Math.max(0,totalRecaudo-totalDevuelto))}</b></span><span>Saldo pendiente: <b>{money(reservas.filter(r=>r.estado_operativo!=="cancelada").reduce((s,r)=>s+r.saldo_pendiente,0))}</b></span></div>

    {fecha&&<section className="op-cash-day"><div><strong>Recaudo de las reservas del {fmt(fecha)}</strong><small>Haz clic en un medio para ver exactamente de qué reservas salió el dinero. Las devoluciones se descuentan del neto.</small></div><div className="op-cash-items">{cajaMedios.length?cajaMedios.map(([m,v])=><button type="button" className="op-cash-card" key={m} onClick={()=>setMedioDetalle(m)}><span>{m}</span><b>{money(v)}</b><small>Ver detalle</small></button>):<span className="op-cash-empty">No hay movimientos registrados para estas reservas.</span>}<div className="op-cash-total"><span>Recaudado</span><b>{money(totalRecaudo)}</b></div><div className="op-cash-total refund"><span>Devuelto</span><b>{money(totalDevuelto)}</b></div><div className="op-cash-total net"><span>Neto</span><b>{money(Math.max(0,totalRecaudo-totalDevuelto))}</b></div></div></section>}

    <div className="op-table-wrap"><table className="op-table op-table-operational"><thead><tr><th>Código</th><th>Plan</th><th>Estado</th><th>Fecha</th><th>Hora</th><th>Nombre</th><th>Edad</th><th>Nacionalidad</th><th>Documento</th><th>Contacto</th><th>Cant.</th><th>Mina</th><th>Refrigerio</th><th>Restaurante</th><th>Almuerzo</th><th>Total</th><th>Abono</th><th>Medio abono</th><th>Pago saldo</th><th>Devuelto</th><th>Neto</th><th>Medio saldo</th><th>Pendiente</th><th>Observación</th><th>Acciones</th></tr></thead><tbody>{filtered.map((r,i)=>{const first=prev!==r.id_reserva;prev=r.id_reserva;const devuelto=devolucionMap.get(r.id_reserva)||0;const cobrado=r.abono+r.pago_saldo;return <tr key={`${r.id_reserva}-${r.id_participante??i}`} className={`${first?"group-start":""} status-row-${r.estado_operativo}`}><td><strong>{r.reserva_codigo}</strong></td><td>{r.plan}</td><td>{first?<span className={`op-status-badge status-${r.estado_operativo}`}>{estadoLabel(r.estado_operativo)}</span>:""}</td><td>{fmt(r.fecha)}</td><td>{hk(r.hora)||"—"}</td><td>{r.nombre}</td><td>{r.edad??"—"}</td><td>{r.nacionalidad}</td><td>{r.documento}</td><td>{r.contacto}</td><td>{first?r.cantidad:""}</td><td>{r.mina?"SI":"NO"}</td><td>{r.refrigerio?"SI":"NO"}</td><td>{r.restaurante||"—"}</td><td>{r.incluye_almuerzo?"Sí":"No"}</td><td>{first?money(r.total):""}</td><td>{first?money(r.abono):""}</td><td>{first?r.medio_abono:""}</td><td>{first?money(r.pago_saldo):""}</td><td className="refund-money">{first&&devuelto>0?money(devuelto):first?"$0":""}</td><td>{first?money(Math.max(0,cobrado-devuelto)):""}</td><td>{first?(r.medio_saldo||(r.pago_saldo>0?"Varios medios":"")):""}</td><td className={r.saldo_pendiente>0?"pending-money":"paid-money"}>{first?money(r.saldo_pendiente):""}</td><td>{first?r.observacion:""}</td><td><button className="op-icon-btn" onClick={()=>openEdit(r)} title="Gestionar reserva"><Pencil size={15}/></button></td></tr>})}</tbody></table></div>

    {medioDetalle&&<div className="op-modal-backdrop" onMouseDown={()=>setMedioDetalle(null)}><div className="op-modal op-cash-detail-modal" onMouseDown={(e)=>e.stopPropagation()}><div className="op-modal-head"><div><h2>Detalle de recaudo · {medioDetalle}</h2><p>{fecha?`Reservas del ${fmt(fecha)}`:"Reservas filtradas"} · Total {money(movimientosDetalle.reduce((s,p)=>s+p.monto,0))}</p></div><button onClick={()=>setMedioDetalle(null)}><X/></button></div><div className="op-cash-detail-body"><table className="op-cash-detail-table"><thead><tr><th>Reserva</th><th>Cliente / participante</th><th>Plan</th><th>Fecha reserva</th><th>Hora</th><th>Tipo</th><th>Registrado</th><th>Valor</th></tr></thead><tbody>{movimientosDetalle.map((p,i)=>{const r=rowByReserva.get(p.id_reserva);return <tr key={p.id_pago??i}><td><strong>{r?.reserva_codigo||`#${p.id_reserva}`}</strong></td><td>{r?.nombre||r?.contacto_cliente||"—"}</td><td>{r?.plan||"—"}</td><td>{r?.fecha?fmt(r.fecha):"—"}</td><td>{r?.hora?hk(r.hora):"—"}</td><td>{p.tipo_pago==="saldo"?"Saldo":"Abono"}</td><td>{fmtPago(p.fecha_pago)}</td><td><strong>{money(p.monto)}</strong></td></tr>})}</tbody></table>{!movimientosDetalle.length&&<div className="op-cash-empty-detail">No hay movimientos para este medio.</div>}</div><div className="op-cash-detail-footer"><span>{movimientosDetalle.length} movimiento{movimientosDetalle.length===1?"":"s"}</span><strong>Total: {money(movimientosDetalle.reduce((s,p)=>s+p.monto,0))}</strong></div></div></div>}

    {editing&&<div className="op-modal-backdrop"><div className="op-modal edit-modal"><div className="op-modal-head"><div><h2>Edición operativa</h2><p>Reserva {editing.reserva_codigo} · <span className={`op-status-badge status-${editing.estado_operativo}`}>{estadoLabel(editing.estado_operativo)}</span></p></div><button onClick={()=>!saving&&!opSaving&&setEditing(null)} disabled={saving||opSaving}><X/></button></div>
      {modalError&&<div className="op-modal-error">{modalError}</div>}

      <section className="op-management-section">
        <div className="op-section-title"><div className="op-section-icon"><UserCheck size={18}/></div><div><strong>Estado y asistencia</strong><small>Registra qué ocurrió realmente con esta reserva.</small></div></div>
        <div className="op-management-grid state-grid">
          <label>Estado operativo<select value={estadoDraft} onChange={e=>{setEstadoDraft(e.target.value as EstadoOperativo);setModalError(null)}}>{ESTADOS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <label className="wide-field">Motivo / detalle<input value={motivoEstado} onChange={e=>setMotivoEstado(e.target.value)} placeholder="Ej. cliente canceló por clima, no se presentó…"/></label>
          <button className="op-btn primary op-action-btn" disabled={opSaving||estadoDraft==="reprogramada"} onClick={applyEstado}>{estadoDraft==="cancelada"?<Ban size={15}/>:<UserCheck size={15}/>} Actualizar estado</button>
        </div>
      </section>

      <section className="op-management-section">
        <div className="op-section-title"><div className="op-section-icon"><CalendarClock size={18}/></div><div><strong>Reprogramar reserva</strong><small>Cambia la fecha y hora conservando la reserva, pagos, participante y trazabilidad.</small></div></div>
        <div className="op-management-grid reprogram-grid">
          <label>Nueva fecha{planMeta?.tipo_fecha==="fechas_especificas"?<select value={reprogFecha} onChange={e=>setReprogFecha(e.target.value)}><option value="">Selecciona fecha</option>{fechaOpts.map(f=><option key={f.id_fecha} value={f.fecha}>{fmt(f.fecha)}</option>)}</select>:<input type="date" min={today()} value={reprogFecha} onChange={e=>setReprogFecha(e.target.value)}/>}</label>
          <label>Nueva hora<select disabled={!horaOpts.length} value={reprogHora??""} onChange={e=>setReprogHora(e.target.value?Number(e.target.value):null)}><option value="">{horaOpts.length?"Selecciona hora":"Sin hora"}</option>{horaOpts.map(([id,h])=><option key={id} value={id}>{hk(h)}</option>)}</select></label>
          <label className="wide-field">Motivo de reprogramación<input value={reprogMotivo} onChange={e=>setReprogMotivo(e.target.value)} placeholder="Opcional, recomendado para historial"/></label>
          <button className="op-btn secondary op-action-btn" disabled={opSaving} onClick={doReprogram}><RotateCcw size={15}/> Reprogramar</button>
        </div>
      </section>

      <section className="op-management-section refund-section">
        <div className="op-section-title"><div className="op-section-icon"><RotateCcw size={18}/></div><div><strong>Devoluciones</strong><small>Registra devoluciones parciales o totales sin borrar el recaudo original.</small></div><div className="op-refund-resume"><span>Cobrado <b>{money(cobradoEdit)}</b></span><span>Devuelto <b>{money(devueltoEdit)}</b></span><span>Neto <b>{money(netoEdit)}</b></span></div></div>
        <div className="op-management-grid refund-grid">
          <label>Valor a devolver<input inputMode="numeric" value={refundForm.monto||""} onChange={e=>setRefundForm({...refundForm,monto:num(e.target.value)})} placeholder={`Máx. ${money(devolucionDisponible)}`}/></label>
          <label>Medio de devolución<select value={refundForm.medio_pago} onChange={e=>setRefundForm({...refundForm,medio_pago:e.target.value})}><option value="">Selecciona</option>{metodos.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Tipo<select value={refundForm.tipo_devolucion} onChange={e=>setRefundForm({...refundForm,tipo_devolucion:e.target.value as "parcial"|"total"})}><option value="parcial">Parcial</option><option value="total">Total</option></select></label>
          <label>Motivo<input value={refundForm.motivo} onChange={e=>setRefundForm({...refundForm,motivo:e.target.value})} placeholder="Ej. cancelación"/></label>
          <label className="wide-field">Observación<input value={refundForm.observacion} onChange={e=>setRefundForm({...refundForm,observacion:e.target.value})} placeholder="Detalle adicional"/></label>
          <button className="op-btn danger-soft op-action-btn" disabled={opSaving||devolucionDisponible<=0} onClick={doRefund}><RotateCcw size={15}/> Registrar devolución</button>
        </div>
        {!!devolucionesReserva.length&&<div className="op-mini-history">{devolucionesReserva.map(d=><div key={d.id_devolucion}><span className="op-history-dot refund-dot"/><div><strong>{money(d.monto)} · {d.tipo_devolucion}</strong><small>{d.medio_pago} · {fmtPago(d.fecha_devolucion)}{d.motivo?` · ${d.motivo}`:""}</small></div></div>)}</div>}
      </section>

      <div className="op-edit-divider"><span>Datos de la reserva</span></div>
      <div className="op-edit-grid">
        <label>Código actual<input value={editing.reserva_codigo} readOnly/></label>
        <label>Fecha actual<input value={fmt(editing.fecha)} readOnly/></label>
        <label>Plan<select value={editing.id_plan??""} onChange={(e)=>handlePlanChange(e.target.value?Number(e.target.value):null)}>{planOpts.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label>
        <label>CH operativo<select value={editing.id_codigo_operativo??""} onChange={(e)=>setEditing({...editing,id_codigo_operativo:e.target.value?Number(e.target.value):null})}><option value="">Sin CH compatible</option>{chOptions.map((c)=><option key={c.id_codigo_operativo} value={c.id_codigo_operativo}>{c.codigo_ch} — {c.descripcion}</option>)}</select></label>
        <label>Incluye almuerzo<select value={editing.incluye_almuerzo?"si":"no"} onChange={(e)=>{const yes=e.target.value==="si";setEditing(syncCH({...editing,incluye_almuerzo:yes,restaurante:yes?editing.restaurante:""}))}}><option value="no">No</option><option value="si">Sí</option></select></label>
        <label>Restaurante<select disabled={!editing.incluye_almuerzo} value={editing.restaurante} onChange={(e)=>setEditing(syncCH({...editing,restaurante:e.target.value}))}><option value="">General / sin restaurante específico</option>{restaurantes.map((x)=><option key={x}>{x}</option>)}</select></label>
        <label>Hora<select value={editing.id_hora??""} onChange={(e)=>setEditing({...editing,id_hora:e.target.value?Number(e.target.value):null})}><option value="">Sin hora</option>{horaOpts.map(([id,h])=><option key={id} value={id}>{hk(h)}</option>)}</select></label>
        <label>Nombre<input value={editing.nombre} onChange={(e)=>setEditing({...editing,nombre:e.target.value})}/></label>
        <label>Edad<input inputMode="numeric" value={editing.edad??""} onChange={(e)=>setEditing({...editing,edad:num(e.target.value)})}/></label>
        <label>Nacionalidad<input value={editing.nacionalidad} onChange={(e)=>setEditing({...editing,nacionalidad:e.target.value})}/></label>
        <label>Documento<input value={editing.documento} onChange={(e)=>setEditing({...editing,documento:e.target.value})}/></label>
        <label>Contacto<input value={editing.contacto} onChange={(e)=>setEditing({...editing,contacto:e.target.value})}/></label>
        <label>Tipo almuerzo<input value={editing.almuerzo} onChange={(e)=>setEditing({...editing,almuerzo:e.target.value})} placeholder="Opcional"/></label>
        <label>Total<input inputMode="numeric" value={editing.total} onChange={(e)=>setEditing({...editing,total:num(e.target.value)})}/></label>
        <label>Abono<input inputMode="numeric" value={editing.abono} onChange={(e)=>setEditing({...editing,abono:num(e.target.value)})}/></label>
        <label>Medio abono<select value={editing.medio_abono} onChange={(e)=>setEditing({...editing,medio_abono:e.target.value})}><option value="">Sin método</option>{metodos.map((x)=><option key={x}>{x}</option>)}</select></label>
        <div className="op-checks"><label><input type="checkbox" checked={!!editing.mina} onChange={(e)=>setEditing({...editing,mina:e.target.checked})}/> Mina</label><label><input type="checkbox" checked={!!editing.refrigerio} onChange={(e)=>setEditing({...editing,refrigerio:e.target.checked})}/> Refrigerio</label></div>
        <div className="op-payments full"><div className="op-payments-head"><div><strong>Pagos del saldo</strong><small>Puede dividir el saldo entre varios medios de pago.</small></div><button className="op-btn secondary" onClick={()=>setSplits([...splits,{monto:0,medio_pago:""}])}><Plus size={15}/> Añadir medio</button></div>{splits.map((p,i)=><div className="op-payment-row" key={i}><label>Valor<input inputMode="numeric" value={p.monto||""} onChange={(e)=>setSplits(splits.map((x,j)=>j===i?{...x,monto:num(e.target.value)}:x))}/></label><label>Medio<select value={p.medio_pago} onChange={(e)=>setSplits(splits.map((x,j)=>j===i?{...x,medio_pago:e.target.value}:x))}><option value="">Seleccione</option>{metodos.map((x)=><option key={x}>{x}</option>)}</select></label><button className="op-remove-payment" onClick={()=>setSplits(splits.filter((_,j)=>j!==i))} title="Quitar"><Trash2 size={16}/></button></div>)}<div className="op-payment-totals"><span>Saldo pagado: <b>{money(totalSplit)}</b></span><span>Pendiente: <b>{money(pendienteEdit)}</b></span></div></div>
        <label className="full">Observación<textarea rows={3} value={editing.observacion} onChange={(e)=>setEditing({...editing,observacion:e.target.value})}/></label>
      </div>

      <section className="op-management-section history-section">
        <div className="op-section-title"><div className="op-section-icon"><History size={18}/></div><div><strong>Historial operativo</strong><small>Los cambios de estado y reprogramaciones quedan registrados.</small></div></div>
        {historial.length?<div className="op-mini-history">{historial.map(h=><div key={h.id_historial}><span className="op-history-dot"/><div><strong>{h.tipo_evento.replace(/_/g," ")} {h.estado_nuevo?`· ${estadoLabel(h.estado_nuevo)}`:""}</strong><small>{fmtPago(h.created_at)}{h.detalle?` · ${h.detalle}`:""}</small></div></div>)}</div>:<div className="op-history-empty">Aún no hay movimientos operativos registrados.</div>}
      </section>

      <div className="op-modal-footer"><button className="op-btn secondary" disabled={saving||opSaving} onClick={()=>setEditing(null)}>Cancelar</button><button className="op-btn primary" disabled={saving||opSaving} onClick={save}><SlidersHorizontal size={16}/>{saving?"Guardando…":"Guardar datos"}</button></div>
    </div></div>}
  </div>;
}
