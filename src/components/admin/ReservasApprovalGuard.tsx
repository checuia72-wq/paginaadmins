import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Settings2, Tag, X } from "lucide-react";
import ReservasAdmin from "./ReservasAdmin";
import { getReservas, updateReserva } from "../../services/api.service";
import { getMetodosPagoActivos } from "../../services/medioPago.service";
import { getRestaurantesActivos } from "../../services/restaurante.service";
import {
  aprobarReservaOperativa,
  codigosCompatibles,
  getCodigosOperativos,
  type CodigoOperativo,
} from "../../services/codigoOperativo.service";

type ReservaLite = {
  id_reserva: number;
  codigo_reserva?: string | null;
  fecha_solicitud?: string | null;
  telefono_cliente: string;
  id_plan: number;
  cantidad_personas?: number | null;
  aprobado?: boolean | null;
  precio_unitario?: number | null;
  valor_total?: number | null;
  refrigerio?: boolean | null;
  referencia_pago_abono?: string | null;
  observacion?: string | null;
  nombre_plan?: string | null;
};

type AdvancedOption = "" | "refrigerio" | "valor_total" | "valor_unitario";

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const parseMoney = (value: string) => Number(value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.]/g, "") || 0);
const formatMoney = (value: number | null | undefined) => Number(value || 0).toLocaleString("es-CO");
const labelMetodo = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ReservasApprovalGuard() {
  const [reservas, setReservas] = useState<ReservaLite[]>([]);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [restaurantes, setRestaurantes] = useState<string[]>([]);
  const [codigos, setCodigos] = useState<CodigoOperativo[]>([]);
  const [selected, setSelected] = useState<ReservaLite | null>(null);
  const [valorAbonado, setValorAbonado] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [referenciaPagoAbono, setReferenciaPagoAbono] = useState("");
  const [incluyeAlmuerzo, setIncluyeAlmuerzo] = useState(false);
  const [restaurante, setRestaurante] = useState("");
  const [codigoId, setCodigoId] = useState<number | "">("");
  const [advancedOption, setAdvancedOption] = useState<AdvancedOption>("");
  const [incluyeRefrigerio, setIncluyeRefrigerio] = useState(true);
  const [valorTotal, setValorTotal] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getReservas(), getMetodosPagoActivos(), getRestaurantesActivos(), getCodigosOperativos()])
      .then(([reservasData, metodosData, restaurantesData, codigosData]) => {
        setReservas(Array.isArray(reservasData) ? reservasData : []);
        setMetodosPago(Array.isArray(metodosData) ? metodosData : []);
        setRestaurantes(Array.isArray(restaurantesData) ? restaurantesData : []);
        setCodigos(codigosData);
      })
      .catch((e) => console.error("No se pudieron precargar los datos para aprobación", e));
  }, []);

  const opcionesCH = useMemo(
    () => selected ? codigosCompatibles(codigos, selected.id_plan, incluyeAlmuerzo, restaurante) : [],
    [codigos, selected, incluyeAlmuerzo, restaurante],
  );

  useEffect(() => {
    if (!selected) return;
    if (!opcionesCH.some(c => c.id_codigo_operativo === codigoId)) {
      setCodigoId(opcionesCH[0]?.id_codigo_operativo ?? "");
    }
  }, [opcionesCH, selected, codigoId]);

  const identifyReservation = (button: HTMLElement): ReservaLite | null => {
    const row = button.closest("tr");
    if (!row) return null;

    const codigo = row.querySelector("td:first-child")?.textContent?.trim() ?? "";
    if (codigo) {
      const byCode = reservas.find((r) => String(r.codigo_reserva ?? "").trim().toLowerCase() === codigo.toLowerCase());
      if (byCode) return byCode;

      const legacyId = Number(codigo.replace(/\D/g, ""));
      if (codigo.startsWith("#") && legacyId) {
        const byId = reservas.find((r) => Number(r.id_reserva) === legacyId);
        if (byId) return byId;
      }
    }

    const phone = onlyDigits(row.querySelector(".rv-phone")?.textContent ?? "");
    const candidates = reservas.filter((r) => onlyDigits(r.telefono_cliente) === phone && !r.aprobado);
    return candidates.length === 1 ? candidates[0] : null;
  };

  const handleClickCapture = async (event: React.MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest("button.rv-switch") as HTMLElement | null;
    if (!button || button.getAttribute("aria-checked") === "true") return;

    event.preventDefault();
    event.stopPropagation();

    const reservaBase = identifyReservation(button);
    if (!reservaBase) {
      alert("No se pudo identificar la reserva para aprobar. Actualiza la página e inténtalo nuevamente.");
      return;
    }

    let reserva = reservaBase;
    try {
      const latestData = await getReservas();
      const latestReservas: ReservaLite[] = Array.isArray(latestData) ? latestData : [];
      setReservas(latestReservas);
      reserva = latestReservas.find((r) => Number(r.id_reserva) === Number(reservaBase.id_reserva)) ?? reservaBase;
    } catch (refreshError) {
      console.error("No se pudo refrescar la reserva antes de aprobar", refreshError);
    }

    const cantidad = Math.max(1, Number(reserva.cantidad_personas || 1));
    const total = Number(reserva.valor_total || 0);
    const unitario = Number(reserva.precio_unitario || (total > 0 ? total / cantidad : 0));

    setSelected(reserva);
    setValorAbonado("");
    setMetodoPago("");
    setReferenciaPagoAbono("");
    setIncluyeAlmuerzo(false);
    setRestaurante("");
    setCodigoId("");
    setAdvancedOption("");
    setIncluyeRefrigerio(true);
    setValorTotal(formatMoney(total));
    setValorUnitario(formatMoney(unitario));
    setObservacion(String(reserva.observacion ?? ""));
    setError(null);
  };

  const closeModal = () => {
    if (!saving) setSelected(null);
  };

  const aprobarReserva = async () => {
    if (!selected) return;

    const valor = parseMoney(valorAbonado);
    const referencia = referenciaPagoAbono.trim().toUpperCase();
    const cantidad = Math.max(1, Number(selected.cantidad_personas || 1));
    const totalOriginal = Number(selected.valor_total || 0);
    const unitarioOriginal = Number(selected.precio_unitario || (totalOriginal > 0 ? totalOriginal / cantidad : 0));

    let totalNuevo = totalOriginal;
    let unitarioNuevo = unitarioOriginal;

    if (advancedOption === "valor_total") {
      totalNuevo = parseMoney(valorTotal);
      unitarioNuevo = totalNuevo / cantidad;
    } else if (advancedOption === "valor_unitario") {
      unitarioNuevo = parseMoney(valorUnitario);
      totalNuevo = unitarioNuevo * cantidad;
    }

    const totalFueEditado = Math.abs(totalNuevo - totalOriginal) > 0.01;
    const unitarioFueEditado = Math.abs(unitarioNuevo - unitarioOriginal) > 0.01;
    const ajusteMonetario = totalFueEditado || unitarioFueEditado;

    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Ingresa un valor abonado mayor a $0.");
      return;
    }
    if (!metodoPago) {
      setError("Selecciona el método de pago del abono.");
      return;
    }
    if (!/^[A-Z0-9]{4}$/.test(referencia)) {
      setError("Ingresa los últimos 4 caracteres de la referencia del pago del abono.");
      return;
    }
    if (!Number.isFinite(totalNuevo) || totalNuevo <= 0) {
      setError("El valor total de la reserva debe ser mayor a $0.");
      return;
    }
    if (!Number.isFinite(unitarioNuevo) || unitarioNuevo <= 0) {
      setError("El valor unitario debe ser mayor a $0.");
      return;
    }
    if (valor > totalNuevo) {
      setError("El valor abonado no puede superar el valor total de la reserva.");
      return;
    }
    if (ajusteMonetario && !observacion.trim()) {
      setError("Debes registrar una observación explicando el cambio de valor de la reserva.");
      return;
    }
    if (incluyeAlmuerzo && !restaurante) {
      setError("Selecciona el restaurante para la reserva con almuerzo.");
      return;
    }
    if (!codigoId) {
      setError("No existe un CH configurado para este plan y esta combinación. Vincúlalo primero en Códigos operativos.");
      return;
    }

    setSaving(true);
    setError(null);

    let reservaActualizada = false;
    try {
      const patch: Record<string, unknown> = {
        refrigerio: incluyeRefrigerio,
        referencia_pago_abono: referencia,
      };

      if (ajusteMonetario) {
        patch.valor_total = totalNuevo;
        patch.precio_unitario = unitarioNuevo;
        patch.observacion = observacion.trim();
      }

      await updateReserva(selected.id_reserva, patch);
      reservaActualizada = true;

      await aprobarReservaOperativa({
        id_reserva: selected.id_reserva,
        valor_abonado: valor,
        metodo_pago: metodoPago,
        incluye_almuerzo: incluyeAlmuerzo,
        restaurante: incluyeAlmuerzo ? restaurante : null,
        id_codigo_operativo: Number(codigoId),
      });

      setSelected(null);
      window.location.reload();
    } catch (e: any) {
      console.error(e);

      if (reservaActualizada) {
        try {
          await updateReserva(selected.id_reserva, {
            valor_total: totalOriginal,
            precio_unitario: unitarioOriginal,
            refrigerio: selected.refrigerio ?? false,
            referencia_pago_abono: selected.referencia_pago_abono ?? null,
            observacion: selected.observacion ?? null,
          });
        } catch (rollbackError) {
          console.error("No se pudo revertir la configuración temporal de la reserva:", rollbackError);
        }
      }

      setError(e?.message || "No se pudo aprobar la reserva.");
    } finally {
      setSaving(false);
    }
  };

  const cantidadSeleccionada = Math.max(1, Number(selected?.cantidad_personas || 1));
  const totalVista = advancedOption === "valor_unitario"
    ? parseMoney(valorUnitario) * cantidadSeleccionada
    : advancedOption === "valor_total"
      ? parseMoney(valorTotal)
      : Number(selected?.valor_total || 0);
  const unitarioVista = advancedOption === "valor_total"
    ? totalVista / cantidadSeleccionada
    : advancedOption === "valor_unitario"
      ? parseMoney(valorUnitario)
      : Number(selected?.precio_unitario || (totalVista > 0 ? totalVista / cantidadSeleccionada : 0));

  return <>
    <div onClickCapture={handleClickCapture}><ReservasAdmin /></div>

    {selected && (
      <div className="rv-overlay">
        <div className="rv-modal rv-approval-modal" onClick={(e) => e.stopPropagation()}>
          <div className="rv-modal-header rv-approval-header">
            <div>
              <span className="rv-approval-eyebrow">Confirmación de reserva</span>
              <h2>Aprobar reserva {selected.codigo_reserva || `#${selected.id_reserva}`}</h2>
              <p>Registra el abono y define la configuración operativa antes de confirmar.</p>
            </div>
            <button className="rv-modal-close" onClick={closeModal} disabled={saving}><X size={20}/></button>
          </div>

          <div className="rv-modal-body rv-approval-body">
            <div
              style={{
                display: "grid",
                gap: 12,
                marginBottom: 16,
                padding: 16,
                border: "1px solid #ead9bf",
                borderRadius: 14,
                background: "#fffaf2",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#8c7a64", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>Valor total de la reserva</div>
                  <strong style={{ display: "block", marginTop: 4, fontSize: 24, color: "#2d241a" }}>
                    ${formatMoney(totalVista)}
                  </strong>
                  <span style={{ display: "block", marginTop: 3, color: "#756654", fontSize: 13 }}>
                    ${formatMoney(unitarioVista)} por persona · {cantidadSeleccionada} {cantidadSeleccionada === 1 ? "persona" : "personas"}
                  </span>
                  {selected.nombre_plan && <span style={{ display: "block", marginTop: 3, color: "#756654", fontSize: 13 }}>{selected.nombre_plan}</span>}
                </div>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  padding: "7px 10px",
                  background: incluyeRefrigerio ? "#edf8ef" : "#f3f1ed",
                  color: incluyeRefrigerio ? "#2f6f45" : "#766d63",
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {incluyeRefrigerio ? "Refrigerio incluido" : "Sin refrigerio"}
                </span>
              </div>

              <div style={{ borderTop: "1px solid #eadfce", paddingTop: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7, color: "#6e604f", fontSize: 12, fontWeight: 700 }}>
                  <Settings2 size={15}/> Opciones avanzadas
                </label>
                <select
                  value={advancedOption}
                  onChange={(e) => {
                    const option = e.target.value as AdvancedOption;
                    setAdvancedOption(option);
                    setValorTotal(formatMoney(selected.valor_total));
                    setValorUnitario(formatMoney(selected.precio_unitario || (Number(selected.valor_total || 0) / cantidadSeleccionada)));
                    setObservacion(String(selected.observacion ?? ""));
                    setError(null);
                  }}
                  disabled={saving}
                  style={{ width: "100%" }}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="refrigerio">Refrigerio</option>
                  <option value="valor_total">Cambiar valor total</option>
                  <option value="valor_unitario">Cambiar valor unitario</option>
                </select>
              </div>

              {advancedOption === "refrigerio" && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: 12,
                  border: "1px solid #e7dac6",
                  borderRadius: 12,
                  background: "#fff",
                }}>
                  <div>
                    <strong style={{ display: "block", color: "#3b3127", fontSize: 14 }}>Incluir refrigerio</strong>
                    <small style={{ color: "#877967", lineHeight: 1.4 }}>
                      Al aprobar una reserva se incluye refrigerio por defecto. Desmárcalo únicamente si esta reserva no lo tendrá.
                    </small>
                  </div>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={incluyeRefrigerio}
                      onChange={(e) => { setIncluyeRefrigerio(e.target.checked); setError(null); }}
                      disabled={saving}
                    />
                    {incluyeRefrigerio ? "Sí" : "No"}
                  </label>
                </div>
              )}

              {advancedOption === "valor_total" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div className="rv-form-group">
                    <label>Nuevo valor total *</label>
                    <div className="rv-money-input-wrap">
                      <span>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={valorTotal}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setValorTotal(digits ? Number(digits).toLocaleString("es-CO") : "");
                          setError(null);
                        }}
                        placeholder="0"
                        disabled={saving}
                      />
                    </div>
                    <small style={{ color: "#877967", lineHeight: 1.4 }}>
                      El valor unitario se recalculará automáticamente a ${formatMoney(totalVista / cantidadSeleccionada)}.
                    </small>
                  </div>

                  <div className="rv-form-group">
                    <label>Observación del cambio *</label>
                    <textarea
                      value={observacion}
                      onChange={(e) => { setObservacion(e.target.value); setError(null); }}
                      placeholder="Ej. Tarifa especial, descuento autorizado o ajuste operativo."
                      rows={3}
                      disabled={saving}
                      style={{ resize: "vertical", minHeight: 82 }}
                    />
                  </div>
                </div>
              )}

              {advancedOption === "valor_unitario" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div className="rv-form-group">
                    <label>Nuevo valor unitario *</label>
                    <div className="rv-money-input-wrap">
                      <span>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={valorUnitario}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setValorUnitario(digits ? Number(digits).toLocaleString("es-CO") : "");
                          setError(null);
                        }}
                        placeholder="0"
                        disabled={saving}
                      />
                    </div>
                    <small style={{ color: "#877967", lineHeight: 1.4 }}>
                      El total se recalculará automáticamente: {cantidadSeleccionada} × ${formatMoney(unitarioVista)} = ${formatMoney(totalVista)}.
                    </small>
                  </div>

                  <div className="rv-form-group">
                    <label>Observación del cambio *</label>
                    <textarea
                      value={observacion}
                      onChange={(e) => { setObservacion(e.target.value); setError(null); }}
                      placeholder="Ej. Tarifa especial, descuento autorizado o ajuste operativo."
                      rows={3}
                      disabled={saving}
                      style={{ resize: "vertical", minHeight: 82 }}
                    />
                  </div>
                </div>
              )}
            </div>

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
                      setError(null);
                    }}
                    placeholder="0"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="rv-form-group">
                <label>Método de pago del abono *</label>
                <select value={metodoPago} onChange={(e) => { setMetodoPago(e.target.value); setError(null); }} disabled={saving}>
                  <option value="">Seleccionar método de pago</option>
                  {metodosPago.map((m) => <option key={m} value={m}>{labelMetodo(m)}</option>)}
                </select>
              </div>

              <div className="rv-form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Referencia pago abono *</label>
                <input
                  type="text"
                  value={referenciaPagoAbono}
                  maxLength={4}
                  autoComplete="off"
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
                    setReferenciaPagoAbono(clean);
                    setError(null);
                  }}
                  placeholder="Últimos 4 caracteres · Ej. A7F3"
                  disabled={saving}
                  style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}
                />
                <small style={{ color: "#877967", lineHeight: 1.4 }}>
                  Ingresa únicamente los últimos 4 caracteres de la referencia o comprobante del abono.
                </small>
              </div>
            </div>

            <div className="rv-approval-note" style={{ marginTop: 14 }}>
              <div className="rv-approval-note-icon"><Tag size={18}/></div>
              <span>El CH se calcula según el plan, si incluye almuerzo y el restaurante seleccionado. Puedes cambiar el CH entre las opciones válidas.</span>
            </div>

            <div className="rv-approval-grid" style={{ marginTop: 14 }}>
              <div className="rv-form-group">
                <label>¿Incluye almuerzo?</label>
                <select
                  value={incluyeAlmuerzo ? "si" : "no"}
                  onChange={(e) => {
                    const value = e.target.value === "si";
                    setIncluyeAlmuerzo(value);
                    if (!value) setRestaurante("");
                    setError(null);
                  }}
                >
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </div>

              <div className="rv-form-group">
                <label>Restaurante {incluyeAlmuerzo ? "*" : ""}</label>
                <select disabled={!incluyeAlmuerzo} value={restaurante} onChange={(e) => { setRestaurante(e.target.value); setError(null); }}>
                  <option value="">Seleccionar restaurante</option>
                  {restaurantes.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="rv-form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Código CH *</label>
                <select value={codigoId} onChange={(e) => setCodigoId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Sin CH compatible</option>
                  {opcionesCH.map((c) => <option key={c.id_codigo_operativo} value={c.id_codigo_operativo}>{c.codigo_ch} — {c.descripcion}</option>)}
                </select>
              </div>
            </div>

            <div className="rv-approval-note">
              <div className="rv-approval-note-icon"><CreditCard size={18}/></div>
              <span>Al confirmar, Supabase generará el consecutivo libre del CH para el mes de la fecha reservada y evitará códigos duplicados.</span>
            </div>

            {error && <div className="rv-approval-error">{error}</div>}
          </div>

          <div className="rv-modal-footer rv-approval-footer">
            <button className="rv-btn-cancel" onClick={closeModal} disabled={saving}>Cancelar</button>
            <button className="rv-btn-save rv-approval-save" onClick={aprobarReserva} disabled={saving}>
              <CheckCircle2 size={16}/>{saving ? "Aprobando..." : "Confirmar aprobación"}
            </button>
          </div>
        </div>
      </div>
    )}
  </>;
}
