import { supabase } from "../lib/supabase";

export type AppRole = "administrador" | "atencion" | "coordinador" | "guia";

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
  if (!["administrador", "atencion", "coordinador", "guia"].includes(String(roleName))) return null;

  return {
    role: roleName as AppRole,
    email,
    userId: user.id,
  };
}

export function canAccess(role: AppRole, path: string) {
  if (role === "administrador") return true;
  if (role === "atencion") {
    return ["/app/reservas", "/app/control-operativo", "/app/ventas-snacks", "/app/ventas-snacks-enclave"].includes(path);
  }
  if (role === "coordinador") {
    return ["/app/control-operativo", "/app/inventario-snacks", "/app/accesos-guias", "/app/entrega-efectivo"].includes(path);
  }
  return path === "/app/ventas-snacks" || path === "/app/ventas-snacks-enclave" || path === "/app/entrega-efectivo";
}

export function appRoleLabel(role: AppRole) {
  if (role === "administrador") return "Administrador";
  if (role === "atencion") return "Atención";
  if (role === "coordinador") return "Coordinador";
  return "Guía";
}
