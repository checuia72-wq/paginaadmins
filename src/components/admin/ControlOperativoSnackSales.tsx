import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { ShoppingBasket } from "lucide-react";
import { getSnackSalesByDate, type SnackSale } from "../../services/snack.service";
import "../../styles/snacks.css";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;
const todayBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const timeBogota = (value: string) => new Date(value).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });

function getDateFilter() {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>(".op-filters label"));
  const label = labels.find((item) => item.querySelector("span")?.textContent?.trim().toLowerCase() === "fecha reserva");
  return label?.querySelector<HTMLInputElement>('input[type="date"]') ?? null;
}

export default function ControlOperativoSnackSales() {
  const location = useLocation();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [fecha, setFecha] = useState(todayBogota());
  const [sales, setSales] = useState<SnackSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!location.pathname.includes("/app/control-operativo")) {
      setHost(null);
      return;
    }

    let boundInput: HTMLInputElement | null = null;
    let cleanupInput = () => {};

    const detect = () => {
      const summary = document.querySelector<HTMLElement>(".op-summary");
      if (!summary?.parentElement) return;

      let currentHost = document.querySelector<HTMLDivElement>("#op-snack-sales-host");
      if (!currentHost) {
        currentHost = document.createElement("div");
        currentHost.id = "op-snack-sales-host";
        summary.insertAdjacentElement("afterend", currentHost);
      }
      setHost(currentHost);

      const input = getDateFilter();
      if (input && input !== boundInput) {
        cleanupInput();
        boundInput = input;
        const sync = () => setFecha(input.value || todayBogota());
        input.addEventListener("input", sync);
        input.addEventListener("change", sync);
        cleanupInput = () => {
          input.removeEventListener("input", sync);
          input.removeEventListener("change", sync);
        };
        sync();
      }
    };

    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cleanupInput();
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!host || !fecha) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getSnackSalesByDate(fecha);
        if (active) setSales(data);
      } catch (e: any) {
        if (active) setError(e?.message || "No fue posible cargar las ventas de snacks del día.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const interval = window.setInterval(load, 120000);
    const saleHandler = () => void load();
    window.addEventListener("snack-sale-recorded", saleHandler);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("snack-sale-recorded", saleHandler);
    };
  }, [host, fecha]);

  const total = useMemo(() => sales.reduce((sum, sale) => sum + sale.total, 0), [sales]);
  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of sales) map.set(sale.medio_pago, (map.get(sale.medio_pago) ?? 0) + sale.total);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [sales]);

  if (!host) return null;

  return createPortal(
    <section className="op-snack-sales-card">
      <div className="op-snack-sales-head">
        <div className="op-snack-sales-title"><ShoppingBasket size={18} /><div><strong>Ventas de snacks · {fecha}</strong><small>Se actualiza automáticamente y usa el mismo día filtrado en Control Operativo.</small></div></div>
        <div className="op-snack-sales-total"><span>Total snacks</span><b>{money(total)}</b></div>
      </div>

      {error ? <div className="snack-alert error">{error}</div> : loading && !sales.length ? <div className="op-snack-empty">Cargando ventas de snacks…</div> : sales.length === 0 ? <div className="op-snack-empty">No hay ventas de snacks registradas para este día.</div> : (
        <>
          <div className="op-snack-methods">{byMethod.map(([method, value]) => <span key={method}>{method}: <b>{money(value)}</b></span>)}</div>
          <div className="op-snack-table-wrap">
            <table className="op-snack-table">
              <thead><tr><th>Hora</th><th>Productos vendidos</th><th>Método de pago</th><th>Vendedor</th><th>Total</th></tr></thead>
              <tbody>{sales.map((sale) => <tr key={sale.id_venta}><td>{timeBogota(sale.fecha_venta)}</td><td>{sale.items.map((item) => `${item.cantidad}× ${item.nombre_producto}`).join(", ")}</td><td>{sale.medio_pago}</td><td>{sale.vendedor_email || "—"}</td><td><strong>{money(sale.total)}</strong></td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </section>,
    host,
  );
}
