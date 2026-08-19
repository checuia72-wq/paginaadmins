import { supabase } from "../lib/supabase";

export interface DashboardPlan {
  id_plan: number;
  nombre_plan: string;
  precio_plan?: number | null;
}

export interface DashboardReserva {
  id_reserva: number;
  fecha_solicitud?: string | null;
  fecha_aprobacion?: string | null;
  telefono_cliente?: string | null;
  id_plan?: number | null;
  cantidad_personas?: number | null;
  aprobado?: boolean | null;
  precio_unitario?: number | null;
  valor_total?: number | null;
  valor_abonado?: number | null;
  valor_saldo_pagado?: number | null;
  metodo_pago_abono?: "efectivo" | "transferencia" | null;
  metodo_pago_saldo?: "efectivo" | "transferencia" | null;
  plan?: DashboardPlan | null;
}

export interface DashboardCliente {
  telefono: string;
  atencion_humana?: boolean | null;
  etapaconversacion?: string | null;
}

export interface DashboardParticipante {
  id_participante: number;
  id_reserva?: number | null;
}

export interface DashboardAnalyticsData {
  reservas: DashboardReserva[];
  planes: DashboardPlan[];
  clientes: DashboardCliente[];
  participantes: DashboardParticipante[];
}

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function getDashboardAnalytics(): Promise<DashboardAnalyticsData> {
  const db = client();
  const [reservasResult, planesResult, clientesResult, participantesResult] = await Promise.all([
    db
      .from("reserva")
      .select(`
        id_reserva,
        fecha_solicitud,
        fecha_aprobacion,
        telefono_cliente,
        id_plan,
        cantidad_personas,
        aprobado,
        precio_unitario,
        valor_total,
        valor_abonado,
        valor_saldo_pagado,
        metodo_pago_abono,
        metodo_pago_saldo,
        plan (
          id_plan,
          nombre_plan,
          precio_plan
        )
      `)
      .order("id_reserva", { ascending: false }),
    db
      .from("plan")
      .select("id_plan, nombre_plan, precio_plan")
      .order("id_plan", { ascending: true }),
    db
      .from("cliente")
      .select("telefono, atencion_humana, etapaconversacion"),
    db
      .from("participante")
      .select("id_participante, id_reserva"),
  ]);

  if (reservasResult.error) throw reservasResult.error;
  if (planesResult.error) throw planesResult.error;
  if (clientesResult.error) throw clientesResult.error;
  if (participantesResult.error) throw participantesResult.error;

  return {
    reservas: (reservasResult.data ?? []) as unknown as DashboardReserva[],
    planes: (planesResult.data ?? []) as DashboardPlan[],
    clientes: (clientesResult.data ?? []) as DashboardCliente[],
    participantes: (participantesResult.data ?? []) as DashboardParticipante[],
  };
}
