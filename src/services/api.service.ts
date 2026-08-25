import { supabase } from "../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

/* ─── PLANES ─────────────────────────────────────────────── */

export async function getPlanes() {
  const { data, error } = await getClient()
    .from("plan")
    .select(`*, plan_fechas (*), plan_horas (*)`)
    .order("id_plan", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPlan(payload: any) {
  const { plan_fechas, plan_horas, ...rawPlanData } = payload;
  const planData = sanitizePlanData(rawPlanData);
  const { data: plan, error: planError } = await getClient().from("plan").insert(planData).select().single();
  if (planError) throw planError;

  if (plan_fechas?.length) {
    const { error } = await getClient()
      .from("plan_fechas")
      .insert(plan_fechas.map((f: any) => ({ fecha: f.fecha, id_plan: plan.id_plan })));
    if (error) throw error;
  }

  if (plan_horas?.length) {
    const { error } = await getClient()
      .from("plan_horas")
      .insert(plan_horas.map((h: any) => ({ hora: h.hora, id_plan: plan.id_plan })));
    if (error) throw error;
  }

  return plan;
}

type PlanFechaInput = { id_fecha?: number; fecha: string };
type PlanHoraInput = { id_hora?: number; hora: string };

function sanitizePlanData(raw: Record<string, any>) {
  const allowed = [
    "nombre_plan",
    "precio_plan",
    "descripcion_basica",
    "descripcion_detallada",
    "imagen_url",
    "numero_plan",
    "tipo_fecha",
    "tipo_hora",
    "id_plan_padre",
    "es_grupo",
    "activo",
  ] as const;

  const clean: Record<string, any> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== undefined) {
      clean[key] = raw[key];
    }
  }
  return clean;
}

