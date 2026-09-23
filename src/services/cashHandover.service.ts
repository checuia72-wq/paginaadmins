import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export type CashCoordinator = {
  user_id: string;
  email: string;
};

export type CashBalance = {
  efectivo_pendiente: number;
  efectivo_hoy: number;
  ventas_hoy: number;
  ventas_efectivo_total: number;
  entregas_registradas: number;
};

export type CashHandover = {
  id_entrega: number;
  guia_user_id: string;
  guia_email: string;
  coordinador_user_id: string;
  coordinador_email: string;
  monto: number;
  cantidad_ventas: number;
  estado: "pendiente" | "confirmada";
  observacion: string;
  created_at: string;
  confirmado_at: string | null;
  confirmado_por: string | null;
};

export async function getMyCashBalance(): Promise<CashBalance> {
  const { data, error } = await client().rpc("mi_saldo_efectivo_snacks");
  if (error) throw error;
  const raw: any = data ?? {};
  return {
    efectivo_pendiente: num(raw.efectivo_pendiente),
    efectivo_hoy: num(raw.efectivo_hoy),
    ventas_hoy: num(raw.ventas_hoy),
    ventas_efectivo_total: num(raw.ventas_efectivo_total),
    entregas_registradas: num(raw.entregas_registradas),
  };
}

export async function listCashCoordinators(): Promise<CashCoordinator[]> {
  const { data, error } = await client().rpc("listar_coordinadores_efectivo");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    user_id: String(row.user_id ?? ""),
    email: String(row.email ?? ""),
  }));
}

export async function createCashHandover(coordinatorUserId: string, observation = "") {
  const { data, error } = await client().rpc("registrar_entrega_efectivo_snacks", {
    p_coordinador_user_id: coordinatorUserId,
    p_observacion: observation.trim() || null,
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent("snack-cash-handover-changed"));
  return data;
}

export async function confirmCashHandover(idEntrega: number) {
  const { data, error } = await client().rpc("confirmar_entrega_efectivo_snacks", {
    p_id_entrega: Number(idEntrega),
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent("snack-cash-handover-changed"));
  return data;
}

export async function listCashHandovers(): Promise<CashHandover[]> {
  const { data, error } = await client().rpc("listar_entregas_efectivo_snacks");
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id_entrega: Number(row.id_entrega),
    guia_user_id: String(row.guia_user_id ?? ""),
    guia_email: String(row.guia_email ?? ""),
    coordinador_user_id: String(row.coordinador_user_id ?? ""),
    coordinador_email: String(row.coordinador_email ?? ""),
    monto: num(row.monto),
    cantidad_ventas: num(row.cantidad_ventas),
    estado: String(row.estado || "pendiente") as "pendiente" | "confirmada",
    observacion: String(row.observacion ?? ""),
    created_at: String(row.created_at ?? ""),
    confirmado_at: row.confirmado_at ? String(row.confirmado_at) : null,
    confirmado_por: row.confirmado_por ? String(row.confirmado_por) : null,
  }));
}
