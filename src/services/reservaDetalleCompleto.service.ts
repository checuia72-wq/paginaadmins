import { supabase } from "../lib/supabase";
import { getReservaAdicionales, type ReservaAdicional, type ReservaAdicionalInput } from "./adicional.service";
import { getReservaPlanesAdicionales, type ReservaPlanAdicional } from "./reservaPlanAdicional.service";
import { getReservaPagos, type ReservaPago } from "./controlOperativo.service";

export type DetalleCompletoReserva = {
  reserva: Record<string, any>;
  adicionales: ReservaAdicional[];
  planesAdicionales: ReservaPlanAdicional[];
  pagos: ReservaPago[];
  codigoOperativo: string | null;
  nombresMenu: Record<number, string>;
};

// Es la misma información persistida que lee el flujo de confirmaciones:
// no se infieren los cobros a partir de los nombres del catálogo.
export async function getDetalleCompletoReserva(idReserva: number): Promise<DetalleCompletoReserva> {
  if (!supabase) throw new Error("Supabase no está configurado");
  const [reservaResp, adicionales, planesAdicionales, pagos] = await Promise.all([
    supabase.from("reserva").select("*").eq("id_reserva", idReserva).single(),
    getReservaAdicionales(idReserva),
    getReservaPlanesAdicionales(idReserva),
    getReservaPagos(idReserva),
  ]);
  if (reservaResp.error) throw reservaResp.error;
  const reserva = reservaResp.data as Record<string, any>;
  let codigoOperativo: string | null = null;
  if (reserva.id_codigo_operativo) {
    const { data, error } = await supabase.from("codigo_operativo")
      .select("codigo_ch").eq("id_codigo_operativo", reserva.id_codigo_operativo).maybeSingle();
    if (error) console.warn("No se pudo obtener el código operativo", error);
    codigoOperativo = data?.codigo_ch ?? null;
  }
  const menuIds = Array.from(new Set([
    ...(Array.isArray(reserva.seleccion_almuerzos) ? reserva.seleccion_almuerzos : [])
      .map((item: any) => Number(item.id_menu)),
    Number(reserva.id_menu_almuerzo_adicional),
  ].filter(id => Number.isFinite(id) && id > 0)));
  let nombresMenu: Record<number, string> = {};
  if (menuIds.length) {
    const { data, error } = await supabase.from("restaurante_menu")
      .select("id_menu,nombre_plato").in("id_menu", menuIds);
    if (error) console.warn("No se pudieron recuperar los nombres de los platos", error);
    else nombresMenu = Object.fromEntries((data ?? []).map(row => [Number(row.id_menu), String(row.nombre_plato)]));
  }
  return { reserva, adicionales, planesAdicionales, pagos, codigoOperativo, nombresMenu };
}

export function impactoAdicionalesGuardados(adicionales: Pick<ReservaAdicionalInput, "impacto_total">[]) {
  return adicionales.reduce((total, item) => total + Number(item.impacto_total || 0), 0);
}

// Algunas reservas históricas tienen adicionales anotados pero no cobrados.
// No descontar del valor contratado importes que nunca fueron sumados al total.
export function desgloseEdicionReserva(
  totalGuardado: number,
  precioUnitarioPlan: number,
  personas: number,
  adicionalesOriginales: ReservaAdicionalInput[],
  planesAdicionales: ReservaPlanAdicional[],
) {
  const subtotalPlanesAdicionales = planesAdicionales
    .filter(item => item.activo)
    .reduce((n, item) => n + Number(item.impacto_total || 0), 0);
  const baseReferencia = Math.max(0, precioUnitarioPlan) * Math.max(1, personas);
  const adicionalHistorico = Math.max(0, impactoAdicionalesGuardados(adicionalesOriginales));
  const yaCobrado = Math.min(adicionalHistorico,
    Math.max(0, totalGuardado - baseReferencia - subtotalPlanesAdicionales));
  return {
    base: Math.max(0, totalGuardado - subtotalPlanesAdicionales - yaCobrado),
    planesExtra: subtotalPlanesAdicionales,
    adicionalesCobrados: yaCobrado,
    adicionalesHistoricos: adicionalHistorico,
  };
}
