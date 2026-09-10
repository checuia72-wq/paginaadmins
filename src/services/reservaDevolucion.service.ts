import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function eliminarDevolucionReserva(idDevolucion: number) {
  const { error } = await client()
    .from("reserva_devolucion")
    .delete()
    .eq("id_devolucion", idDevolucion);

  if (error) throw error;
}
