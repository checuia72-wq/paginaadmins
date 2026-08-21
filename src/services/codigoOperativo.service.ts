import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type CodigoOperativo = {
  id_codigo_operativo: number;
  codigo_ch: string;
  descripcion: string;
  id_plan: number | null;
  incluye_almuerzo: boolean;
  restaurante: string | null;
  prioridad: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  plan?: {
    id_plan: number;
    nombre_plan: string;
    precio_plan?: number | null;
    tipo_fecha?: string | null;
    tipo_hora?: string | null;
    plan_fechas?: Array<{ id_fecha: number; fecha: string }>;
    plan_horas?: Array<{ id_hora: number; hora: string }>;
  } | null;
};

export type CodigoOperativoPayload = {
  codigo_ch: string;
  descripcion: string;
  id_plan: number | null;
  incluye_almuerzo: boolean;
  restaurante: string | null;
  prioridad?: number;
  activo?: boolean;
};

export async function getCodigosOperativos(): Promise<CodigoOperativo[]> {
  const { data, error } = await client()
    .from("codigo_operativo")
    .select("id_codigo_operativo,codigo_ch,descripcion,id_plan,incluye_almuerzo,restaurante,prioridad,activo,created_at,updated_at,plan(id_plan,nombre_plan,precio_plan,tipo_fecha,tipo_hora,plan_fechas(id_fecha,fecha),plan_horas(id_hora,hora))")
    .order("codigo_ch", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    id_codigo_operativo: Number(r.id_codigo_operativo),
    id_plan: r.id_plan == null ? null : Number(r.id_plan),
    prioridad: Number(r.prioridad || 0),
    plan: r.plan ? {
      ...r.plan,
      id_plan: Number(r.plan.id_plan),
      precio_plan: r.plan.precio_plan == null ? null : Number(r.plan.precio_plan),
      plan_fechas: (r.plan.plan_fechas ?? []).map((f: any) => ({ id_fecha: Number(f.id_fecha), fecha: String(f.fecha ?? "").slice(0,10) })),
      plan_horas: (r.plan.plan_horas ?? []).map((h: any) => ({ id_hora: Number(h.id_hora), hora: String(h.hora ?? "") })),
    } : null,
  })) as CodigoOperativo[];
}

export async function createCodigoOperativo(payload: CodigoOperativoPayload) {
  const clean = {
    ...payload,
    codigo_ch: payload.codigo_ch.trim().toUpperCase(),
    descripcion: payload.descripcion.trim(),
    restaurante: payload.incluye_almuerzo && payload.restaurante?.trim() ? payload.restaurante.trim() : null,
    prioridad: Number(payload.prioridad || 0),
    activo: payload.activo !== false,
  };
  const { data, error } = await client().from("codigo_operativo").insert(clean).select().single();
  if (error) throw error;
  return data;
}

export async function updateCodigoOperativo(id: number, payload: Partial<CodigoOperativoPayload>) {
  const clean: Record<string, unknown> = { ...payload };
  if (typeof payload.codigo_ch === "string") clean.codigo_ch = payload.codigo_ch.trim().toUpperCase();
  if (typeof payload.descripcion === "string") clean.descripcion = payload.descripcion.trim();
  if (payload.incluye_almuerzo === false) clean.restaurante = null;
  if (typeof payload.restaurante === "string") clean.restaurante = payload.restaurante.trim() || null;
  if (payload.prioridad != null) clean.prioridad = Number(payload.prioridad || 0);
  const { data, error } = await client().from("codigo_operativo").update(clean).eq("id_codigo_operativo", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCodigoOperativo(id: number) {
  const { error } = await client().from("codigo_operativo").delete().eq("id_codigo_operativo", id);
  if (error) throw error;
}

export function codigosCompatibles(codigos: CodigoOperativo[], idPlan: number | null, incluyeAlmuerzo: boolean, restaurante?: string | null) {
  const rest = String(restaurante ?? "").trim().toLowerCase();
  return codigos
    .filter((c) => c.activo && c.id_plan === idPlan && c.incluye_almuerzo === incluyeAlmuerzo)
    .filter((c) => !incluyeAlmuerzo || !c.restaurante || c.restaurante.trim().toLowerCase() === rest)
    .sort((a, b) => {
      const exactA = cRestaurant(a) === rest && !!a.restaurante ? 1 : 0;
      const exactB = cRestaurant(b) === rest && !!b.restaurante ? 1 : 0;
      return exactB - exactA || b.prioridad - a.prioridad || a.codigo_ch.localeCompare(b.codigo_ch);
    });
}

function cRestaurant(c: CodigoOperativo) { return String(c.restaurante ?? "").trim().toLowerCase(); }

export async function aprobarReservaOperativa(args: {
  id_reserva: number;
  valor_abonado: number;
  metodo_pago: string;
  incluye_almuerzo: boolean;
  restaurante?: string | null;
  id_codigo_operativo?: number | null;
}) {
  const { data, error } = await client().rpc("aprobar_reserva_operativa", {
    p_id_reserva: args.id_reserva,
    p_valor_abonado: args.valor_abonado,
    p_metodo_pago: args.metodo_pago,
    p_incluye_almuerzo: args.incluye_almuerzo,
    p_restaurante: args.incluye_almuerzo ? args.restaurante || null : null,
    p_id_codigo_operativo: args.id_codigo_operativo || null,
  });
  if (error) throw error;
  return String(data ?? "");
}

export async function cambiarCodigoOperativoReserva(args: {
  id_reserva: number;
  id_plan: number;
  incluye_almuerzo: boolean;
  restaurante?: string | null;
  id_codigo_operativo?: number | null;
}) {
  const { data, error } = await client().rpc("cambiar_codigo_operativo_reserva", {
    p_id_reserva: args.id_reserva,
    p_id_plan: args.id_plan,
    p_incluye_almuerzo: args.incluye_almuerzo,
    p_restaurante: args.incluye_almuerzo ? args.restaurante || null : null,
    p_id_codigo_operativo: args.id_codigo_operativo || null,
  });
  if (error) throw error;
  return String(data ?? "");
}
