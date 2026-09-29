import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type OrigenPlanAdicional = "plan" | "adicional";
export type TipoCobroPlanAdicional = "por_persona" | "por_reserva";

type TarifaPlanAdicional = {
  id_plan: number;
  personas_min: number;
  personas_max: number | null;
  precio_persona: number;
  tipo_dia: "todos" | "semana" | "fin_semana" | "festivo";
  activo: boolean;
};

export type OpcionPlanAdicional = {
  key: string;
  origen: OrigenPlanAdicional;
  id_plan: number | null;
  id_adicional: number | null;
  nombre: string;
  descripcion: string;
  tipo_cobro: TipoCobroPlanAdicional;
  precio_base: number;
  id_plan_padre: number | null;
  tipo_fecha: string | null;
  tarifas: TarifaPlanAdicional[];
};

export type ReservaPlanAdicional = {
  id_reserva_plan_adicional: number;
  id_reserva: number;
  origen: OrigenPlanAdicional;
  id_plan_adicional: number | null;
  id_adicional: number | null;
  nombre: string;
  tipo_cobro: TipoCobroPlanAdicional;
  precio_unitario: number;
  cantidad_personas: number;
  aplica_todos: boolean;
  impacto_total: number;
  activo: boolean;
  created_at?: string;
};

export type ImpactoPlanAdicional = {
  precio_unitario: number;
  impacto_total: number;
  detalle: string;
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const tarifaAplica = (tarifa: TarifaPlanAdicional, personas: number) =>
  personas >= Number(tarifa.personas_min || 1) &&
  (tarifa.personas_max == null || personas <= Number(tarifa.personas_max));

function esFinDeSemana(fecha: string) {
  if (!fecha) return false;
  const [year, month, day] = fecha.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return false;
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

function tarifaPara(opcion: OpcionPlanAdicional, personas: number, fecha: string) {
  const activas = opcion.tarifas.filter((t) => t.activo !== false);
  const tipoDia = esFinDeSemana(fecha) ? "fin_semana" : "semana";
  return activas.find((t) => t.tipo_dia === tipoDia && tarifaAplica(t, personas))
    ?? activas.find((t) => t.tipo_dia === "todos" && tarifaAplica(t, personas))
    ?? null;
}

function totalSubplanPorReserva(opcion: OpcionPlanAdicional, personas: number) {
  const activas = opcion.tarifas.filter((t) => t.activo !== false);
  const tarifaUno = activas.find((t) => t.tipo_dia === "todos" && tarifaAplica(t, 1));
  const tarifaDos = activas.find((t) => t.tipo_dia === "todos" && tarifaAplica(t, 2));
  const totalUno = tarifaUno ? num(tarifaUno.precio_persona) : num(opcion.precio_base);
  const totalDos = tarifaDos ? num(tarifaDos.precio_persona) * 2 : totalUno * 2;
  const pares = Math.floor(personas / 2);
  const individual = personas % 2;
  return {
    total: pares * totalDos + individual * totalUno,
    referencia: personas === 1 ? totalUno : totalDos,
    detalle: personas === 1
      ? `1 persona · tarifa por reserva ${moneyText(totalUno)}`
      : `${pares} unidad(es) para 2 persona(s)${individual ? " + 1 individual" : ""} · tarifa por reserva`,
  };
}

const moneyText = (value: number) => "$" + Number(value || 0).toLocaleString("es-CO");

export async function getOpcionesPlanesAdicionales(idPlanActual?: number | null): Promise<OpcionPlanAdicional[]> {
  const db = client();
  const [planesRes, tarifasRes, adicionalesRes] = await Promise.all([
    db.from("plan").select("id_plan,nombre_plan,descripcion_basica,precio_plan,tipo_fecha,id_plan_padre,es_grupo,activo").eq("activo", true),
    db.from("plan_tarifa").select("id_plan,personas_min,personas_max,precio_persona,tipo_dia,activo").eq("activo", true),
    db.from("adicional").select("id_adicional,nombre,descripcion,precio,tipo_cobro,activo").eq("activo", true),
  ]);
  if (planesRes.error) throw planesRes.error;
  if (tarifasRes.error) throw tarifasRes.error;
  if (adicionalesRes.error) throw adicionalesRes.error;

  const tarifas = (tarifasRes.data ?? []).map((row: any) => ({
    ...row,
    id_plan: Number(row.id_plan),
    personas_min: Number(row.personas_min ?? 1),
    personas_max: row.personas_max == null ? null : Number(row.personas_max),
    precio_persona: num(row.precio_persona),
    activo: row.activo !== false,
  })) as TarifaPlanAdicional[];

  const opcionesPlanes: OpcionPlanAdicional[] = (planesRes.data ?? [])
    .filter((plan: any) => !plan.es_grupo && Number(plan.id_plan) !== Number(idPlanActual))
    .map((plan: any) => ({
      key: `plan:${plan.id_plan}`,
      origen: "plan" as const,
      id_plan: Number(plan.id_plan),
      id_adicional: null,
      nombre: String(plan.nombre_plan ?? "Plan"),
      descripcion: String(plan.descripcion_basica ?? ""),
      tipo_cobro: plan.id_plan_padre ? "por_reserva" as const : "por_persona" as const,
      precio_base: num(plan.precio_plan),
      id_plan_padre: plan.id_plan_padre == null ? null : Number(plan.id_plan_padre),
      tipo_fecha: plan.tipo_fecha == null ? null : String(plan.tipo_fecha),
      tarifas: tarifas.filter((t) => t.id_plan === Number(plan.id_plan)),
    }));

  const opcionesAdicionales: OpcionPlanAdicional[] = (adicionalesRes.data ?? []).map((adicional: any) => ({
    key: `adicional:${adicional.id_adicional}`,
    origen: "adicional" as const,
    id_plan: null,
    id_adicional: Number(adicional.id_adicional),
    nombre: String(adicional.nombre ?? "Adicional"),
    descripcion: String(adicional.descripcion ?? ""),
    tipo_cobro: adicional.tipo_cobro === "por_reserva" ? "por_reserva" as const : "por_persona" as const,
    precio_base: num(adicional.precio),
    id_plan_padre: null,
    tipo_fecha: null,
    tarifas: [],
  }));

  return [...opcionesPlanes, ...opcionesAdicionales].sort((a, b) => {
    if (a.origen !== b.origen) return a.origen === "plan" ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export function calcularImpactoPlanAdicional(opcion: OpcionPlanAdicional, cantidadPersonas: number, fecha: string): ImpactoPlanAdicional {
  const personas = Math.max(1, Math.floor(Number(cantidadPersonas || 1)));

  if (opcion.origen === "adicional") {
    const unitario = num(opcion.precio_base);
    const total = opcion.tipo_cobro === "por_persona" ? unitario * personas : unitario;
    return {
      precio_unitario: unitario,
      impacto_total: total,
      detalle: opcion.tipo_cobro === "por_persona"
        ? `${personas} × ${moneyText(unitario)}`
        : `Tarifa fija por reserva · ${moneyText(unitario)}`,
    };
  }

  if (opcion.id_plan_padre != null) {
    const calculo = totalSubplanPorReserva(opcion, personas);
    return {
      precio_unitario: calculo.referencia,
      impacto_total: calculo.total,
      detalle: calculo.detalle,
    };
  }

  const tarifa = tarifaPara(opcion, personas, fecha);
  const unitario = tarifa ? num(tarifa.precio_persona) : num(opcion.precio_base);
  return {
    precio_unitario: unitario,
    impacto_total: unitario * personas,
    detalle: `${personas} × ${moneyText(unitario)}`,
  };
}

export async function getReservaPlanesAdicionales(idReserva: number): Promise<ReservaPlanAdicional[]> {
  const { data, error } = await client()
    .from("reserva_plan_adicional")
    .select("id_reserva_plan_adicional,id_reserva,origen,id_plan_adicional,id_adicional,nombre,tipo_cobro,precio_unitario,cantidad_personas,aplica_todos,impacto_total,activo,created_at")
    .eq("id_reserva", Number(idReserva))
    .eq("activo", true)
    .order("created_at", { ascending: true });

  if (error) {
    if (/reserva_plan_adicional|does not exist|schema cache/i.test(error.message ?? "")) {
      throw new Error("Falta ejecutar el SQL de planes adicionales en Supabase.");
    }
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    id_reserva_plan_adicional: Number(row.id_reserva_plan_adicional),
    id_reserva: Number(row.id_reserva),
    id_plan_adicional: row.id_plan_adicional == null ? null : Number(row.id_plan_adicional),
    id_adicional: row.id_adicional == null ? null : Number(row.id_adicional),
    precio_unitario: num(row.precio_unitario),
    cantidad_personas: Number(row.cantidad_personas ?? 1),
    aplica_todos: !!row.aplica_todos,
    impacto_total: num(row.impacto_total),
    activo: row.activo !== false,
  })) as ReservaPlanAdicional[];
}

export async function agregarPlanAdicionalReserva(args: {
  id_reserva: number;
  opcion: OpcionPlanAdicional;
  cantidad_personas: number;
  aplica_todos: boolean;
  precio_unitario: number;
  impacto_total: number;
}) {
  const { data, error } = await client().rpc("agregar_plan_adicional_reserva", {
    p_id_reserva: Number(args.id_reserva),
    p_origen: args.opcion.origen,
    p_id_plan_adicional: args.opcion.id_plan,
    p_id_adicional: args.opcion.id_adicional,
    p_nombre: args.opcion.nombre,
    p_tipo_cobro: args.opcion.tipo_cobro,
    p_precio_unitario: Number(args.precio_unitario),
    p_cantidad_personas: Math.max(1, Number(args.cantidad_personas)),
    p_aplica_todos: !!args.aplica_todos,
    p_impacto_total: Number(args.impacto_total),
  });

  if (error) {
    if (/agregar_plan_adicional_reserva|schema cache|does not exist/i.test(error.message ?? "")) {
      throw new Error("Falta ejecutar el SQL de planes adicionales en Supabase.");
    }
    throw error;
  }

  const result: any = data ?? {};
  return {
    id_reserva_plan_adicional: Number(result.id_reserva_plan_adicional ?? 0),
    nuevo_total: num(result.nuevo_total),
  };
}

export async function retirarPlanAdicionalReserva(idReservaPlanAdicional: number) {
  const { data, error } = await client().rpc("retirar_plan_adicional_reserva", {
    p_id_reserva_plan_adicional: Number(idReservaPlanAdicional),
  });

  if (error) {
    if (/retirar_plan_adicional_reserva|schema cache|does not exist/i.test(error.message ?? "")) {
      throw new Error("Falta ejecutar el SQL de planes adicionales en Supabase.");
    }
    throw error;
  }

  const result: any = data ?? {};
  return { nuevo_total: num(result.nuevo_total) };
}
