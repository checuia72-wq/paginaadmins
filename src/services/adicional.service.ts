import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type TipoCobroAdicional = "por_persona" | "por_reserva";
export type ModalidadPlanAdicional = "opcional" | "incluido";
export type MovimientoReservaAdicional = "agregado" | "incluido" | "retirado";

export type Adicional = {
  id_adicional: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  tipo_cobro: TipoCobroAdicional;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PlanAdicional = {
  id_plan: number;
  id_adicional: number;
  modalidad: ModalidadPlanAdicional;
  precio_override: number | null;
  permitir_quitar: boolean;
  activo: boolean;
  adicional: Adicional;
};

export type ReservaAdicionalInput = {
  id_adicional: number;
  codigo_adicional: string;
  nombre_adicional: string;
  tipo_cobro: TipoCobroAdicional;
  tipo_movimiento: MovimientoReservaAdicional;
  precio_unitario: number;
  cantidad_aplicada: number;
  impacto_total: number;
};

export type ReservaAdicional = ReservaAdicionalInput & {
  id_reserva_adicional: number;
  id_reserva: number;
  created_at?: string;
};

const normalizeAdicional = (row: any): Adicional => ({
  ...row,
  id_adicional: Number(row.id_adicional),
  precio: Number(row.precio ?? 0),
  activo: row.activo !== false,
});

export async function getAdicionales(soloActivos = false): Promise<Adicional[]> {
  let query = client()
    .from("adicional")
    .select("id_adicional,codigo,nombre,descripcion,precio,tipo_cobro,activo,created_at,updated_at")
    .order("nombre", { ascending: true });

  if (soloActivos) query = query.eq("activo", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeAdicional);
}

export async function createAdicional(payload: Omit<Adicional, "id_adicional" | "created_at" | "updated_at">) {
  const clean = {
    ...payload,
    codigo: payload.codigo.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, ""),
    nombre: payload.nombre.trim(),
    descripcion: payload.descripcion?.trim() || null,
    precio: Number(payload.precio || 0),
    activo: payload.activo !== false,
  };
  const { data, error } = await client().from("adicional").insert(clean).select().single();
  if (error) throw error;
  return normalizeAdicional(data);
}

export async function updateAdicional(id: number, payload: Partial<Omit<Adicional, "id_adicional" | "created_at" | "updated_at">>) {
  const clean: Record<string, unknown> = { ...payload };
  if (typeof payload.codigo === "string") clean.codigo = payload.codigo.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (typeof payload.nombre === "string") clean.nombre = payload.nombre.trim();
  if (typeof payload.descripcion === "string") clean.descripcion = payload.descripcion.trim() || null;
  if (payload.precio != null) clean.precio = Number(payload.precio);
  clean.updated_at = new Date().toISOString();

  const { data, error } = await client().from("adicional").update(clean).eq("id_adicional", id).select().single();
  if (error) throw error;
  return normalizeAdicional(data);
}

export async function deleteAdicional(id: number) {
  const { error } = await client().from("adicional").delete().eq("id_adicional", id);
  if (error) throw error;
}

export async function getPlanAdicionales(idPlan?: number): Promise<PlanAdicional[]> {
  const db = client();
  let query = db
    .from("plan_adicional")
    .select("id_plan,id_adicional,modalidad,precio_override,permitir_quitar,activo")
    .eq("activo", true);

  if (idPlan != null) query = query.eq("id_plan", Number(idPlan));

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows?.length) return [];

  const ids = [...new Set(rows.map((r: any) => Number(r.id_adicional)))];
  const { data: adicionales, error: adicionalesError } = await db
    .from("adicional")
    .select("id_adicional,codigo,nombre,descripcion,precio,tipo_cobro,activo,created_at,updated_at")
    .in("id_adicional", ids);

  if (adicionalesError) throw adicionalesError;
  const map = new Map((adicionales ?? []).map((a: any) => {
    const normalized = normalizeAdicional(a);
    return [normalized.id_adicional, normalized] as const;
  }));

  return rows
    .map((r: any) => ({
      id_plan: Number(r.id_plan),
      id_adicional: Number(r.id_adicional),
      modalidad: r.modalidad as ModalidadPlanAdicional,
      precio_override: r.precio_override == null ? null : Number(r.precio_override),
      permitir_quitar: !!r.permitir_quitar,
      activo: r.activo !== false,
      adicional: map.get(Number(r.id_adicional)),
    }))
    .filter((r: any) => !!r.adicional) as PlanAdicional[];
}

