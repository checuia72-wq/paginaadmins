import { supabase } from "../lib/supabase";
import { getCurrentRole } from "./role.service";

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
  id_plan:number|null; plan:string; estado_operativo:EstadoOperativo; motivo_estado_operativo:string; fecha:string; id_hora:number|null; hora:string; nombre:string; edad:number|string; nacionalidad:string; documento:string; contacto:string; cantidad:number; mina:boolean; refrigerio:boolean; restaurante:string; almuerzo:string; total:number; abono:number; medio_abono:string; referencia_pago_abono:string; pago_saldo:number; medio_saldo:string; saldo_pendiente:number; observacion:string;
};

function text(v:unknown){return String(v??"");}
function num(v:unknown){const n=Number(v);return Number.isFinite(n)?n:0;}
function bool(v:unknown){return v===true||v==="true"||v===1||v==="1";}
function dateOnly(v:unknown){const s=text(v);return s?s.slice(0,10):"";}
function timeOnly(v:unknown){const s=text(v);if(!s)return"";const m=s.match(/(?:T|\s)(\d{2}:\d{2})(?::\d{2})?/);return m?.[1]??s.slice(0,5);}

export async function getControlOperativo():Promise<ControlOperativoRow[]>{
  const db=client();
  const{data,error}=await db.from("vista_control_operativo").select("*");
  if(error)throw error;
  const rows=(data??[]) as any[];
  return rows.map((r:any)=>({
    id_reserva:num(r.id_reserva),
    id_participante:r.id_participante==null?null:num(r.id_participante),
    reserva_codigo:text(r.codigo_reserva??r.reserva_codigo),
    id_codigo_operativo:r.id_codigo_operativo==null?null:num(r.id_codigo_operativo),
    incluye_almuerzo:bool(r.incluye_almuerzo),
    id_plan:r.id_plan==null?null:num(r.id_plan),
    plan:text(r.plan??r.nombre_plan),
    estado_operativo:(text(r.estado_operativo)||"programada") as EstadoOperativo,
    motivo_estado_operativo:text(r.motivo_estado_operativo),
    fecha:dateOnly(r.fecha_reserva??r.fecha),
    id_hora:r.id_hora==null?null:num(r.id_hora),
    hora:timeOnly(r.hora??r.hora_reserva??r.fecha_reserva),
    nombre:text(r.nombre),
    edad:r.edad??"",
    nacionalidad:text(r.nacionalidad),
    documento:text(r.numero_documento??r.documento),
    contacto:text(r.telefono_participante??r.contacto),
    cantidad:num(r.cantidad_personas??r.cantidad),
    mina:bool(r.mina),
    refrigerio:bool(r.refrigerio),
    restaurante:text(r.restaurante),
    almuerzo:text(r.tipo_almuerzo??r.almuerzo),
    total:num(r.valor_total??r.total),
    abono:num(r.valor_abonado??r.abono),
    medio_abono:text(r.metodo_pago_abono??r.medio_abono),
    referencia_pago_abono:text(r.referencia_pago_abono),
    pago_saldo:num(r.valor_saldo_pagado??r.pago_saldo),
    medio_saldo:text(r.metodo_pago_saldo??r.medio_saldo),
    saldo_pendiente:num(r.saldo_pendiente),
    observacion:text(r.observacion),
  }));
}

export async function getPagosControlOperativo():Promise<ReservaPago[]>{const{data,error}=await client().from("reserva_pago").select("*").order("fecha_pago",{ascending:false});if(error)throw error;return(data??[]).map((r:any)=>({...r,id_reserva:num(r.id_reserva),monto:num(r.monto),medio_pago:text(r.medio_pago)}));}
export async function getDevolucionesControlOperativo():Promise<ReservaDevolucion[]>{const{data,error}=await client().from("reserva_devolucion").select("*").order("fecha_devolucion",{ascending:false});if(error)throw error;return(data??[]).map((r:any)=>({...r,id_devolucion:num(r.id_devolucion),id_reserva:num(r.id_reserva),monto:num(r.monto),medio_pago:text(r.medio_pago),tipo_devolucion:r.tipo_devolucion,motivo:r.motivo??null,observacion:r.observacion??null,fecha_devolucion:text(r.fecha_devolucion)}));}
export async function getReservaPagos(idReserva:number):Promise<ReservaPago[]>{const{data,error}=await client().from("reserva_pago").select("*").eq("id_reserva",idReserva).order("fecha_pago",{ascending:true});if(error)throw error;return(data??[]).map((r:any)=>({...r,id_reserva:num(r.id_reserva),monto:num(r.monto),medio_pago:text(r.medio_pago)}));}
export async function getReservaOperacionHistorial(idReserva:number):Promise<ReservaOperacionHistorial[]>{const{data,error}=await client().from("reserva_operacion_historial").select("*").eq("id_reserva",idReserva).order("created_at",{ascending:false});if(error)throw error;return(data??[]) as ReservaOperacionHistorial[];}

