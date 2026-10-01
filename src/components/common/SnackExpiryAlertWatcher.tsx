import { useEffect } from "react";
import { getSnackExpiryLots, snackLocationLabel } from "../../services/snack.service";
import { getCurrentRole } from "../../services/role.service";

const ALERT_WINDOW_DAYS = 20;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function daysUntil(dateValue: string) {
  const [year, month, day] = dateValue.slice(0, 10).split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target - today) / 86400000);
}

export default function SnackExpiryAlertWatcher() {
  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const current = await getCurrentRole();
        if (!active || current?.role !== "coordinador") return;

        const lots = await getSnackExpiryLots();
        if (!active) return;

        const alerts = lots
          .map((lot) => ({ ...lot, days: daysUntil(lot.fecha_vencimiento) }))
          .filter((lot) => lot.days <= ALERT_WINDOW_DAYS)
          .sort((a, b) => a.days - b.days);

        if (!alerts.length) return;

        const today = new Date().toISOString().slice(0, 10);
        const signature = alerts.map((lot) => `${lot.id_lote_vencimiento}:${lot.cantidad_actual}:${lot.fecha_vencimiento}`).join("|");
        const storageKey = `checua:snack-expiry-alert:${today}:${signature}`;
        if (sessionStorage.getItem(storageKey)) return;
        sessionStorage.setItem(storageKey, "1");

        const units = alerts.reduce((sum, lot) => sum + lot.cantidad_actual, 0);
        const preview = alerts.slice(0, 4).map((lot) => {
          const status = lot.days < 0
            ? `vencido hace ${Math.abs(lot.days)} día${Math.abs(lot.days) === 1 ? "" : "s"}`
            : lot.days === 0
              ? "vence hoy"
              : `vence en ${lot.days} día${lot.days === 1 ? "" : "s"}`;
          return `${lot.nombre_producto}: ${lot.cantidad_actual} unidad${lot.cantidad_actual === 1 ? "" : "es"} en ${snackLocationLabel(lot.codigo_ubicacion)} (${status})`;
        });

        const extra = alerts.length > 4 ? `\nY ${alerts.length - 4} lote${alerts.length - 4 === 1 ? "" : "s"} adicional${alerts.length - 4 === 1 ? "" : "es"}.` : "";
        window.alert(`Atención: hay ${units} unidad${units === 1 ? "" : "es"} de snacks próximas a vencer o vencidas.\n\n${preview.join("\n")}${extra}\n\nRevisa Inventarios snacks para ver el detalle.`);
      } catch {
        // La alerta no debe bloquear el resto de la aplicación si el esquema aún no fue instalado.
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    window.addEventListener("focus", check);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, []);

  return null;
}