async function syncPlanFechas(idPlan: number, incoming: PlanFechaInput[] = [], preserveWhenEmpty = false) {
  const db = getClient();
  const { data: existing, error } = await db
    .from("plan_fechas")
    .select("id_fecha,id_plan,fecha")
    .eq("id_plan", idPlan)
    .order("id_fecha", { ascending: true });
  if (error) throw error;

  const current = existing ?? [];
  const validIncoming = incoming.filter((f) => String(f?.fecha ?? "").trim());
  if (preserveWhenEmpty && validIncoming.length === 0) return;

  const currentById = new Map(current.map((row: any) => [Number(row.id_fecha), row]));
  const currentByFecha = new Map(current.map((row: any) => [String(row.fecha), row]));
  const resolved = validIncoming.map((f) => {
    const byId = f.id_fecha != null ? currentById.get(Number(f.id_fecha)) : null;
    const byFecha = currentByFecha.get(String(f.fecha));
    return { ...f, existing: byId ?? byFecha ?? null };
  });

  const idsToKeep = new Set<number>();
  const idsChanging = new Set<number>();
  for (const item of resolved) {
    if (item.existing) {
      const id = Number(item.existing.id_fecha);
      idsToKeep.add(id);
      if (String(item.existing.fecha) !== String(item.fecha)) idsChanging.add(id);
    }
  }

  const idsToDelete = current.map((row: any) => Number(row.id_fecha)).filter((id: number) => !idsToKeep.has(id));
  const protectedIds = [...new Set([...idsChanging, ...idsToDelete])];
  if (protectedIds.length) {
    const { data: refs, error: refsError } = await db.from("reserva").select("id_reserva,id_fecha,codigo_reserva").in("id_fecha", protectedIds).limit(1);
    if (refsError) throw refsError;
    if (refs?.length) throw new Error(`No se puede cambiar o eliminar una fecha que ya está usada por la reserva ${refs[0].codigo_reserva || `#${refs[0].id_reserva}`}. Puedes agregar fechas nuevas sin eliminar la fecha ya reservada.`);
  }

  for (const item of resolved) {
    if (item.existing) {
      if (String(item.existing.fecha) !== String(item.fecha)) {
        const { error: updateError } = await db.from("plan_fechas").update({ fecha: item.fecha }).eq("id_fecha", item.existing.id_fecha);
        if (updateError) throw updateError;
      }
    } else {
      const { error: insertError } = await db.from("plan_fechas").insert({ id_plan: idPlan, fecha: item.fecha });
      if (insertError) throw insertError;
    }
  }
  if (idsToDelete.length) {
    const { error: deleteError } = await db.from("plan_fechas").delete().in("id_fecha", idsToDelete);
    if (deleteError) throw deleteError;
  }
}

async function syncPlanHoras(idPlan: number, incoming: PlanHoraInput[] = [], preserveWhenEmpty = false) {
  const db = getClient();
  const { data: existing, error } = await db.from("plan_horas").select("id_hora,id_plan,hora").eq("id_plan", idPlan).order("id_hora", { ascending: true });
  if (error) throw error;

  const current = existing ?? [];
  const normalizeHora = (v: unknown) => String(v ?? "").slice(0, 5);
  const validIncoming = incoming.filter((h) => normalizeHora(h?.hora));
  if (preserveWhenEmpty && validIncoming.length === 0) return;

  const currentById = new Map(current.map((row: any) => [Number(row.id_hora), row]));
  const currentByHora = new Map(current.map((row: any) => [normalizeHora(row.hora), row]));
  const resolved = validIncoming.map((h) => {
    const byId = h.id_hora != null ? currentById.get(Number(h.id_hora)) : null;
    const byHora = currentByHora.get(normalizeHora(h.hora));
    return { ...h, hora: normalizeHora(h.hora), existing: byId ?? byHora ?? null };
  });

  const idsToKeep = new Set<number>();
  const idsChanging = new Set<number>();
  for (const item of resolved) {
    if (item.existing) {
      const id = Number(item.existing.id_hora);
      idsToKeep.add(id);
      if (normalizeHora(item.existing.hora) !== item.hora) idsChanging.add(id);
    }
  }

  const idsToDelete = current.map((row: any) => Number(row.id_hora)).filter((id: number) => !idsToKeep.has(id));
  const protectedIds = [...new Set([...idsChanging, ...idsToDelete])];
  if (protectedIds.length) {
    const { data: refs, error: refsError } = await db.from("reserva").select("id_reserva,id_hora,codigo_reserva").in("id_hora", protectedIds).limit(1);
    if (refsError) throw refsError;
    if (refs?.length) throw new Error(`No se puede cambiar o eliminar una hora que ya está usada por la reserva ${refs[0].codigo_reserva || `#${refs[0].id_reserva}`}. Puedes agregar horarios nuevos sin eliminar el horario ya reservado.`);
  }

  for (const item of resolved) {
    if (item.existing) {
      if (normalizeHora(item.existing.hora) !== item.hora) {
        const { error: updateError } = await db.from("plan_horas").update({ hora: item.hora }).eq("id_hora", item.existing.id_hora);
        if (updateError) throw updateError;
      }
    } else {
      const { error: insertError } = await db.from("plan_horas").insert({ id_plan: idPlan, hora: item.hora });
      if (insertError) throw insertError;
    }
  }
  if (idsToDelete.length) {
    const { error: deleteError } = await db.from("plan_horas").delete().in("id_hora", idsToDelete);
    if (deleteError) throw deleteError;
  }
}

export async function updatePlan(id: number, payload: any) {
  const { plan_fechas = [], plan_horas = [], ...rawPlanData } = payload;
  const planData = sanitizePlanData(rawPlanData);
  const preserveFechas = planData.tipo_fecha === "cualquier_dia";
  const preserveHoras = planData.tipo_hora === "sin_hora";

  const { data: rows, error: planError } = await getClient().from("plan").update(planData).eq("id_plan", id).select();
  if (planError) throw planError;
  if (!rows?.length) throw new Error("No se pudo actualizar el plan. Verifica permisos de edición.");

  await syncPlanFechas(id, plan_fechas, preserveFechas);
  await syncPlanHoras(id, plan_horas, preserveHoras);
  return rows[0];
}

export async function deletePlan(id: number) {
  const { error } = await getClient().from("plan").delete().eq("id_plan", id);
  if (error) throw error;
}

/* ─── CLIENTES ───────────────────────────────────────────── */
export async function getClientes(){const{data,error}=await getClient().from("cliente").select("telefono, atencion_humana, etapaconversacion, id_plan").order("telefono",{ascending:true});if(error)throw error;return data??[]}
export async function createCliente(payload:any){const{data,error}=await getClient().from("cliente").insert(payload).select().single();if(error)throw error;return data}
export async function updateCliente(telefono:string,payload:any){const{data,error}=await getClient().from("cliente").update(payload).eq("telefono",telefono).select().single();if(error)throw error;return data}
export async function deleteCliente(telefono:string){const{error}=await getClient().from("cliente").delete().eq("telefono",telefono);if(error)throw error}

/* ─── RESERVAS ───────────────────────────────────────────── */
export async function getReservas() {
  const { data, error } = await getClient().from("reserva").select(`
    id_reserva, codigo_reserva, fecha_solicitud, fecha_aprobacion, telefono_cliente,
    id_plan, id_fecha, id_hora, cantidad_personas, aprobado,
    precio_unitario, valor_total, valor_abonado, valor_saldo_pagado,
    mina, refrigerio, restaurante, observacion, metodo_pago_abono, metodo_pago_saldo,
    id_codigo_operativo, incluye_almuerzo, estado_operativo, motivo_estado_operativo, estado_operativo_at,
    plan:plan!reserva_id_plan_fkey(nombre_plan, plan_fechas(id_fecha,fecha), plan_horas(id_hora,hora))
  `).order("id_reserva", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    nombre_plan: r.plan?.nombre_plan ?? null,
    fecha_reserva: r.plan?.plan_fechas?.find((f:any)=>Number(f.id_fecha)===Number(r.id_fecha))?.fecha ?? null,
    hora_reserva: r.plan?.plan_horas?.find((h:any)=>Number(h.id_hora)===Number(r.id_hora))?.hora ?? null,
  }));
}

export async function createReserva(payload:any){const{data,error}=await getClient().from("reserva").insert(payload).select().single();if(error)throw error;return data}
export async function updateReserva(id:number,payload:any){const{data,error}=await getClient().from("reserva").update(payload).eq("id_reserva",id).select().single();if(error)throw error;return data}
export async function deleteReserva(id:number){const{error}=await getClient().from("reserva").delete().eq("id_reserva",id);if(error)throw error}

/* ─── PARTICIPANTES ──────────────────────────────────────── */
export async function getParticipantes(){const{data,error}=await getClient().from("participante").select("*").order("id_participante",{ascending:false});if(error)throw error;return data??[]}
export async function getParticipantesPorReserva(id:number){const{data,error}=await getClient().from("participante").select("*").eq("id_reserva",id).order("id_participante",{ascending:true});if(error)throw error;return data??[]}
export async function createParticipante(payload:any){const{data,error}=await getClient().from("participante").insert(payload).select().single();if(error)throw error;return data}
export async function updateParticipante(id:number,payload:any){const{data,error}=await getClient().from("participante").update(payload).eq("id_participante",id).select().single();if(error)throw error;return data}
export async function deleteParticipante(id:number){const{error}=await getClient().from("participante").delete().eq("id_participante",id);if(error)throw error}
