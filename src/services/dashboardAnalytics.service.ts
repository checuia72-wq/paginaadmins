import { supabase } from "../lib/supabase";

export interface DashboardPlan { id_plan:number; nombre_plan:string; precio_plan?:number|null; }
export interface DashboardReserva {
  id_reserva:number; fecha_solicitud?:string|null; fecha_aprobacion?:string|null; fecha_reserva?:string|null; telefono_cliente?:string|null;
  id_plan?:number|null; id_fecha?:number|null; cantidad_personas?:number|null; aprobado?:boolean|null; precio_unitario?:number|null;
  valor_total?:number|null; valor_abonado?:number|null; valor_saldo_pagado?:number|null;
  metodo_pago_abono?:string|null; metodo_pago_saldo?:string|null; estado_operativo?:string|null; plan?:DashboardPlan|null;
}
export interface DashboardCliente { telefono:string; atencion_humana?:boolean|null; etapaconversacion?:string|null; }
export interface DashboardParticipante { id_participante:number; id_reserva?:number|null; }
export interface DashboardPago { id_pago?:number; id_reserva:number; tipo_pago:"abono"|"saldo"; monto:number; medio_pago:string; fecha_pago?:string|null; }
export interface DashboardDevolucion { id_devolucion?:number; id_reserva:number; monto:number; medio_pago:string; fecha_devolucion?:string|null; }
export interface DashboardAnalyticsData {
  reservas:DashboardReserva[]; planes:DashboardPlan[]; clientes:DashboardCliente[]; participantes:DashboardParticipante[]; pagos:DashboardPago[]; devoluciones:DashboardDevolucion[]; metodosPago:string[];
}

function client(){ if(!supabase) throw new Error("Supabase no está configurado"); return supabase; }
const cleanMethod=(value:unknown)=>String(value??"").trim().toLowerCase();

export async function getDashboardAnalytics():Promise<DashboardAnalyticsData>{
  const db=client();
  const [reservasResult,planesResult,clientesResult,participantesResult,pagosResult,devolucionesResult]=await Promise.all([
    db.from("reserva").select(`id_reserva,fecha_solicitud,fecha_aprobacion,telefono_cliente,id_plan,id_fecha,cantidad_personas,aprobado,precio_unitario,valor_total,valor_abonado,valor_saldo_pagado,metodo_pago_abono,metodo_pago_saldo,estado_operativo,plan (id_plan,nombre_plan,precio_plan),plan_fechas (id_fecha,fecha)`).order("id_reserva",{ascending:false}),
    db.from("plan").select("id_plan, nombre_plan, precio_plan").order("id_plan",{ascending:true}),
    db.from("cliente").select("telefono, atencion_humana, etapaconversacion"),
    db.from("participante").select("id_participante, id_reserva"),
    db.from("reserva_pago").select("id_pago,id_reserva,tipo_pago,monto,medio_pago,fecha_pago").order("fecha_pago",{ascending:false}),
    db.from("reserva_devolucion").select("id_devolucion,id_reserva,monto,medio_pago,fecha_devolucion").order("fecha_devolucion",{ascending:false}),
  ]);
  if(reservasResult.error) throw reservasResult.error;
  if(planesResult.error) throw planesResult.error;
  if(clientesResult.error) throw clientesResult.error;
  if(participantesResult.error) throw participantesResult.error;
  if(pagosResult.error) throw pagosResult.error;
  if(devolucionesResult.error) throw devolucionesResult.error;

  const reservas=((reservasResult.data??[]) as any[]).map(r=>({
    ...r, fecha_reserva:String(r.plan_fechas?.fecha??"").slice(0,10)||null,
    valor_total:Number(r.valor_total||0), valor_abonado:Number(r.valor_abonado||0), valor_saldo_pagado:Number(r.valor_saldo_pagado||0),
    metodo_pago_abono:cleanMethod(r.metodo_pago_abono)||null, metodo_pago_saldo:cleanMethod(r.metodo_pago_saldo)||null,
    estado_operativo:String(r.estado_operativo||"programada"),
  })) as DashboardReserva[];

  const pagos=((pagosResult.data??[]) as any[]).map(p=>({id_pago:p.id_pago==null?undefined:Number(p.id_pago),id_reserva:Number(p.id_reserva),tipo_pago:p.tipo_pago,monto:Number(p.monto||0),medio_pago:cleanMethod(p.medio_pago),fecha_pago:p.fecha_pago??null})).filter(p=>p.id_reserva>0&&p.monto>0&&p.medio_pago) as DashboardPago[];
  const devoluciones=((devolucionesResult.data??[]) as any[]).map(d=>({id_devolucion:d.id_devolucion==null?undefined:Number(d.id_devolucion),id_reserva:Number(d.id_reserva),monto:Number(d.monto||0),medio_pago:cleanMethod(d.medio_pago),fecha_devolucion:d.fecha_devolucion??null})).filter(d=>d.id_reserva>0&&d.monto>0) as DashboardDevolucion[];

  const usados=[...reservas.flatMap(r=>[cleanMethod(r.metodo_pago_abono),cleanMethod(r.metodo_pago_saldo)]),...pagos.map(p=>p.medio_pago),...devoluciones.map(d=>d.medio_pago)].filter(Boolean);
  const metodosPago=[...new Set(usados)].sort((a,b)=>a.localeCompare(b,"es"));
  return {reservas,planes:(planesResult.data??[]) as DashboardPlan[],clientes:(clientesResult.data??[]) as DashboardCliente[],participantes:(participantesResult.data??[]) as DashboardParticipante[],pagos,devoluciones,metodosPago};
}
