import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type ManagedUserRole = "guia" | "coordinador";

export type ManagedUser = {
  user_id: string;
  email: string;
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
    email: String(row.email ?? ""),
    role: String(row.role ?? ""),
    created_at: String(row.created_at ?? ""),
    last_sign_in_at: row.last_sign_in_at ? String(row.last_sign_in_at) : null,
  }));
}

export async function createManagedUser(email: string, password: string, role: ManagedUserRole) {
  return invokeAdminUsers({
    action: "create",
    email: email.trim().toLowerCase(),
    password,
    role,
  });
}

export async function resetManagedUserPassword(userId: string, password: string) {
  return invokeAdminUsers({
    action: "reset_password",
    user_id: userId,
    password,
  });
}
