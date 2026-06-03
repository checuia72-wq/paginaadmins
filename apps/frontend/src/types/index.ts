/* =========================================================
   TIPOS CENTRALES — Forigua
   Alineados con el esquema de la BD y la API V2.
   Ubicación: src/types/index.ts
========================================================= */

/* ---------- ENUM etapa_conversacion ----------
   Ajusta estos valores si tu enum en la BD tiene otros.
   Por ahora se incluyen los conocidos + se permite string
   para no romper si llegan valores nuevos desde el backend. */
export const ETAPAS_CONVERSACION = [
  "saludo",
  "seleccion_plan",
  "reserva",
  "confirmacion",
  "finalizado",
] as const;

export type EtapaConversacion = (typeof ETAPAS_CONVERSACION)[number] | string;

/* =========================
   PLAN
========================= */
export type Plan = {
  id_plan: number;
  nombre_plan: string;
  precio_plan: number;
  descripcion_basica: string | null;
  descripcion_detallada: string | null;
  fecha_plan: string | null;
  hora_plan: string | null;
  imagen_url: string | null;
  numero_plan: number | null;
};

/* =========================
   CLIENTE
========================= */
export type Cliente = {
  telefono: string;
  atencion_humana: boolean;
  etapaconversacion: EtapaConversacion;
  id_plan: number | null;
};

/* =========================
   RESERVA
   GET /api/reservas devuelve la reserva + datos del
   cliente y del plan mediante JOIN.
========================= */
export type Reserva = {
  id_reserva: number;
  fecha_solicitud: string;
  fecha_aprobacion: string | null;
  telefono_cliente: string;
  id_plan: number;
  cantidad_personas: number;
  aprobado: boolean;

  // Campos provenientes del JOIN (cliente)
  telefono?: string;
  atencion_humana?: boolean;

  // Campos provenientes del JOIN (plan)
  nombre_plan?: string;
  precio_plan?: number;
  fecha_plan?: string | null;
  hora_plan?: string | null;
  imagen_url?: string | null;
};

/* =========================
   PARTICIPANTE
========================= */
export type Participante = {
  id_participante: number;
  id_reserva: number;
  nombre: string;
  edad: number | null;
  estatura: number | null;
  peso: number | null;
  telefono_cliente: string | null;
  telefono_participante: string | null;
};