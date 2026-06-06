import { supabase } from "../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

/* ─── PLANES ─────────────────────────────────────────────── */

export async function getPlanes() {
  const { data, error } = await getClient()
    .from("plan")
    .select(`
      *,
      plan_fechas (*),
      plan_horas (*)
    `)
    .order("id_plan", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createPlan(payload: any) {
  const { plan_fechas, plan_horas, ...planData } = payload;

  const { data: plan, error: planError } = await getClient()
    .from("plan")
    .insert(planData)
    .select()
    .single();

  if (planError) throw planError;

  // Insertar fechas si existen
  if (plan_fechas && plan_fechas.length > 0) {
    const fechasPayload = plan_fechas.map((f: any) => ({ 
      fecha: f.fecha, 
      id_plan: plan.id_plan 
    }));
    const { error: fechasError } = await getClient()
      .from("plan_fechas")
      .insert(fechasPayload);
    if (fechasError) throw fechasError;
  }

  // Insertar horas si existen
  if (plan_horas && plan_horas.length > 0) {
    const horasPayload = plan_horas.map((h: any) => ({ 
      hora: h.hora, 
      id_plan: plan.id_plan 
    }));
    const { error: horasError } = await getClient()
      .from("plan_horas")
      .insert(horasPayload);
    if (horasError) throw horasError;
  }

  return plan;
}

export async function updatePlan(id: number, payload: any) {
  const { plan_fechas, plan_horas, ...planData } = payload;

  const { data: plan, error: planError } = await getClient()
    .from("plan")
    .update(planData)
    .eq("id_plan", id)
    .select()
    .single();

  if (planError) throw planError;

  // Actualizar fechas: Eliminar anteriores e insertar nuevas
  const { error: delFechasError } = await getClient()
    .from("plan_fechas")
    .delete()
    .eq("id_plan", id);
  if (delFechasError) throw delFechasError;

  if (plan_fechas && plan_fechas.length > 0) {
    const fechasPayload = plan_fechas.map((f: any) => ({ 
      fecha: f.fecha, 
      id_plan: id 
    }));
    const { error: insFechasError } = await getClient()
      .from("plan_fechas")
      .insert(fechasPayload);
    if (insFechasError) throw insFechasError;
  }

  // Actualizar horas: Eliminar anteriores e insertar nuevas
  const { error: delHorasError } = await getClient()
    .from("plan_horas")
    .delete()
    .eq("id_plan", id);
  if (delHorasError) throw delHorasError;

  if (plan_horas && plan_horas.length > 0) {
    const horasPayload = plan_horas.map((h: any) => ({ 
      hora: h.hora, 
      id_plan: id 
    }));
    const { error: insHorasError } = await getClient()
      .from("plan_horas")
      .insert(horasPayload);
    if (insHorasError) throw insHorasError;
  }

  return plan;
}

export async function deletePlan(id: number) {
  const { error } = await getClient()
    .from("plan")
    .delete()
    .eq("id_plan", id);

  if (error) throw error;
}

/* ─── CLIENTES ───────────────────────────────────────────── */
// La tabla cliente solo tiene: telefono (PK), atencion_humana (bool)
// No tiene nombre ni email — se usan tal cual.

export async function getClientes() {
  const { data, error } = await getClient()
    .from("cliente")
    // Incluye: telefono, atencion_humana, etapaconversacion, id_plan
    .select("telefono, atencion_humana, etapaconversacion, id_plan")
    .order("telefono", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createCliente(payload: any) {
  const { data, error } = await getClient()
    .from("cliente")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCliente(telefono: string, payload: any) {
  const { data, error } = await getClient()
    .from("cliente")
    .update(payload)
    .eq("telefono", telefono)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCliente(telefono: string) {
  const { error } = await getClient()
    .from("cliente")
    .delete()
    .eq("telefono", telefono);

  if (error) throw error;
}

/* ─── RESERVAS ───────────────────────────────────────────── */
// Campos reales: id_reserva, fecha_solicitud (timestamp), fecha_aprobacion (timestamp),
//                telefono_cliente, id_plan, cantidad_personas, aprobado (bool)

export async function getReservas() {
  const { data, error } = await getClient()
    .from("reserva")
    .select(`
      id_reserva,
      fecha_solicitud,
      fecha_aprobacion,
      telefono_cliente,
      id_plan,
      cantidad_personas,
      aprobado,
      plan (
        id_plan,
        nombre_plan,
        precio_plan
      )
    `)
    .order("id_reserva", { ascending: false });

  if (error) throw error;

  // Normalizar: exponer nombre_plan en el nivel raíz para compatibilidad
  return (data ?? []).map((reserva: any) => ({
    ...reserva,
    nombre_plan: reserva.plan?.nombre_plan ?? null,
  }));
}

export async function createReserva(payload: any) {
  const { data, error } = await getClient()
    .from("reserva")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateReserva(id: number, payload: any) {
  const { data, error } = await getClient()
    .from("reserva")
    .update(payload)
    .eq("id_reserva", id)
    .select();          // sin .single(): devuelve un array

  if (error) throw error;

  // Si RLS bloquea el UPDATE, Supabase NO lanza error pero actualiza 0 filas.
  // Detectamos ese caso explícitamente para no fallar en silencio.
  if (!data || data.length === 0) {
    throw new Error(
      "El UPDATE no afectó ninguna fila. Posible política RLS de UPDATE faltante en la tabla 'reserva', o el id no existe."
    );
  }

  return data[0];
}

export async function deleteReserva(id: number) {
  const { error } = await getClient()
    .from("reserva")
    .delete()
    .eq("id_reserva", id);

  if (error) throw error;
}

/* ─── PARTICIPANTES ──────────────────────────────────────── */
// Campos reales: id_participante, id_reserva (FK), nombre, edad, estatura, peso,
//                telefono_cliente, telefono_participante
// El plan se obtiene a través de la reserva asociada.

export async function getParticipantes() {
  const { data, error } = await getClient()
    .from("participante")
    .select(`
      id_participante,
      nombre,
      edad,
      estatura,
      peso,
      telefono_cliente,
      telefono_participante,
      id_reserva,
      reserva (
        id_reserva,
        id_plan,
        aprobado,
        plan (
          id_plan,
          nombre_plan
        )
      )
    `)
    .order("id_participante", { ascending: false });

  if (error) throw error;

  // Normalizar: subir nombre_plan y id_plan al nivel raíz
  return (data ?? []).map((p: any) => ({
    ...p,
    id_plan:     p.reserva?.id_plan ?? null,
    nombre_plan: p.reserva?.plan?.nombre_plan ?? null,
  }));
}

// Participantes de una reserva específica.
export async function getParticipantesPorReserva(id_reserva: number) {
  const { data, error } = await getClient()
    .from("participante")
    .select(`
      id_participante,
      nombre,
      edad,
      estatura,
      peso,
      telefono_cliente,
      telefono_participante,
      id_reserva
    `)
    .eq("id_reserva", id_reserva)
    .order("id_participante", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createParticipante(payload: any) {
  const { data, error } = await getClient()
    .from("participante")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateParticipante(id: number, payload: any) {
  const { data, error } = await getClient()
    .from("participante")
    .update(payload)
    .eq("id_participante", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteParticipante(id: number) {
  const { error } = await getClient()
    .from("participante")
    .delete()
    .eq("id_participante", id);

  if (error) throw error;
}