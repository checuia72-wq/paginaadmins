import { useMemo } from "react";
import { WalletCards, X } from "lucide-react";
import type { DashboardDevolucion, DashboardPago, DashboardPlan, DashboardReserva } from "../../services/dashboardAnalytics.service";
import "../../styles/cartera-pendiente-modal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  reservas: DashboardReserva[];
  planes: DashboardPlan[];
  pagos: DashboardPago[];
  devoluciones: DashboardDevolucion[];
};

const money = (value: number) => `$${Math.round(value || 0).toLocaleString("es-CO")}`;

function totalReserva(r: DashboardReserva, planes: DashboardPlan[]) {
  const total = Number(r.valor_total || 0);
  if (total > 0) return total;
  const cantidad = Math.max(1, Number(r.cantidad_personas || 1));
  const unitario = Number(r.precio_unitario || 0);
  if (unitario > 0) return unitario * cantidad;
  const precioPlan = Number(r.plan?.precio_plan || planes.find((p) => p.id_plan === r.id_plan)?.precio_plan || 0);
  return precioPlan * cantidad;
}

function planName(r: DashboardReserva, planes: DashboardPlan[]) {
  return r.plan?.nombre_plan || planes.find((p) => p.id_plan === r.id_plan)?.nombre_plan || `Plan #${r.id_plan ?? "—"}`;
}

export default function CarteraPendienteModal({ open, onClose, reservas, planes, pagos, devoluciones }: Props) {
  const rows = useMemo(() => {
    const pagosPorReserva = new Map<number, DashboardPago[]>();
    for (const pago of pagos) {
      if (!pagosPorReserva.has(pago.id_reserva)) pagosPorReserva.set(pago.id_reserva, []);
      pagosPorReserva.get(pago.id_reserva)!.push(pago);
    }

    const devolucionesPorReserva = new Map<number, number>();
    for (const devolucion of devoluciones) {
      devolucionesPorReserva.set(devolucion.id_reserva, (devolucionesPorReserva.get(devolucion.id_reserva) || 0) + Number(devolucion.monto || 0));
    }

    return reservas
      .filter((r) => r.aprobado === true && r.estado_operativo !== "cancelada")
      .map((r) => {
        const total = totalReserva(r, planes);
        const abono = Number(r.valor_abonado || 0);
        const saldoMovimientos = (pagosPorReserva.get(r.id_reserva) || []).filter((p) => p.tipo_pago === "saldo");
        const saldoPagado = saldoMovimientos.length
          ? saldoMovimientos.reduce((sum, pago) => sum + Number(pago.monto || 0), 0)
          : Number(r.valor_saldo_pagado || 0);
        const devuelto = devolucionesPorReserva.get(r.id_reserva) || 0;
        const pagadoNeto = Math.max(0, abono + saldoPagado - devuelto);
        const pendiente = Math.max(0, total - pagadoNeto);

        return {
          id: r.id_reserva,
          codigo: r.codigo_reserva || `#${r.id_reserva}`,
          telefono: r.telefono_cliente || "—",
          plan: planName(r, planes),
          fecha: r.fecha_reserva || "—",
          total,
          pagado: pagadoNeto,
          pendiente,
        };
      })
      .filter((row) => row.pendiente > 0.5)
      .sort((a, b) => b.pendiente - a.pendiente);
  }, [reservas, planes, pagos, devoluciones]);

  const totalPendiente = rows.reduce((sum, row) => sum + row.pendiente, 0);

  if (!open) return null;

  return (
    <div className="cartera-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="cartera-modal" role="dialog" aria-modal="true" aria-labelledby="cartera-modal-title">
        <header className="cartera-modal-head">
          <div className="cartera-modal-icon"><WalletCards size={22} /></div>
          <div>
            <span>Detalle de cartera</span>
            <h2 id="cartera-modal-title">Reservas con saldo pendiente</h2>
            <p>{rows.length} {rows.length === 1 ? "reserva pendiente" : "reservas pendientes"} en el periodo seleccionado.</p>
          </div>
          <button type="button" className="cartera-modal-close" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
        </header>

        <div className="cartera-modal-summary">
          <div><span>Cartera total</span><strong>{money(totalPendiente)}</strong></div>
          <div><span>Reservas por cobrar</span><strong>{rows.length}</strong></div>
        </div>

        <div className="cartera-modal-table-wrap">
          {rows.length === 0 ? (
            <div className="cartera-modal-empty">No hay reservas con saldo pendiente en este periodo.</div>
          ) : (
            <table className="cartera-modal-table">
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Plan</th>
                  <th>Fecha visita</th>
                  <th>Contacto</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.codigo}</strong></td>
                    <td className="cartera-plan-cell">{row.plan}</td>
                    <td>{row.fecha}</td>
                    <td>{row.telefono}</td>
                    <td>{money(row.total)}</td>
                    <td>{money(row.pagado)}</td>
                    <td className="cartera-pending-cell">{money(row.pendiente)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>Total cartera pendiente</td>
                  <td>{money(totalPendiente)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}