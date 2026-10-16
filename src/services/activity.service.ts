import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type ActivityEntry = {
  id_actividad: number;
  fecha: string;
  actor_user_id: string | null;
  actor_username: string | null;
  actor_email: string | null;
  actor_role: string | null;
  actor_source: string;
  accion: string;
  operacion: "INSERT" | "UPDATE" | "DELETE" | string;
  tabla: string;
  registro_id: string | null;
  referencia: string | null;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  cambios: Record<string, unknown> | null;
};

export type ActivityFilters = {
  userId?: string;
  action?: string;
  table?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ActivityFilterUser = {
  user_id: string;
  username: string;
  email: string;
  role: string;
};

export type ActivityFilterOptions = {
  users: ActivityFilterUser[];
  actions: string[];
  tables: string[];
};

const colombiaStart = (date: string) => `${date}T00:00:00-05:00`;
const colombiaEnd = (date: string) => `${date}T23:59:59.999-05:00`;

export async function getActivityEntries(filters: ActivityFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 50));
  const fromRow = (page - 1) * pageSize;
  const toRow = fromRow + pageSize - 1;

  let query = client()
    .from("actividad_sistema")
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false })
    .range(fromRow, toRow);

  if (filters.userId) query = query.eq("actor_user_id", filters.userId);
  if (filters.action) query = query.eq("accion", filters.action);
  if (filters.table) query = query.eq("tabla", filters.table);
  if (filters.from) query = query.gte("fecha", colombiaStart(filters.from));
  if (filters.to) query = query.lte("fecha", colombiaEnd(filters.to));

  const search = (filters.search ?? "").trim().replace(/[,%()]/g, " ");
  if (search) {
    query = query.or(
      [
        `actor_username.ilike.%${search}%`,
        `actor_email.ilike.%${search}%`,
        `accion.ilike.%${search}%`,
        `tabla.ilike.%${search}%`,
        `referencia.ilike.%${search}%`,
        `registro_id.ilike.%${search}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []) as ActivityEntry[],
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function getActivityFilterOptions(): Promise<ActivityFilterOptions> {
  const { data, error } = await client()
    .from("actividad_sistema")
    .select("actor_user_id,actor_username,actor_email,actor_role,accion,tabla")
    .order("fecha", { ascending: false })
    .limit(5000);

  if (error) throw error;

  const usersMap = new Map<string, ActivityFilterUser>();
  const actions = new Set<string>();
  const tables = new Set<string>();

  for (const row of data ?? []) {
    const userId = String((row as any).actor_user_id ?? "");
    if (userId && !usersMap.has(userId)) {
      usersMap.set(userId, {
        user_id: userId,
        username: String((row as any).actor_username ?? ""),
        email: String((row as any).actor_email ?? ""),
        role: String((row as any).actor_role ?? ""),
      });
    }

    const action = String((row as any).accion ?? "");
    const table = String((row as any).tabla ?? "");
    if (action) actions.add(action);
    if (table) tables.add(table);
  }

  return {
    users: [...usersMap.values()].sort((a, b) =>
      (a.username || a.email).localeCompare(b.username || b.email, "es"),
    ),
    actions: [...actions].sort((a, b) => a.localeCompare(b, "es")),
    tables: [...tables].sort((a, b) => a.localeCompare(b, "es")),
  };
}
