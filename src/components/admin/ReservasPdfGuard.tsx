import { useEffect, useRef } from "react";
import ReservasApprovalGuard from "./ReservasApprovalGuard";
import { getReservas } from "../../services/api.service";

type ReservaPdf = {
  id_reserva: number;
  codigo_reserva?: string | null;
  aprobado?: boolean | null;
};

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const PDF_BUCKET = "reservas-pdf";

function getReservaFromRow(row: HTMLTableRowElement, reservas: ReservaPdf[]) {
  const codigo = row.querySelector("td:first-child")?.textContent?.trim() ?? "";
  if (!codigo) return null;

  const byCode = reservas.find(
    (r) => String(r.codigo_reserva ?? "").trim().toLowerCase() === codigo.toLowerCase(),
  );
  if (byCode) return byCode;

  if (codigo.startsWith("#")) {
    const id = Number(codigo.replace(/\D/g, ""));
    if (id) return reservas.find((r) => Number(r.id_reserva) === id) ?? null;
  }

  return null;
}

async function downloadReservaPdf(reserva: ReservaPdf) {
  if (!reserva.aprobado) {
    alert("No se puede descargar el PDF hasta que la reserva haya sido aprobada.");
    return;
  }

  if (!supabaseUrl) {
    alert("No se pudo consultar el PDF porque Supabase no está configurado.");
    return;
  }

  // Convención usada para asociar el PDF directamente con la reserva.
  const objectName = `Reserva_${reserva.id_reserva}.pdf`;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${PDF_BUCKET}/${encodeURIComponent(objectName)}`;

  try {
    const response = await fetch(publicUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`PDF no disponible (${response.status})`);

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `Confirmacion_${reserva.codigo_reserva || reserva.id_reserva}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    console.warn("No se encontró el PDF de la reserva", reserva.id_reserva, error);
    alert(
      "El PDF de esta reserva ya no está disponible. Para volver a generarlo, desaprueba la reserva y vuelve a aprobarla.",
    );
  }
}

export default function ReservasPdfGuard() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    const cleanups: Array<() => void> = [];

    const setup = async () => {
      try {
        const data = await getReservas();
        if (cancelled) return;
        const reservas = (Array.isArray(data) ? data : []) as ReservaPdf[];

        const decorateRows = () => {
          const root = rootRef.current;
          if (!root) return;

          root.querySelectorAll<HTMLTableRowElement>(".rv-table tbody tr").forEach((row) => {
            const actions = row.querySelector<HTMLElement>(".action-buttons");
            if (!actions || actions.querySelector("[data-reserva-pdf]")) return;

            const reserva = getReservaFromRow(row, reservas);
            if (!reserva) return;

            const button = document.createElement("button");
            button.type = "button";
            button.className = "action-btn action-ver";
            button.dataset.reservaPdf = String(reserva.id_reserva);
            button.textContent = "PDF";
            button.title = reserva.aprobado
              ? "Descargar PDF de confirmación"
              : "Disponible después de aprobar la reserva";

            const onClick = (event: Event) => {
              event.preventDefault();
              event.stopPropagation();
              void downloadReservaPdf(reserva);
            };

            button.addEventListener("click", onClick);
            cleanups.push(() => button.removeEventListener("click", onClick));
            actions.insertBefore(button, actions.firstChild);
          });
        };

        decorateRows();
        observer = new MutationObserver(decorateRows);
        observer.observe(rootRef.current!, { childList: true, subtree: true });
      } catch (error) {
        console.error("No se pudo preparar la descarga de PDFs de reservas", error);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      observer?.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  return (
    <div ref={rootRef}>
      <ReservasApprovalGuard />
    </div>
  );
}
