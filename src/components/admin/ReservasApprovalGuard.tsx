import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, X } from "lucide-react";
import ReservasAdmin from "./ReservasAdmin";
import { getReservas, updateReserva } from "../../services/api.service";
import { getMetodosPagoActivos } from "../../services/medioPago.service";

type ReservaLite = {
  id_reserva: number;
  codigo_reserva?: string | null;
  fecha_solicitud?: string | null;
  telefono_cliente: string;
  id_plan: number;
  aprobado?: boolean | null;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function parseMoney(value: string) {
  const normalized = value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.]/g, "");
  return Number(normalized || 0);
}

function labelMetodo(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ReservasApprovalGuard() {
  const [reservas, setReservas] = useState<ReservaLite[]>([]);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [selected, setSelected] = useState<ReservaLite | null>(null);
  const [valorAbonado, setValorAbonado] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getReservas(), getMetodosPagoActivos()])
      .then(([reservasData, metodosData]) => {
        setReservas(Array.isArray(reservasData) ? reservasData : []);
        setMetodosPago(Array.isArray(metodosData) ? metodosData : []);
      })
      .catch((e) => console.error("No se pudieron precargar los datos para aprobación", e));
  }, []);

  const reservaMap = useMemo(() => reservas, [reservas]);

  const identifyReservation = (button: HTMLElement): ReservaLite | null => {
    const row = button.closest("tr");
    if (!row) return null;

    const codigo = row.querySelector("td:first-child")?.textContent?.trim() ?? "";
    if (codigo) {
      const byCode = reservaMap.find(
        (r) => String(r.codigo_reserva ?? "").trim().toLowerCase() === codigo.toLowerCase()
      );
      if (byCode) return byCode;

      const legacyId = Number(codigo.replace(/\D/g, ""));
      if (codigo.startsWith("#") && legacyId) {
        const byId = reservaMap.find((r) => Number(r.id_reserva) === legacyId);
        if (byId) return byId;
      }
    }

    const phoneText = row.querySelector(".rv-phone")?.textContent ?? "";
    const phone = onlyDigits(phoneText);
    const candidates = reservaMap.filter(
      (r) => onlyDigits(r.telefono_cliente) === phone && !r.aprobado
    );

    return candidates.length === 1 ? candidates[0] : null;
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const button = target.closest("button.rv-switch") as HTMLElement | null;
    if (!button) return;

    const isApproved = button.getAttribute("aria-checked") === "true";
    if (isApproved) return;

    event.preventDefault();
    event.stopPropagation();

    const reserva = identifyReservation(button);
    if (!reserva) {
      alert("No se pudo identificar la reserva para aprobar. Actualiza la página e inténtalo nuevamente.");
      return;
    }

    setSelected(reserva);
    setValorAbonado("");
    setMetodoPago("");
    setError(null);
  };

  const closeModal = () => {
    if (saving) return;
    setSelected(null);
    setValorAbonado("");
    setMetodoPago("");
    setError(null);
  };

  const aprobarReserva = async () => {
    if (!selected) return;

    const valor = parseMoney(valorAbonado);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Ingresa un valor abonado mayor a $0.");
      return;
    }
    if (!metodoPago) {
      setError("Selecciona el método de pago del abono.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateReserva(selected.id_reserva, {
        aprobado: true,
        fecha_aprobacion: new Date().toISOString(),
        valor_abonado: valor,
        metodo_pago_abono: metodoPago,
      });

      setSelected(null);
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "No se pudo aprobar la reserva.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClickCapture={handleClickCapture}>
        <ReservasAdmin />
      </div>

      {selected && (
        <div className="rv-overlay" onClick={closeModal}>
          <div className="rv-modal rv-approval-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rv-modal-header rv-approval-header">
              <div>
                <span className="rv-approval-eyebrow">Confirmación de reserva</span>
                <h2>Aprobar reserva {selected.codigo_reserva || `#${selected.id_reserva}`}</h2>
                <p>Registra el abono recibido antes de confirmar la aprobación.</p>
              </div>
              <button className="rv-modal-close" onClick={closeModal} disabled={saving} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="rv-modal-body rv-approval-body">
              <div className="rv-approval-grid">
                <div className="rv-form-group">
                  <label>Valor abonado *</label>
                  <div className="rv-money-input-wrap">
                    <span>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={valorAbonado}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setValorAbonado(digits ? Number(digits).toLocaleString("es-CO") : "");
                        if (error) setError(null);
                      }}
                      placeholder="0"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="rv-form-group">
                  <label>Método de pago del abono *</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => {
                      setMetodoPago(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={saving}
                  >
                    <option value="">Seleccionar método de pago</option>
                    {metodosPago.map((metodo) => (
                      <option key={metodo} value={metodo}>{labelMetodo(metodo)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rv-approval-note">
                <div className="rv-approval-note-icon"><CreditCard size={18} /></div>
                <span>Al confirmar se guardarán el valor abonado, el método de pago y la fecha exacta de aprobación.</span>
              </div>

              {error && <div className="rv-approval-error">{error}</div>}
            </div>

            <div className="rv-modal-footer rv-approval-footer">
              <button className="rv-btn-cancel" onClick={closeModal} disabled={saving}>Cancelar</button>
              <button className="rv-btn-save rv-approval-save" onClick={aprobarReserva} disabled={saving}>
                <CheckCircle2 size={16} /> {saving ? "Aprobando..." : "Confirmar aprobación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
