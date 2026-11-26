import { supabase } from "../lib/supabase";

/**
 * Sólo los administradores pueden consultar métricas agregadas y gestionar FAQ.
 * La autorización real está aplicada en Supabase (RPC y políticas RLS).
 */
function db() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type BotResumen = {
  contactos_activaron_bot: number;
  contactos_entrantes: number;
  contactos_atendidos: number;
  contactos_sin_respuesta_bot: number;
  contactos_un_mensaje: number;
  contactos_continuaron: number;
  mensajes_entrantes: number;
  mensajes_aceptados_ycloud: number;
  mensajes_ia: number;
  mensajes_seguimiento: number;
  mensajes_fallidos_ycloud: number;
  contactos_con_plan: number;
  contactos_con_enlace: number;
  contactos_como_reservar: number;
  contactos_derivados: number;
  contactos_con_alerta: number;
};

export type BotDia = {
  dia: string;
  mensajes_entrantes: number;
  mensajes_aceptados: number;
  contactos_entrantes: number;
  contactos_atendidos: number;
  contactos_con_enlace: number;
};

export type BotMetricas = {
  desde: string;
  hasta: string;
  bitacora_desde: string | null;
  criterio_activacion: string;
  metricas: BotResumen;
  diario: BotDia[];
  ventas_asociadas: {
    reservas_registradas: number;
    reservas_aprobadas: number;
    valor_aprobado_cop: number;
  };
};

export async function getBotMetricas(desde: string, hasta: string): Promise<BotMetricas> {
  const { data, error } = await db().rpc("checua_bot_metrics", { p_from: desde, p_to: hasta });
  if (error) throw error;
  if (!data || typeof data !== "object" || !("metricas" in data)) {
    throw new Error("La consulta de métricas no devolvió un resultado válido");
  }
  return data as BotMetricas;
}

export type PreguntaFrecuenteBot = {
  id: number;
  codigo: string;
  categoria: string;
  pregunta: string;
  respuesta: string;
  palabras_clave: string[];
  confirmacion_por_plan: boolean;
  activa: boolean;
  prioridad: number;
  creado_en: string;
  actualizado_en: string;
};

export type FaqPayload = Pick<PreguntaFrecuenteBot,
  "codigo" | "categoria" | "pregunta" | "respuesta" |
  "palabras_clave" | "confirmacion_por_plan" | "activa" | "prioridad">;

const FAQ_SELECT = "id,codigo,categoria,pregunta,respuesta,palabras_clave,confirmacion_por_plan,activa,prioridad,creado_en,actualizado_en";

export async function listBotFaq(): Promise<PreguntaFrecuenteBot[]> {
  const { data, error } = await db().from("faq_bot").select(FAQ_SELECT)
    .order("prioridad", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PreguntaFrecuenteBot[];
}

export async function saveBotFaq(payload: FaqPayload, id?: number): Promise<PreguntaFrecuenteBot> {
  const clean: FaqPayload = {
    codigo: payload.codigo.trim().toLowerCase(),
    categoria: payload.categoria.trim().toLowerCase(),
    pregunta: payload.pregunta.trim(),
    respuesta: payload.respuesta.trim(),
    palabras_clave: Array.from(new Set(payload.palabras_clave.map(t => t.trim().toLowerCase()).filter(Boolean))),
    confirmacion_por_plan: payload.confirmacion_por_plan,
    activa: payload.activa,
    prioridad: payload.prioridad,
  };
  if (!/^[a-z0-9_]+$/.test(clean.codigo)) {
    throw new Error("El código solo puede contener letras minúsculas, números y guiones bajos");
  }
  if (!clean.categoria || !clean.pregunta || clean.respuesta.length < 15) {
    throw new Error("Completa la categoría, la pregunta y una respuesta de al menos 15 caracteres");
  }
  if (!Number.isInteger(clean.prioridad) || clean.prioridad < 0 || clean.prioridad > 32767) {
    throw new Error("La prioridad debe ser un número entre 0 y 32767");
  }
  const query = id == null
    ? db().from("faq_bot").insert(clean)
    : db().from("faq_bot").update({ ...clean, actualizado_en: new Date().toISOString() }).eq("id", id);
  const { data, error } = await query.select(FAQ_SELECT).single();
  if (error) throw error;
  return data as PreguntaFrecuenteBot;
}

export async function removeBotFaq(id: number): Promise<void> {
  const { error, count } = await db().from("faq_bot").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw new Error("La pregunta ya no existe o no tienes autorización para eliminarla");
}
