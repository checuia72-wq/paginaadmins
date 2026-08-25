import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type CodigoOperativo = {
  id_codigo_operativo: number;
  codigo_ch: string;
  descripcion: string;
  id_plan: number | null;
  incluye_almuerzo: boolean;
  restaurante: string | null;
  prioridad: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  plan?: {
    id_plan: number;
    nombre_plan: string;
    precio_plan?: number | null;
    tipo_fecha?: string | null;
    tipo_hora?: string | null;
    plan_fechas?: Array<{ id_fecha: number; fecha: string }>;
    plan_horas?: Array<{ id_hora: number; hora: string }>;
  } | null;
};

export type CodigoOperativoPayload = {
  codigo_ch: string;
  descripcion: string;
  id_plan: number | null;
  incluye_almuerzo: boolean;
  restaurante: string | null;
  prioridad?: number;
  activo?: boolean;
};

type PlanLigero = NonNullable<CodigoOperativo["plan"]>;

function normalizeCodigo(r: any): CodigoOperativo {
  return {
    ...r,
    id_codigo_operativo: Number(r.id_codigo_operativo),
    id_plan: r.id_plan == null ? null : Number(r.id_plan),
    prioridad: Number(r.prioridad || 0),
    plan: r.plan ? {
      ...r.plan,
      id_plan: Number(r.plan.id_plan),
      precio_plan: r.plan.precio_plan == null ? null : Number(r.plan.precio_plan),
      plan_fechas: (r.plan.plan_fechas ?? []).map((f: any) => ({
        id_fecha: Number(f.id_fecha),
        fecha: String(f.fecha ?? "").slice(0, 10),
      })),
      plan_horas: (r.plan.plan_horas ?? []).map((h: any) => ({
        id_hora: Number(h.id_hora),
        hora: String(h.hora ?? ""),
      })),
    } : null,
  } as CodigoOperativo;
}

function normalizePlan(r: any): PlanLigero {
  return {
    id_plan: Number(r.id_plan),
    nombre_plan: String(r.nombre_plan ?? ""),
    precio_plan: r.precio_plan == null ? null : Number(r.precio_plan),
    tipo_fecha: r.tipo_fecha ?? null,
    tipo_hora: r.tipo_hora ?? null,
    plan_fechas: [],
    plan_horas: [],
  };
}

