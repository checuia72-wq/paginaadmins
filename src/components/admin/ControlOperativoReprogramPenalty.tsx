import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { CalendarClock, CircleDollarSign } from "lucide-react";
import {
  getControlOperativo,
  reprogramarReservaOperativa,
  updateControlReserva,
  type ControlOperativoRow,
} from "../../services/controlOperativo.service";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;
const hk = (value: string) => String(value || "").slice(0, 5);

function getReprogramSection(modal: HTMLElement) {
  return Array.from(modal.querySelectorAll<HTMLElement>(".op-management-section")).find((section) => {
    const title = section.querySelector(".op-section-title strong")?.textContent?.trim().toLowerCase() ?? "";
    return title.includes("reprogramar reserva");
  }) ?? null;
}

function getReservaCode(modal: HTMLElement) {
  const labels = Array.from(modal.querySelectorAll<HTMLLabelElement>(".op-edit-grid label"));
  const codeLabel = labels.find((label) => label.textContent?.trim().toLowerCase().startsWith("código actual"));
  const input = codeLabel?.querySelector<HTMLInputElement>("input");
  if (input?.value) return input.value.trim();
  const text = modal.querySelector(".op-modal-head p")?.textContent ?? "";
  return text.match(/CH\d+/i)?.[0] ?? "";
}

function findLabel(section: HTMLElement, prefix: string) {
  return Array.from(section.querySelectorAll<HTMLLabelElement>("label")).find((label) =>
    (label.textContent ?? "").trim().toLowerCase().startsWith(prefix.toLowerCase()),
  ) ?? null;
}

function readReprogramFields(section: HTMLElement) {
  const dateLabel = findLabel(section, "nueva fecha");
  const hourLabel = findLabel(section, "nueva hora");
  const motiveLabel = findLabel(section, "motivo de reprogramación");

  const dateControl = dateLabel?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select") ?? null;
  const hourControl = hourLabel?.querySelector<HTMLSelectElement>("select") ?? null;
  const motiveControl = motiveLabel?.querySelector<HTMLInputElement>("input") ?? null;

  const fecha = String(dateControl?.value ?? "").slice(0, 10);
  const idHora = hourControl?.value ? Number(hourControl.value) : null;
  const horaTexto = hourControl?.value
    ? hk(hourControl.selectedOptions?.[0]?.textContent ?? "")
    : "";

  return {
    fecha,
    idHora: Number.isFinite(idHora as number) ? idHora : null,
    horaTexto,
    motivo: motiveControl?.value.trim() ?? "",
    horaObligatoria: Boolean(hourControl && !hourControl.disabled && hourControl.options.length > 1),
  };
}

