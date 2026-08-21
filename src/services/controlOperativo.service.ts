import { supabase } from "../lib/supabase";

function client() { if (!supabase) throw new Error("Supabase no está configurado"); return supabase; }

export type EstadoOperativo = "programada" | "asistio" | "no_asistio" | "reprogramada" | "cancelada";
export type ReservaPago = { id_pago?: number; id_reserva: number; tipo_pago: "abono" | "saldo"; monto: number; medio_pago: string; fecha_pago?: string; observacion?: string | null; };
export type RecaudoDiario = { fecha: string; medio_pago: string; tipo_pago: "abono" | "saldo"; total: number; cantidad_movimientos: number; };
export type ReservaDevolucion = {
  id_devolucion: number;
  id_reserva: number;
  monto: number;
  medio_pago: string;
  tipo_devolucion: "parcial" | "total";
  motivo: string | null;
  observacion: string | null;
  fecha_devolucion: string;
  created_at?: string;
};
export type ReservaOperacionHistorial = {
  id_historial: number;
  id_reserva: number;
  tipo_evento: "estado" | "reprogramacion" | "cancelacion" | "no_asistencia" | "asistencia";
  estado_anterior: string | null;
  estado_nuevo: string | null;
  id_fecha_anterior: number | null;
  id_fecha_nueva: number | null;
  id_hora_anterior: number | null;
  id_hora_nueva: number | null;
  detalle: string | null;
  created_at: string;
};

export type ControlOperativoRow = {
  id_reserva:number; id_participante:number|null; reserva_codigo:string; id_codigo_operativo:number|null; incluye_almuerzo:boolean;
  id_plan:number|null; id_fecha:number|null; id_hora:number|null; plan:string; fecha:string; hora:string; aprobado:boolean|null; nombre:string; edad:number|null; nacionalidad:string;
  tipo_documento:string; documento:string; contacto:string; contacto_cliente:string; cantidad:number|null; mina:boolean|null; refrigerio:boolean|null;
  restaurante:string; almuerzo:string; total:number; abono:number; medio_abono:string; pago_saldo:number; medio_saldo:string; saldo_pendiente:number; observacion:string;
  estado_operativo: EstadoOperativo; motivo_estado_operativo:string; estado_operativo_at:string;
};

const text=(value:unknown)=>(value==null?"":String(value));
const num=(value:unknown)=>{const n=Number(value??0);return Number.isFinite(n)?n:0;};
const dateOnly=(value:unknown)=>text(value).slice(0,10);
const hourOnly=(value:unknown)=>text(value).slice(0,5);

