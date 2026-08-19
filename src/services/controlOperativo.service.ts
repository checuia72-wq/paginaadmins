import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type ControlOperativoRow = {
  id_reserva: number;
  id_participante: number | null;
  reserva_codigo: string;
  id_plan: number | null;
  id_hora: number | null;
  plan: string;
  fecha: string;
  hora: string;
  aprobado: boolean | null;
  nombre: string;
  edad: number | null;
  nacionalidad: string;
  tipo_documento: string;
  documento: string;
  contacto: string;
  contacto_cliente: string;
  cantidad: number | null;
  mina: boolean | null;
  refrigerio: boolean | null;
  restaurante: string;
  almuerzo: string;
  total: number;
  abono: number;
  medio_abono: string;
  pago_saldo: number;
  medio_saldo: string;
  saldo_pendiente: number;
  observacion: string;
};

const text = (value: unknown) => (value == null ? "" : String(value));
const num = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function getControlOperativo(): Promise<ControlOperativoRow[]> {
  const [reservasRes, participantesRes, planesRes, fechasRes, horasRes] = await Promise.all([
    client().from("reserva").select("*").eq("aprobado", true).order("id_reserva", { ascending: false }),
    client().from("participante").select("*").order("id_participante", { ascending: true }),
    client().from("plan").select("*"),
    client().from("plan_fechas").select("*"),
    client().from("plan_horas").select("*"),
  ]);

  const errors = [reservasRes.error, participantesRes.error, planesRes.error, fechasRes.error, horasRes.error].filter(Boolean);
  if (errors.length) throw errors[0];

  const reservas = reservasRes.data ?? [];
  const participantes = participantesRes.data ?? [];
  const planes = planesRes.data ?? [];
  const fechas = fechasRes.data ?? [];
  const horas = horasRes.data ?? [];

  const planMap = new Map(planes.map((p: any) => [Number(p.id_plan), p]));
  const fechaMap = new Map(fechas.map((f: any) => [Number(f.id_fecha), f]));
  const horaMap = new Map(horas.map((h: any) => [Number(h.id_hora), h]));
  const participantesPorReserva = new Map<number, any[]>();

  for (const p of participantes as any[]) {
    const id = Number(p.id_reserva);
    if (!participantesPorReserva.has(id)) participantesPorReserva.set(id, []);
    participantesPorReserva.get(id)!.push(p);
  }

  const rows: ControlOperativoRow[] = [];

  for (const r of reservas as any[]) {
    const plan = planMap.get(Number(r.id_plan));
    const fechaRelacionada = fechaMap.get(Number(r.id_fecha));
    const horaRelacionada = horaMap.get(Number(r.id_hora));
    const personas = participantesPorReserva.get(Number(r.id_reserva)) ?? [null];

    // La reserva es la fuente de verdad. Si el esquema actual guarda solo el id,
    // se resuelve contra plan_fechas / plan_horas como respaldo.
    const fechaReserva = text(r.fecha_reserva || r.fecha || fechaRelacionada?.fecha);
    const horaReserva = text(r.hora_reserva || r.hora || horaRelacionada?.hora);

    const cantidadPersonas = r.cantidad_personas == null
      ? personas.filter(Boolean).length
      : num(r.cantidad_personas);
    const precioPlan = num(plan?.precio_plan);

    const totalCalculado = precioPlan > 0 ? precioPlan * cantidadPersonas : 0;
    const totalRespaldo = num(r.valor_total) > 0
      ? num(r.valor_total)
      : num(r.precio_unitario) * cantidadPersonas;
    const total = totalCalculado > 0 ? totalCalculado : totalRespaldo;

    const abono = num(r.valor_abonado);
    const pagoSaldo = num(r.valor_saldo_pagado);
    const saldo = Math.max(0, total - abono - pagoSaldo);

    for (const p of personas) {
      const contactoCliente = text(p?.telefono_cliente || r.telefono_cliente);
      rows.push({
        id_reserva: Number(r.id_reserva),
        id_participante: p ? Number(p.id_participante) : null,
        reserva_codigo: text(r.codigo_reserva) || `#${r.id_reserva}`,
        id_plan: r.id_plan == null ? null : Number(r.id_plan),
        id_hora: r.id_hora == null ? null : Number(r.id_hora),
        plan: text(plan?.nombre_plan),
        fecha: fechaReserva,
        hora: horaReserva,
        aprobado: r.aprobado ?? null,
        nombre: text(p?.nombre),
        edad: p?.edad == null ? null : Number(p.edad),
        nacionalidad: text(p?.nacionalidad),
        tipo_documento: text(p?.tipo_documento),
        documento: text(p?.numero_documento),
        contacto: text(p?.telefono_participante || contactoCliente),
        contacto_cliente: contactoCliente,
        cantidad: cantidadPersonas,
        mina: r.mina ?? null,
        refrigerio: r.refrigerio ?? null,
        restaurante: text(r.restaurante),
        almuerzo: text(p?.tipo_almuerzo),
        total,
        abono,
        medio_abono: text(r.metodo_pago_abono),
        pago_saldo: pagoSaldo,
        medio_saldo: text(r.metodo_pago_saldo),
        saldo_pendiente: saldo,
        observacion: text(r.observacion),
      });
    }
  }

  return rows;
}

export async function updateControlReserva(idReserva: number, payload: Record<string, unknown>) {
  const { data, error } = await client()
    .from("reserva")
    .update(payload)
    .eq("id_reserva", idReserva)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateControlParticipante(idParticipante: number, payload: Record<string, unknown>) {
  const { data, error } = await client()
    .from("participante")
    .update(payload)
    .eq("id_participante", idParticipante)
    .select()
    .single();
  if (error) throw error;
  return data;
}
