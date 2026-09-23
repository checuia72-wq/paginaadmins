import { supabase } from "../lib/supabase";
import type { SnackLocationCode } from "./snack.service";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type GuideSalesPermissions = {
  taquilla_1: boolean;
  enclave: boolean;
};

export type GuideSalesAccessRow = {
  user_id: string;
  email: string;
  taquilla_1: boolean;
  enclave: boolean;
};

export async function getMyGuideSalesPermissions(): Promise<GuideSalesPermissions> {
  const { data, error } = await client().rpc("mis_permisos_venta_snack");
  if (error) throw error;

  const raw: any = data ?? {};
  return {
    taquilla_1: raw.taquilla_1 === true,
    enclave: raw.enclave === true,
  };
}

export async function listGuideSalesAccess(): Promise<GuideSalesAccessRow[]> {
  const { data, error } = await client().rpc("listar_guias_ventas");
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    user_id: String(row.user_id ?? ""),
    email: String(row.email ?? ""),
    taquilla_1: row.taquilla_1 === true,
    enclave: row.enclave === true,
  }));
}

export async function setGuideSalesAccess(
  userId: string,
  ubicacion: SnackLocationCode,
  enabled: boolean,
) {
  const { data, error } = await client().rpc("actualizar_permiso_venta_guia", {
    p_user_id: userId,
    p_ubicacion: ubicacion,
    p_habilitado: enabled,
  });
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("guide-sales-access-changed"));
  return data;
}