export async function getControlOperativo():Promise<ControlOperativoRow[]>{
  const [reservasRes,participantesRes,planesRes,fechasRes,horasRes]=await Promise.all([
    client().from("reserva").select("*").eq("aprobado",true).order("id_reserva",{ascending:false}),
    client().from("participante").select("*").order("id_participante",{ascending:true}),
    client().from("plan").select("*"),client().from("plan_fechas").select("*"),client().from("plan_horas").select("*")
  ]);
  const errors=[reservasRes.error,participantesRes.error,planesRes.error,fechasRes.error,horasRes.error].filter(Boolean);if(errors.length)throw errors[0];
  const reservas=reservasRes.data??[],participantes=participantesRes.data??[],planes=planesRes.data??[],fechas=fechasRes.data??[],horas=horasRes.data??[];
  const planMap=new Map(planes.map((p:any)=>[Number(p.id_plan),p]));const fechaMap=new Map<number,any>();const horaMap=new Map<number,any>();
  for(const f of fechas as any[]){for(const id of [f.id_fecha,f.id_plan_fecha,f.id])if(id!=null)fechaMap.set(Number(id),f);}
  for(const h of horas as any[]){for(const id of [h.id_hora,h.id_plan_hora,h.id])if(id!=null)horaMap.set(Number(id),h);}
  const participantesPorReserva=new Map<number,any[]>();for(const p of participantes as any[]){const id=Number(p.id_reserva);if(!participantesPorReserva.has(id))participantesPorReserva.set(id,[]);participantesPorReserva.get(id)!.push(p);}
  const rows:ControlOperativoRow[]=[];
  for(const r of reservas as any[]){
    const plan=planMap.get(Number(r.id_plan));const fechaId=r.id_fecha??r.id_plan_fecha??r.id_fecha_reserva;const horaId=r.id_hora??r.id_plan_hora??r.id_hora_reserva;
    const fechaRelacionada=fechaMap.get(Number(fechaId));const horaRelacionada=horaMap.get(Number(horaId));const personas=participantesPorReserva.get(Number(r.id_reserva))??[null];
    const fechaReserva=dateOnly(r.fecha_reserva??r.fecha??fechaRelacionada?.fecha_reserva??fechaRelacionada?.fecha);const horaReserva=hourOnly(r.hora_reserva??r.hora??horaRelacionada?.hora_reserva??horaRelacionada?.hora);
    const cantidadPersonas=r.cantidad_personas==null?personas.filter(Boolean).length:num(r.cantidad_personas);const precioPlan=num(plan?.precio_plan);
    const totalCalculado=precioPlan>0?precioPlan*cantidadPersonas:0;const totalRespaldo=num(r.valor_total)>0?num(r.valor_total):num(r.precio_unitario)*cantidadPersonas;const total=totalCalculado>0?totalCalculado:totalRespaldo;
    const abono=num(r.valor_abonado);const pagoSaldo=num(r.valor_saldo_pagado);const saldo=Math.max(0,total-abono-pagoSaldo);
    for(const p of personas){const contactoCliente=text(p?.telefono_cliente||r.telefono_cliente);rows.push({
      id_reserva:Number(r.id_reserva),id_participante:p?Number(p.id_participante):null,reserva_codigo:text(r.codigo_reserva)||`#${r.id_reserva}`,
      id_codigo_operativo:r.id_codigo_operativo==null?null:Number(r.id_codigo_operativo),incluye_almuerzo:!!r.incluye_almuerzo,
      id_plan:r.id_plan==null?null:Number(r.id_plan),id_fecha:fechaId==null?null:Number(fechaId),id_hora:horaId==null?null:Number(horaId),plan:text(plan?.nombre_plan),fecha:fechaReserva,hora:horaReserva,aprobado:r.aprobado??null,
      nombre:text(p?.nombre),edad:p?.edad==null?null:Number(p.edad),nacionalidad:text(p?.nacionalidad),tipo_documento:text(p?.tipo_documento),documento:text(p?.numero_documento),contacto:text(p?.telefono_participante||contactoCliente),contacto_cliente:contactoCliente,cantidad:cantidadPersonas,
      mina:r.mina??null,refrigerio:r.refrigerio??null,restaurante:text(r.restaurante),almuerzo:text(p?.tipo_almuerzo),total,abono,medio_abono:text(r.metodo_pago_abono),pago_saldo:pagoSaldo,medio_saldo:text(r.metodo_pago_saldo),saldo_pendiente:saldo,observacion:text(r.observacion),
      estado_operativo:(text(r.estado_operativo)||"programada") as EstadoOperativo,motivo_estado_operativo:text(r.motivo_estado_operativo),estado_operativo_at:text(r.estado_operativo_at)
    });}
  }
  return rows;
}

export async function getReservaPagos(idReserva:number):Promise<ReservaPago[]>{const{data,error}=await client().from("reserva_pago").select("id_pago,id_reserva,tipo_pago,monto,medio_pago,fecha_pago,observacion").eq("id_reserva",idReserva).order("fecha_pago",{ascending:true});if(error)throw error;return(data??[]).map((p:any)=>({...p,monto:num(p.monto)})) as ReservaPago[];}
export async function getPagosControlOperativo():Promise<ReservaPago[]>{const{data,error}=await client().from("reserva_pago").select("id_pago,id_reserva,tipo_pago,monto,medio_pago,fecha_pago,observacion").order("fecha_pago",{ascending:false});if(error)throw error;return(data??[]).map((p:any)=>({...p,id_reserva:Number(p.id_reserva),monto:num(p.monto)})) as ReservaPago[];}
export async function getRecaudoDiario():Promise<RecaudoDiario[]>{const{data,error}=await client().from("recaudo_diario").select("fecha,medio_pago,tipo_pago,total,cantidad_movimientos").order("fecha",{ascending:false});if(error)throw error;return(data??[]).map((r:any)=>({...r,total:num(r.total),cantidad_movimientos:num(r.cantidad_movimientos)})) as RecaudoDiario[];}

export async function getDevolucionesControlOperativo():Promise<ReservaDevolucion[]>{
  const {data,error}=await client().from("reserva_devolucion").select("id_devolucion,id_reserva,monto,medio_pago,tipo_devolucion,motivo,observacion,fecha_devolucion,created_at").order("fecha_devolucion",{ascending:false});
  if(error)throw error;
  return(data??[]).map((d:any)=>({...d,id_devolucion:Number(d.id_devolucion),id_reserva:Number(d.id_reserva),monto:num(d.monto)})) as ReservaDevolucion[];
}

