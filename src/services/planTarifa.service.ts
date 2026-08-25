import { supabase } from "../lib/supabase";

export type TipoDiaTarifa = "todos" | "semana" | "fin_semana" | "festivo";

export interface PlanTarifa {
  id_tarifa?: number;
  id_plan: number;
  personas_min: number;
  personas_max: number | null;
  precio_persona: number;
  tipo_dia: TipoDiaTarifa;
  activo?: boolean;
}

function db() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function getPlanTarifas(): Promise<PlanTarifa[]> {
  try {
    const { data, error } = await db()
      .from("plan_tarifa")
      .select("id_tarifa,id_plan,personas_min,personas_max,precio_persona,tipo_dia,activo")
      .eq("activo", true)
      .order("id_plan", { ascending: true })
      .order("tipo_dia", { ascending: true })
      .order("personas_min", { ascending: true });

    if (error) {
      console.warn("No se pudieron cargar las tarifas de planes. Los planes seguirán visibles:", error);
      return [];
    }

    return (data ?? []) as PlanTarifa[];
  } catch (error) {
    console.warn("Fallo inesperado cargando tarifas. Los planes seguirán visibles:", error);
    return [];
  }
}

export async function replacePlanTarifas(idPlan: number, tarifas: Omit<PlanTarifa, "id_plan" | "id_tarifa">[]) {
  const client = db();
  const { error: deleteError } = await client.from("plan_tarifa").delete().eq("id_plan", idPlan);
  if (deleteError) throw deleteError;

  if (!tarifas.length) return;
  const rows = tarifas.map((t) => ({
    id_plan: idPlan,
    personas_min: t.personas_min,
    personas_max: t.personas_max,
    precio_persona: Number(t.precio_persona),
    tipo_dia: t.tipo_dia,
    activo: true,
  }));
  const { error } = await client.from("plan_tarifa").insert(rows);
  if (error) throw error;
}

export async function calcularPrecioPlan(idPlan: number, cantidad: number, fecha: string) {
  const { data, error } = await db().rpc("obtener_precio_plan", {
    p_id_plan: idPlan,
    p_cantidad_personas: cantidad,
    p_fecha: fecha,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function calcularTotalPlan(idPlan: number, cantidad: number, fecha: string) {
  const { data, error } = await db().rpc("calcular_total_plan", {
    p_id_plan: idPlan,
    p_cantidad_personas: cantidad,
    p_fecha: fecha,
  });
  if (error) throw error;
  return Number(data ?? 0);
}
