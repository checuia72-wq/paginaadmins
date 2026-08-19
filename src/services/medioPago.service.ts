import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function getMetodosPago(): Promise<string[]> {
  const { data, error } = await client().rpc("admin_list_medio_pago");
  if (error) throw error;
  return (data ?? []).map((row: any) => String(row.valor ?? row));
}

export async function getMetodosPagoActivos(): Promise<string[]> {
  const { data, error } = await client().rpc("list_medio_pago_activos");
  if (error) throw error;
  return (data ?? []).map((row: any) => String(row.valor ?? row));
}

export async function createMetodoPago(valor: string) {
  const { error } = await client().rpc("admin_add_medio_pago", { p_valor: valor.trim().toLowerCase() });
  if (error) throw error;
}

export async function renameMetodoPago(actual: string, nuevo: string) {
  const { error } = await client().rpc("admin_rename_medio_pago", {
    p_actual: actual,
    p_nuevo: nuevo.trim().toLowerCase(),
  });
  if (error) throw error;
}

export async function deleteMetodoPago(valor: string) {
  const { error } = await client().rpc("admin_delete_medio_pago", { p_valor: valor });
  if (error) throw error;
}