export async function getCodigosOperativos(): Promise<CodigoOperativo[]> {
  try {
    const db = client();

    // Primero cargamos SIEMPRE la tabla principal sin relaciones embebidas.
    // Así un fallo en plan, fechas, horas o en la tabla puente jamás vuelve
    // a ocultar todos los CH que sí existen en codigo_operativo.
    const { data, error } = await db
      .from("codigo_operativo")
      .select("id_codigo_operativo,codigo_ch,descripcion,id_plan,incluye_almuerzo,restaurante,prioridad,activo,created_at,updated_at")
      .order("codigo_ch", { ascending: true });

    if (error) throw error;

    const base = (data ?? []).map((row: any) => normalizeCodigo({ ...row, plan: null }));
    if (!base.length) return [];

    let links: Array<{ id_codigo_operativo: number; id_plan: number; activo: boolean }> = [];
    const { data: linkData, error: linksError } = await db
      .from("codigo_operativo_plan")
      .select("id_codigo_operativo,id_plan,activo")
      .eq("activo", true);

    if (linksError) {
      console.warn("No se pudieron cargar vínculos múltiples de códigos CH; se usarán los vínculos directos:", linksError);
    } else {
      links = (linkData ?? []).map((link: any) => ({
        id_codigo_operativo: Number(link.id_codigo_operativo),
        id_plan: Number(link.id_plan),
        activo: link.activo !== false,
      }));
    }

    const linksByCode = new Map<number, number[]>();
    for (const link of links) {
      if (!Number.isFinite(link.id_codigo_operativo) || !Number.isFinite(link.id_plan)) continue;
      const current = linksByCode.get(link.id_codigo_operativo) ?? [];
      if (!current.includes(link.id_plan)) current.push(link.id_plan);
      linksByCode.set(link.id_codigo_operativo, current);
    }

    // Para un CH con id_plan NULL pero vínculos en la tabla puente (CH030),
    // mostramos los vínculos reales en lugar de una fila falsa "sin vincular".
    const expanded: CodigoOperativo[] = [];
    const seen = new Set<string>();

    for (const code of base) {
      const linkedPlans = linksByCode.get(code.id_codigo_operativo) ?? [];
      const planIds = new Set<number>(linkedPlans);
      if (code.id_plan != null) planIds.add(code.id_plan);

      if (!planIds.size) {
        expanded.push({ ...code, plan: null });
        continue;
      }

      for (const idPlan of planIds) {
        const key = `${code.id_codigo_operativo}:${idPlan}`;
        if (seen.has(key)) continue;
        seen.add(key);
        expanded.push({ ...code, id_plan: idPlan, plan: null });
      }
    }

    const planIds = [...new Set(expanded.map((c) => c.id_plan).filter((id): id is number => id != null))];
    const planMap = new Map<number, PlanLigero>();

    if (planIds.length) {
      const { data: planData, error: planError } = await db
        .from("plan")
        .select("id_plan,nombre_plan,precio_plan,tipo_fecha,tipo_hora")
        .in("id_plan", planIds);

      if (planError) {
        console.warn("Los CH se cargaron, pero no fue posible completar los nombres de los planes:", planError);
      } else {
        for (const row of planData ?? []) {
          const plan = normalizePlan(row);
          planMap.set(plan.id_plan, plan);
        }
      }
    }

    return expanded
      .map((code) => ({
        ...code,
        plan: code.id_plan == null ? null : planMap.get(code.id_plan) ?? null,
      }))
      .sort((a, b) => a.codigo_ch.localeCompare(b.codigo_ch) || Number(a.id_plan ?? 0) - Number(b.id_plan ?? 0));
  } catch (error) {
    console.error("No fue posible cargar los códigos operativos:", error);
    throw error;
  }
}

export async function createCodigoOperativo(payload: CodigoOperativoPayload) {
  const db = client();
  const clean = {
    ...payload,
    codigo_ch: payload.codigo_ch.trim().toUpperCase(),
    descripcion: payload.descripcion.trim(),
    restaurante: payload.incluye_almuerzo && payload.restaurante?.trim() ? payload.restaurante.trim() : null,
    prioridad: Number(payload.prioridad || 0),
    activo: payload.activo !== false,
  };

  // codigo_ch es único. Si el CH ya existe, no intentamos duplicarlo:
  // si seleccionaron un plan, simplemente añadimos/reavivamos el vínculo
  // en codigo_operativo_plan (caso CH030 compartido por Buggies).
  const { data: existing, error: existingError } = await db
    .from("codigo_operativo")
    .select("id_codigo_operativo,codigo_ch,descripcion,id_plan,incluye_almuerzo,restaurante,prioridad,activo,created_at,updated_at")
    .eq("codigo_ch", clean.codigo_ch)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    if (clean.id_plan == null) {
      throw new Error(`${clean.codigo_ch} ya existe. Selecciona un plan para vincularlo o edita el código existente.`);
    }

    const { error: linkError } = await db
      .from("codigo_operativo_plan")
      .upsert(
        {
          id_codigo_operativo: Number(existing.id_codigo_operativo),
          id_plan: Number(clean.id_plan),
          activo: true,
        },
        { onConflict: "id_codigo_operativo,id_plan" },
      );

    if (linkError) throw linkError;
    return existing;
  }

  const { data: created, error } = await db
    .from("codigo_operativo")
    .insert(clean)
    .select()
    .single();

  if (error) throw error;

  if (clean.id_plan != null) {
    const { error: linkError } = await db
      .from("codigo_operativo_plan")
      .upsert(
        {
          id_codigo_operativo: Number(created.id_codigo_operativo),
          id_plan: Number(clean.id_plan),
          activo: true,
        },
        { onConflict: "id_codigo_operativo,id_plan" },
      );
    if (linkError) throw linkError;
  }

  return created;
}

