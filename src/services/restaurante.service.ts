import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function getRestaurantes(): Promise<string[]> {
  const { data, error } = await client().rpc("admin_list_restaurantes");
  if (error) throw error;
  return (data ?? []).map((row: any) => String(row.valor ?? row));
}

export async function getRestaurantesActivos(): Promise<string[]> {
  const { data, error } = await client().rpc("list_restaurantes_activos");
  if (error) throw error;
  return (data ?? []).map((row: any) => String(row.valor ?? row));
}

export async function createRestaurante(valor: string) {
  const { error } = await client().rpc("admin_add_restaurante", { p_valor: valor.trim() });
  if (error) throw error;
}

export async function renameRestaurante(actual: string, nuevo: string) {
  const { error } = await client().rpc("admin_rename_restaurante", {
    p_actual: actual,
    p_nuevo: nuevo.trim(),
  });
  if (error) throw error;
}

export async function deleteRestaurante(valor: string) {
  const { error } = await client().rpc("admin_delete_restaurante", { p_valor: valor });
  if (error) throw error;
}