export async function getReservaOperacionHistorial(idReserva:number):Promise<ReservaOperacionHistorial[]>{
  const {data,error}=await client().from("reserva_operacion_historial").select("id_historial,id_reserva,tipo_evento,estado_anterior,estado_nuevo,id_fecha_anterior,id_fecha_nueva,id_hora_anterior,id_hora_nueva,detalle,created_at").eq("id_reserva",idReserva).order("created_at",{ascending:false});
  if(error)throw error;
  return(data??[]).map((h:any)=>({...h,id_historial:Number(h.id_historial),id_reserva:Number(h.id_reserva),id_fecha_anterior:h.id_fecha_anterior==null?null:Number(h.id_fecha_anterior),id_fecha_nueva:h.id_fecha_nueva==null?null:Number(h.id_fecha_nueva),id_hora_anterior:h.id_hora_anterior==null?null:Number(h.id_hora_anterior),id_hora_nueva:h.id_hora_nueva==null?null:Number(h.id_hora_nueva)})) as ReservaOperacionHistorial[];
}

export async function cambiarEstadoOperativo(idReserva:number,estado:EstadoOperativo,motivo?:string|null){
  const {error}=await client().rpc("cambiar_estado_operativo_reserva",{p_id_reserva:idReserva,p_estado:estado,p_motivo:motivo?.trim()||null});
  if(error)throw error;
}

export async function reprogramarReservaOperativa(args:{id_reserva:number;id_plan:number;fecha:string;id_hora:number|null;motivo?:string|null}){
  let idFecha:number|null=null;
  const {data:fechaData,error:fechaError}=await client().rpc("get_or_create_plan_fecha",{p_plan_id:args.id_plan,p_fecha:args.fecha});
  if(fechaError)throw fechaError;
  idFecha=fechaData==null?null:Number(fechaData);
  if(!idFecha)throw new Error("No fue posible preparar la nueva fecha de la reserva.");
  const {error}=await client().rpc("reprogramar_reserva_operativa",{p_id_reserva:args.id_reserva,p_id_fecha:idFecha,p_id_hora:args.id_hora,p_motivo:args.motivo?.trim()||null});
  if(error)throw error;
  return idFecha;
}

export async function registrarDevolucionReserva(args:{id_reserva:number;monto:number;medio_pago:string;tipo_devolucion:"parcial"|"total";motivo?:string|null;observacion?:string|null}){
  const {data,error}=await client().rpc("registrar_devolucion_reserva",{p_id_reserva:args.id_reserva,p_monto:args.monto,p_medio_pago:args.medio_pago,p_tipo_devolucion:args.tipo_devolucion,p_motivo:args.motivo?.trim()||null,p_observacion:args.observacion?.trim()||null});
  if(error)throw error;
  return data==null?null:Number(data);
}

export async function replaceSaldoPagos(idReserva:number,pagos:Array<{monto:number;medio_pago:string}>){const validos=pagos.filter(p=>num(p.monto)>0&&text(p.medio_pago).trim());const total=validos.reduce((s,p)=>s+num(p.monto),0);const{error:deleteError}=await client().from("reserva_pago").delete().eq("id_reserva",idReserva).eq("tipo_pago","saldo");if(deleteError)throw deleteError;if(validos.length){const{error:insertError}=await client().from("reserva_pago").insert(validos.map(p=>({id_reserva:idReserva,tipo_pago:"saldo",monto:num(p.monto),medio_pago:p.medio_pago.trim()})));if(insertError)throw insertError;}const metodo=validos.length===1?validos[0].medio_pago:null;const{error:updateError}=await client().from("reserva").update({valor_saldo_pagado:total,metodo_pago_saldo:metodo}).eq("id_reserva",idReserva);if(updateError)throw updateError;return total;}
export async function updateControlReserva(idReserva:number,payload:Record<string,unknown>){const{data,error}=await client().from("reserva").update(payload).eq("id_reserva",idReserva).select().single();if(error)throw error;return data;}
export async function updateControlParticipante(idParticipante:number,payload:Record<string,unknown>){const{data,error}=await client().from("participante").update(payload).eq("id_participante",idParticipante).select().single();if(error)throw error;return data;}
