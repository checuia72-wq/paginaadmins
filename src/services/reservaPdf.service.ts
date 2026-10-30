import { supabase } from "../lib/supabase";

/** El flujo existente de n8n genera y envía el PDF en una misma ejecución. */
export async function rehacerYReenviarPdfReserva(idReserva: number): Promise<void> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("rehacer_y_reenviar_pdf_reserva", {
    p_id_reserva: idReserva,
  });
  if (error) throw error;
  // La solicitud se encola de forma asíncrona; no implica que WhatsApp ya la haya entregado.
}