export async function cambiarEstadoOperativo(args:{id_reserva:number;estado:EstadoOperativo;motivo?:string|null}){
  const{data,error}=await client().rpc("cambiar_estado_operativo_reserva",{p_id_reserva:args.id_reserva,p_estado:args.estado,p_motivo:args.motivo?.trim()||null});if(error)throw error;return data;
}
export async function reprogramarReservaOperativa(args:{id_reserva:number;fecha:string;id_hora:number|null;motivo?:string|null}){
  const{data,error}=await client().rpc("reprogramar_reserva_operativa",{p_id_reserva:args.id_reserva,p_fecha:args.fecha,p_id_hora:args.id_hora,p_motivo:args.motivo?.trim()||null});if(error)throw error;return data;
}
export async function asegurarFechaPlan(idPlan:number,fecha:string){const{data,error}=await client().from("plan_fechas").select("id_fecha").eq("id_plan",idPlan).eq("fecha",fecha).maybeSingle();if(error)throw error;if(data?.id_fecha)return num(data.id_fecha);const{data:created,error:createError}=await client().from("plan_fechas").insert({id_plan:idPlan,fecha}).select("id_fecha").single();if(createError)throw createError;return num(created.id_fecha);}
export async function registrarDevolucionReserva(args:{id_reserva:number;monto:number;medio_pago:string;tipo_devolucion:"parcial"|"total";motivo?:string|null;observacion?:string|null}){
  const {data,error}=await client().rpc("registrar_devolucion_reserva",{p_id_reserva:args.id_reserva,p_monto:args.monto,p_medio_pago:args.medio_pago,p_tipo_devolucion:args.tipo_devolucion,p_motivo:args.motivo?.trim()||null,p_observacion:args.observacion?.trim()||null});
  if(error)throw error;
  return data==null?null:Number(data);
}

export async function replaceSaldoPagos(idReserva:number,pagos:Array<{monto:number;medio_pago:string}>){const validos=pagos.filter(p=>num(p.monto)>0&&text(p.medio_pago).trim());const total=validos.reduce((s,p)=>s+num(p.monto),0);const{error:deleteError}=await client().from("reserva_pago").delete().eq("id_reserva",idReserva).eq("tipo_pago","saldo");if(deleteError)throw deleteError;if(validos.length){const{error:insertError}=await client().from("reserva_pago").insert(validos.map(p=>({id_reserva:idReserva,tipo_pago:"saldo",monto:num(p.monto),medio_pago:p.medio_pago.trim()})));if(insertError)throw insertError;}const metodo=validos.length===1?validos[0].medio_pago:null;const{error:updateError}=await client().from("reserva").update({valor_saldo_pagado:total,metodo_pago_saldo:metodo}).eq("id_reserva",idReserva);if(updateError)throw updateError;return total;}
export async function updateControlReserva(idReserva:number,payload:Record<string,unknown>){
  const patch={...payload};
  if(Object.prototype.hasOwnProperty.call(patch,"referencia_pago_abono")){
    const ref=text(patch.referencia_pago_abono).trim().toUpperCase();
    patch.referencia_pago_abono=ref||null;
  }
  const{data,error}=await client().from("reserva").update(patch).eq("id_reserva",idReserva).select().single();if(error)throw error;return data;
}
export async function updateControlParticipante(idParticipante:number,payload:Record<string,unknown>){const{data,error}=await client().from("participante").update(payload).eq("id_participante",idParticipante).select().single();if(error)throw error;return data;}

export async function updateAdminReservationTotal(args:{id_reserva:number;valor_total:number;observacion:string}){
  const currentRole=await getCurrentRole();
  if(currentRole?.role!=="administrador")throw new Error("Solo un administrador puede cambiar el valor total de una reserva.");
  const total=num(args.valor_total);
  const observation=text(args.observacion).trim();
  if(total<=0)throw new Error("El valor total debe ser mayor a $0.");
  if(!observation)throw new Error("La observación es obligatoria para cambiar el valor total.");

  const db=client();
  const{data:current,error:currentError}=await db.from("reserva").select("id_reserva,cantidad_personas,valor_total,precio_unitario,observacion").eq("id_reserva",args.id_reserva).single();
  if(currentError)throw currentError;
  const cantidad=Math.max(1,num(current.cantidad_personas));
  const unitario=total/cantidad;
  const prevObservation=text(current.observacion).trim();
  const finalObservation=prevObservation&&prevObservation!==observation?`${prevObservation} | ${observation}`:observation;
  const{data,error}=await db.from("reserva").update({valor_total:total,precio_unitario:unitario,observacion:finalObservation}).eq("id_reserva",args.id_reserva).select().single();
  if(error)throw error;
  return data;
}