export async function replacePlanAdicionales(
  idPlan: number,
  items: Array<{
    id_adicional: number;
    modalidad: ModalidadPlanAdicional;
    precio_override?: number | null;
    permitir_quitar?: boolean;
    activo?: boolean;
  }>,
) {
  const db = client();
  const { error: deleteError } = await db.from("plan_adicional").delete().eq("id_plan", Number(idPlan));
  if (deleteError) throw deleteError;
  if (!items.length) return [];

  const payload = items.map((item) => ({
    id_plan: Number(idPlan),
    id_adicional: Number(item.id_adicional),
    modalidad: item.modalidad,
    precio_override: item.precio_override == null ? null : Number(item.precio_override),
    permitir_quitar: item.modalidad === "incluido" ? !!item.permitir_quitar : false,
    activo: item.activo !== false,
  }));

  const { data, error } = await db.from("plan_adicional").insert(payload).select();
  if (error) throw error;
  return data ?? [];
}

export async function getReservaAdicionales(idReserva: number): Promise<ReservaAdicional[]> {
  const { data, error } = await client()
    .from("reserva_adicional")
    .select("id_reserva_adicional,id_reserva,id_adicional,codigo_adicional,nombre_adicional,tipo_cobro,tipo_movimiento,precio_unitario,cantidad_aplicada,impacto_total,created_at")
    .eq("id_reserva", Number(idReserva))
    .order("id_reserva_adicional", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    id_reserva_adicional: Number(row.id_reserva_adicional),
    id_reserva: Number(row.id_reserva),
    id_adicional: Number(row.id_adicional),
    precio_unitario: Number(row.precio_unitario ?? 0),
    cantidad_aplicada: Number(row.cantidad_aplicada ?? 0),
    impacto_total: Number(row.impacto_total ?? 0),
  })) as ReservaAdicional[];
}

export async function replaceReservaAdicionales(idReserva: number, items: ReservaAdicionalInput[]) {
  const db = client();
  const { error: deleteError } = await db.from("reserva_adicional").delete().eq("id_reserva", Number(idReserva));
  if (deleteError) throw deleteError;
  if (!items.length) return [];

  const payload = items.map((item) => ({
    id_reserva: Number(idReserva),
    id_adicional: Number(item.id_adicional),
    codigo_adicional: item.codigo_adicional,
    nombre_adicional: item.nombre_adicional,
    tipo_cobro: item.tipo_cobro,
    tipo_movimiento: item.tipo_movimiento,
    precio_unitario: Number(item.precio_unitario),
    cantidad_aplicada: Math.max(1, Number(item.cantidad_aplicada || 1)),
    impacto_total: Number(item.impacto_total || 0),
  }));

  const { data, error } = await db.from("reserva_adicional").insert(payload).select();
  if (error) throw error;
  return data ?? [];
}

export function precioEfectivoPlanAdicional(item: PlanAdicional) {
  return Number(item.precio_override ?? item.adicional.precio ?? 0);
}

export function maxCantidadPlanAdicional(item: PlanAdicional, personas: number) {
  return item.adicional.tipo_cobro === "por_persona" ? Math.max(1, personas) : 1;
}

export function normalizarCantidadPlanAdicional(item: PlanAdicional, cantidadSeleccionada: number, personas: number) {
  const max = maxCantidadPlanAdicional(item, personas);
  if (item.modalidad === "incluido" && !item.permitir_quitar) return max;
  return Math.min(max, Math.max(0, Number(cantidadSeleccionada || 0)));
}

export function impactoPlanAdicionalCantidad(item: PlanAdicional, cantidadSeleccionada: number, personas: number) {
  const precio = precioEfectivoPlanAdicional(item);
  const max = maxCantidadPlanAdicional(item, personas);
  const seleccionada = normalizarCantidadPlanAdicional(item, cantidadSeleccionada, personas);

  if (item.modalidad === "opcional") return precio * seleccionada;
  if (item.modalidad === "incluido" && item.permitir_quitar) return -(precio * (max - seleccionada));
  return 0;
}

export function impactoPlanAdicional(item: PlanAdicional, seleccionado: boolean, personas: number) {
  return impactoPlanAdicionalCantidad(
    item,
    seleccionado ? maxCantidadPlanAdicional(item, personas) : 0,
    personas,
  );
}
