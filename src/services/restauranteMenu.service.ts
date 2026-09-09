import { supabase } from "../lib/supabase";

export type RestauranteMenuItem = {
  id_menu: number;
  restaurante: string;
  nombre_plato: string;
  descripcion?: string | null;
  activo: boolean;
  orden: number;
};

export type RestauranteMenuInput = {
  restaurante: string;
  nombre_plato: string;
  descripcion?: string | null;
  activo?: boolean;
  orden?: number;
};

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

function mapRow(row: any): RestauranteMenuItem {
  return {
    id_menu: Number(row.id_menu),
    restaurante: String(row.restaurante ?? ""),
    nombre_plato: String(row.nombre_plato ?? ""),
    descripcion: row.descripcion == null ? null : String(row.descripcion),
    activo: Boolean(row.activo),
    orden: Number(row.orden ?? 0),
  };
}

export async function getMenusRestaurante(): Promise<RestauranteMenuItem[]> {
  const { data, error } = await client()
    .from("restaurante_menu")
    .select("id_menu, restaurante, nombre_plato, descripcion, activo, orden")
    .order("restaurante", { ascending: true })
    .order("orden", { ascending: true })
    .order("nombre_plato", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getMenusActivosPorRestaurante(restaurante: string): Promise<RestauranteMenuItem[]> {
  const nombre = String(restaurante || "").trim();
  if (!nombre) return [];

  const { data, error } = await client()
    .from("restaurante_menu")
    .select("id_menu, restaurante, nombre_plato, descripcion, activo, orden")
    .eq("activo", true)
    .ilike("restaurante", nombre)
    .order("orden", { ascending: true })
    .order("nombre_plato", { ascending: true });

  if (error) {
    console.warn("No fue posible cargar restaurante_menu:", error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

export async function createMenuRestaurante(input: RestauranteMenuInput) {
  const payload = {
    restaurante: input.restaurante.trim(),
    nombre_plato: input.nombre_plato.trim(),
    descripcion: input.descripcion?.trim() || null,
    activo: input.activo ?? true,
    orden: Number(input.orden ?? 0),
    updated_at: new Date().toISOString(),
  };

  const { error } = await client().from("restaurante_menu").insert(payload);
  if (error) throw error;
}

export async function updateMenuRestaurante(id_menu: number, input: RestauranteMenuInput) {
  const payload = {
    restaurante: input.restaurante.trim(),
    nombre_plato: input.nombre_plato.trim(),
    descripcion: input.descripcion?.trim() || null,
    activo: input.activo ?? true,
    orden: Number(input.orden ?? 0),
    updated_at: new Date().toISOString(),
  };

  const { error } = await client()
    .from("restaurante_menu")
    .update(payload)
    .eq("id_menu", id_menu);

  if (error) throw error;
}

export async function deleteMenuRestaurante(id_menu: number) {
  const { error } = await client()
    .from("restaurante_menu")
    .delete()
    .eq("id_menu", id_menu);

  if (error) throw error;
}

export async function toggleMenuRestaurante(id_menu: number, activo: boolean) {
  const { error } = await client()
    .from("restaurante_menu")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id_menu", id_menu);

  if (error) throw error;
}
