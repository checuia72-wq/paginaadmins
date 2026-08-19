import { supabase } from "../lib/supabase";

export type AppRole = "administrador" | "atencion";

export type CurrentRole = {
  role: AppRole;
  email: string;
  userId: string;
};

export async function getCurrentRole(): Promise<CurrentRole | null> {
  if (!supabase) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const user = userData.user;
  const email = user.email?.trim() || "";

  const { data, error } = await supabase
    .from("usuario_roles")
    .select(`
      user_id,
      role:roles (
        nombre
      )
    `)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  const roleName = (data as any)?.role?.nombre as AppRole | undefined;
  if (roleName !== "administrador" && roleName !== "atencion") return null;

  return {
    role: roleName,
    email,
    userId: user.id,
  };
}

export function canAccess(role: AppRole, path: string) {
  if (role === "administrador") return true;
  return path === "/app/reservas" || path === "/app/control-operativo";
}
