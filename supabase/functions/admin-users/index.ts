import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getServerKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // fallback below
    }
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  throw new Error("No existe una clave secreta de Supabase para administrar usuarios.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serverKey = getServerKey();
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !authHeader.startsWith("Bearer ")) {
      return json({ error: "No autorizado." }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const admin = createClient(supabaseUrl, serverKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: requesterData, error: requesterError } = await admin.auth.getUser(token);
    const requester = requesterData?.user;

    if (requesterError || !requester) {
      return json({ error: "Sesión inválida." }, 401);
    }

    const { data: roleRow, error: roleError } = await admin
      .from("usuario_roles")
      .select("role_id")
      .eq("user_id", requester.id)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!roleRow?.role_id) return json({ error: "El usuario no tiene rol asignado." }, 403);

    const { data: roleData, error: roleNameError } = await admin
      .from("roles")
      .select("nombre")
      .eq("id_rol", roleRow.role_id)
      .maybeSingle();

    if (roleNameError) throw roleNameError;
    if (roleData?.nombre !== "administrador") {
      return json({ error: "Solo Administración puede gestionar usuarios." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "list") {
      const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (usersError) throw usersError;

      const { data: assignments, error: assignmentsError } = await admin
        .from("usuario_roles")
        .select("user_id,role_id");
      if (assignmentsError) throw assignmentsError;

      const { data: roles, error: rolesError } = await admin
        .from("roles")
        .select("id_rol,nombre");
      if (rolesError) throw rolesError;

      const roleMap = new Map<number, string>(
        (roles ?? []).map((row: any) => [Number(row.id_rol), String(row.nombre ?? "")]),
      );

      const assignmentMap = new Map<string, string>();
      for (const row of assignments ?? []) {
        assignmentMap.set(String((row as any).user_id), roleMap.get(Number((row as any).role_id)) ?? "");
      }

      const users = (usersData?.users ?? [])
        .map((user) => ({
          user_id: user.id,
          email: user.email ?? "",
          role: assignmentMap.get(user.id) ?? "",
          created_at: user.created_at ?? "",
          last_sign_in_at: user.last_sign_in_at ?? null,
        }))
        .filter((user) => user.role === "guia" || user.role === "coordinador")
        .sort((a, b) => a.email.localeCompare(b.email, "es"));

      return json({ users });
    }

    if (action === "create") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "");
      const role = String(body?.role ?? "");

      if (!email || !email.includes("@")) {
        return json({ error: "Ingresa un correo electrónico válido." }, 400);
      }

      if (password.length < 8) {
        return json({ error: "La contraseña debe tener mínimo 8 caracteres." }, 400);
      }

      if (!["guia", "coordinador"].includes(role)) {
        return json({ error: "Solo se pueden crear usuarios con rol Guía o Coordinador." }, 400);
      }

      const { data: targetRole, error: targetRoleError } = await admin
        .from("roles")
        .select("id_rol")
        .eq("nombre", role)
        .maybeSingle();

      if (targetRoleError) throw targetRoleError;
      if (!targetRole?.id_rol) {
        return json({ error: `El rol ${role} todavía no existe en la base de datos.` }, 400);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return json({ error: createError.message }, 400);
      }

      const user = created.user;
      if (!user) {
        return json({ error: "Supabase no devolvió el usuario creado." }, 500);
      }

      const { error: assignmentError } = await admin
        .from("usuario_roles")
        .upsert(
          {
            user_id: user.id,
            role_id: targetRole.id_rol,
          },
          {
            onConflict: "user_id",
          },
        );

      if (assignmentError) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
        throw assignmentError;
      }

      return json({
        user: {
          user_id: user.id,
          email: user.email ?? email,
          role,
          created_at: user.created_at ?? "",
        },
      }, 201);
    }

    if (action === "reset_password") {
      const userId = String(body?.user_id ?? "").trim();
      const password = String(body?.password ?? "");

      if (!userId) {
        return json({ error: "Usuario inválido." }, 400);
      }

      if (password.length < 8) {
        return json({ error: "La nueva contraseña debe tener mínimo 8 caracteres." }, 400);
      }

      const { data: assignment, error: assignmentError } = await admin
        .from("usuario_roles")
        .select("role_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (assignmentError) throw assignmentError;
      if (!assignment?.role_id) return json({ error: "El usuario no tiene rol asignado." }, 400);

      const { data: assignedRole, error: assignedRoleError } = await admin
        .from("roles")
        .select("nombre")
        .eq("id_rol", assignment.role_id)
        .maybeSingle();

      if (assignedRoleError) throw assignedRoleError;
      if (!["guia", "coordinador"].includes(String(assignedRole?.nombre ?? ""))) {
        return json({ error: "Esta pantalla solo administra contraseñas de guías y coordinadores." }, 400);
      }

      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        password,
      });

      if (updateError) {
        return json({ error: updateError.message }, 400);
      }

      return json({ success: true });
    }

    return json({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    console.error("[admin-users]", error);
    return json({
      error: error instanceof Error ? error.message : "Error interno administrando usuarios.",
    }, 500);
  }
});