function setTotalInput(modal: HTMLElement, total: number) {
  const labels = Array.from(modal.querySelectorAll<HTMLLabelElement>(".op-edit-grid label"));
  const totalLabel = labels.find((label) => {
    const clone = label.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input,select,textarea").forEach((node) => node.remove());
    return clone.textContent?.trim().toLowerCase() === "total";
  });
  const input = totalLabel?.querySelector<HTMLInputElement>("input");
  if (!input) return;

  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, String(total));
  else input.value = String(total);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function ControlOperativoReprogramPenalty() {
  const location = useLocation();
  const [modal, setModal] = useState<HTMLElement | null>(null);
  const [section, setSection] = useState<HTMLElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [reserva, setReserva] = useState<ControlOperativoRow | null>(null);
  const [penalidad, setPenalidad] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!location.pathname.includes("/app/control-operativo")) {
      setModal(null);
      setSection(null);
      setHost(null);
      return;
    }

    const detect = () => {
      const currentModal = document.querySelector<HTMLElement>(".op-modal.edit-modal");
      if (!currentModal) {
        setModal(null);
        setSection(null);
        setHost(null);
        setReserva(null);
        setPenalidad("");
        setError("");
        setSuccess("");
        return;
      }

      const currentSection = getReprogramSection(currentModal);
      if (!currentSection) return;

      const originalButton = currentSection.querySelector<HTMLButtonElement>("button.op-action-btn");
      if (originalButton) {
        originalButton.style.display = "none";
        originalButton.dataset.reprogramReplaced = "true";
      }

      let currentHost = currentSection.querySelector<HTMLDivElement>("#op-reprogram-penalty-host");
      if (!currentHost) {
        currentHost = document.createElement("div");
        currentHost.id = "op-reprogram-penalty-host";
        currentSection.appendChild(currentHost);
      }

      setModal(currentModal);
      setSection(currentSection);
      setHost(currentHost);
    };

    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    if (!modal || !section) return;
    const codigo = getReservaCode(modal);
    if (!codigo) return;

    let active = true;
    setLoading(true);
    setError("");
    setSuccess("");
    setPenalidad("");

    getControlOperativo()
      .then((rows) => {
        if (!active) return;
        const row = rows.find((item) => item.reserva_codigo === codigo);
        if (!row) throw new Error("No fue posible cargar la reserva para reprogramarla.");
        setReserva(row);
      })
      .catch((e: any) => active && setError(e?.message || "No fue posible cargar la reserva."))
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [modal, section]);

  const valorPenalidad = useMemo(() => Number(penalidad || 0), [penalidad]);
  const nuevoTotal = useMemo(
    () => Math.max(0, Number(reserva?.total || 0) + (Number.isFinite(valorPenalidad) ? valorPenalidad : 0)),
    [reserva?.total, valorPenalidad],
  );
  const pagado = Number(reserva?.abono || 0) + Number(reserva?.pago_saldo || 0);
  const nuevoPendiente = Math.max(0, nuevoTotal - pagado);

  const saveReprogram = async () => {
    if (!modal || !section || !reserva || saving) return;
    const fields = readReprogramFields(section);

    if (!fields.fecha) {
      setError("Selecciona la nueva fecha de la reserva.");
      return;
    }
    if (fields.horaObligatoria && !fields.idHora) {
      setError("Selecciona la nueva hora de la reserva.");
      return;
    }
    if (!Number.isFinite(valorPenalidad) || valorPenalidad < 0) {
      setError("La penalidad debe ser un valor válido igual o mayor a $0.");
      return;
    }
    if (reserva.id_plan == null) {
      setError("La reserva no tiene un plan válido para reprogramar.");
      return;
    }

    const horaConfirmacion = fields.horaTexto || "00:00";
    const fechaReserva = `${fields.fecha}T${horaConfirmacion}:00`;
    const detalleBase = `Reprogramación a ${fields.fecha}${fields.horaTexto ? ` ${fields.horaTexto}` : ""}. Penalidad: ${money(valorPenalidad)}. Nuevo valor total: ${money(nuevoTotal)}.`;
    const detalleHistorial = fields.motivo ? `${detalleBase} ${fields.motivo}` : detalleBase;
    const observacionAnterior = String(reserva.observacion || "").trim();
    const observacionNueva = observacionAnterior ? `${observacionAnterior} | ${detalleBase}` : detalleBase;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const idFecha = await reprogramarReservaOperativa({
        id_reserva: reserva.id_reserva,
        id_plan: reserva.id_plan,
        fecha: fields.fecha,
        id_hora: fields.idHora,
        motivo: detalleHistorial,
      });

      await updateControlReserva(reserva.id_reserva, {
        id_fecha: idFecha,
        id_hora: fields.idHora,
        fecha_reserva: fechaReserva,
        valor_total: nuevoTotal,
        observacion: observacionNueva,
      });

      setTotalInput(modal, nuevoTotal);
      setReserva({
        ...reserva,
        id_fecha: idFecha,
        id_hora: fields.idHora,
        fecha: fields.fecha,
        hora: fields.horaTexto,
        total: nuevoTotal,
        saldo_pendiente: nuevoPendiente,
        observacion: observacionNueva,
        estado_operativo: "reprogramada",
        motivo_estado_operativo: detalleHistorial,
      });
      setSuccess(`Reserva reprogramada. Nuevo total: ${money(nuevoTotal)} · Saldo pendiente: ${money(nuevoPendiente)}.`);

      window.setTimeout(() => {
        const close = modal.querySelector<HTMLButtonElement>(".op-modal-head > button");
        close?.click();
        window.setTimeout(() => {
          const refresh = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
            .find((button) => /actualizar/i.test(button.textContent ?? ""));
          refresh?.click();
        }, 100);
      }, 900);
    } catch (e: any) {
      setError(e?.message || "No fue posible reprogramar la reserva.");
    } finally {
      setSaving(false);
    }
  };

  if (!host || !section) return null;

  return createPortal(
    <div style={{ marginTop: 14, borderTop: "1px solid #e7dccb", paddingTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <div className="op-section-icon"><CircleDollarSign size={18} /></div>
        <div>
          <strong style={{ display: "block" }}>Penalidad por reprogramación</strong>
          <small style={{ color: "#7b6d5e" }}>La penalidad se suma al valor total y la nueva fecha, hora y total quedan sincronizados en la reserva.</small>
        </div>
      </div>

      {loading ? (
        <div className="op-advanced-loading">Cargando valor actual…</div>
      ) : reserva ? (
        <>
          <div className="op-attendance-summary">
            <div><span>Valor actual</span><b>{money(reserva.total)}</b></div>
            <div><span>Pagado</span><b>{money(pagado)}</b></div>
            <div><span>Nuevo total</span><b>{money(nuevoTotal)}</b></div>
          </div>

          <div className="op-attendance-fields" style={{ marginTop: 12 }}>
            <label>
              Penalidad total
              <div className="op-money-input">
                <span>$</span>
                <input
                  inputMode="numeric"
                  value={penalidad}
                  onChange={(e) => { setPenalidad(e.target.value.replace(/[^0-9]/g, "")); setError(""); setSuccess(""); }}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
            </label>
            <label>
              Nuevo saldo pendiente
              <input value={money(nuevoPendiente)} readOnly aria-readonly="true" />
            </label>
          </div>

          <div className="op-attendance-note" style={{ marginTop: 10 }}>
            Cálculo: <b>{money(reserva.total)}</b> + <b>{money(valorPenalidad)}</b> de penalidad = <b>{money(nuevoTotal)}</b>.
          </div>
        </>
      ) : null}

      {error && <div className="op-advanced-error" style={{ marginTop: 10 }}>{error}</div>}
      {success && <div className="op-advanced-success" style={{ marginTop: 10 }}>{success}</div>}

      <div className="op-attendance-actions" style={{ marginTop: 12 }}>
        <button type="button" className="op-btn secondary op-action-btn" disabled={saving || loading || !reserva} onClick={saveReprogram}>
          <CalendarClock size={15} /> {saving ? "Reprogramando…" : "Reprogramar y actualizar reserva"}
        </button>
      </div>
    </div>,
    host,
  );
}
