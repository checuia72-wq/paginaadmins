import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type ManagedUserRole = "administrador" | "atencion" | "coordinador" | "guia";

export type ManagedUser = {
  user_id: string;
  username: string;
  email: string;
  telefono: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
};

async function invokeAdminUsers(body: Record<string, unknown>) {
  const { data, error } = await client().functions.invoke("clever-handler", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const data = await invokeAdminUsers({ action: "list" });
  return (data?.users ?? []).map((row: any) => ({
    user_id: String(row.user_id ?? ""),
    username: String(row.username ?? ""),
    email: String(row.email ?? ""),
    telefono: String(row.telefono ?? ""),
    role: String(row.role ?? ""),
    created_at: String(row.created_at ?? ""),
    last_sign_in_at: row.last_sign_in_at ? String(row.last_sign_in_at) : null,
  }));
}

export async function createManagedUser(username: string, email: string, password: string, role: ManagedUserRole, telefono: string) {
  return invokeAdminUsers({
    action: "create",
    username: username.trim().toLowerCase(),
    email: email.trim().toLowerCase(),
    password,
    role,
    telefono,
  });
}

export async function updateManagedUserProfile(userId: string, username: string, email: string, telefono: string) {
  return invokeAdminUsers({
    action: "update_profile",
    user_id: userId,
    username: username.trim().toLowerCase(),
    email: email.trim().toLowerCase(),
    telefono: telefono.trim(),
  });
}

export async function resetManagedUserPassword(userId: string, password: string) {
  return invokeAdminUsers({
    action: "reset_password",
    user_id: userId,
    password,
  });
}

export async function listAvailableGuides(): Promise<ManagedUser[]> {
  const {data,error} = await client().rpc("listar_guias_reserva");
  if(error) throw error;
  return (data ?? []).map((g: any) => ({
    user_id: String(g.user_id),
    username: String(g.username ?? ""),
    telefono: String(g.telefono ?? ""),
    email: "",
    role: "guia",
    created_at: "",
    last_sign_in_at: null,
  }));
}