export async function updateCodigoOperativo(id: number, payload: Partial<CodigoOperativoPayload>) {
  const db = client();
  const clean: Record<string, unknown> = { ...payload };
  if (typeof payload.codigo_ch === "string") clean.codigo_ch = payload.codigo_ch.trim().toUpperCase();
  if (typeof payload.descripcion === "string") clean.descripcion = payload.descripcion.trim();
  if (payload.incluye_almuerzo === false) clean.restaurante = null;
  if (typeof payload.restaurante === "string") clean.restaurante = payload.restaurante.trim() || null;
  if (payload.prioridad != null) clean.prioridad = Number(payload.prioridad || 0);

  const requestedPlan = payload.id_plan;

  // id_plan se mantiene por compatibilidad para los CH tradicionales,
  // y adicionalmente sincronizamos la tabla puente cuando se selecciona plan.
  const { data, error } = await db
    .from("codigo_operativo")
    .update(clean)
    .eq("id_codigo_operativo", id)
    .select()
    .single();
  if (error) throw error;

  if (requestedPlan != null) {
    const { error: linkError } = await db
      .from("codigo_operativo_plan")
      .upsert(
        { id_codigo_operativo: id, id_plan: Number(requestedPlan), activo: true },
        { onConflict: "id_codigo_operativo,id_plan" },
      );
    if (linkError) throw linkError;
  }

  return data;
}

export async function deleteCodigoOperativo(id: number) {
  const { error } = await client().from("codigo_operativo").delete().eq("id_codigo_operativo", id);
  if (error) throw error;
}

export function codigosCompatibles(codigos: CodigoOperativo[], idPlan: number | null, incluyeAlmuerzo: boolean, restaurante?: string | null) {
  const rest = String(restaurante ?? "").trim().toLowerCase();
  return codigos
    .filter((c) => c.activo && c.id_plan === idPlan && c.incluye_almuerzo === incluyeAlmuerzo)
    .filter((c) => !incluyeAlmuerzo || !c.restaurante || c.restaurante.trim().toLowerCase() === rest)
    .sort((a, b) => {
      const exactA = cRestaurant(a) === rest && !!a.restaurante ? 1 : 0;
      const exactB = cRestaurant(b) === rest && !!b.restaurante ? 1 : 0;
      return exactB - exactA || b.prioridad - a.prioridad || a.codigo_ch.localeCompare(b.codigo_ch);
    });
}

function cRestaurant(c: CodigoOperativo) {
  return String(c.restaurante ?? "").trim().toLowerCase();
}

export async function aprobarReservaOperativa(args: {
  id_reserva: number;
  valor_abonado: number;
  metodo_pago: string;
  incluye_almuerzo: boolean;
  restaurante?: string | null;
  id_codigo_operativo?: number | null;
}) {
  const { data, error } = await client().rpc("aprobar_reserva_operativa", {
    p_id_reserva: args.id_reserva,
    p_valor_abonado: args.valor_abonado,
    p_metodo_pago: args.metodo_pago,
    p_incluye_almuerzo: args.incluye_almuerzo,
    p_restaurante: args.incluye_almuerzo ? args.restaurante || null : null,
    p_id_codigo_operativo: args.id_codigo_operativo || null,
  });
  if (error) throw error;
  return String(data ?? "");
}

export async function cambiarCodigoOperativoReserva(args: {
  id_reserva: number;
  id_plan: number;
  incluye_almuerzo: boolean;
  restaurante?: string | null;
  id_codigo_operativo?: number | null;
}) {
  const { data, error } = await client().rpc("cambiar_codigo_operativo_reserva", {
    p_id_reserva: args.id_reserva,
    p_id_plan: args.id_plan,
    p_incluye_almuerzo: args.incluye_almuerzo,
    p_restaurante: args.incluye_almuerzo ? args.restaurante || null : null,
    p_id_codigo_operativo: args.id_codigo_operativo || null,
  });
  if (error) throw error;
  return String(data ?? "");
}
