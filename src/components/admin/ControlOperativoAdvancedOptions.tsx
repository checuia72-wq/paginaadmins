import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CircleDollarSign, ShieldCheck } from "lucide-react";
import { ajustarValorTotalReserva, getControlOperativo } from "../../services/controlOperativo.service";
import { getCurrentRole, type AppRole } from "../../services/role.service";
import "../../styles/control-operativo-advanced.css";

type AdvancedOption = "" | "estado" | "reprogramar" | "devoluciones" | "valor";

type ReservaResumen = {
  id_reserva: number;
  codigo: string;
  total: number;
  cantidad: number;
  observacion: string;
};

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;

function sectionKey(section: HTMLElement): AdvancedOption {
  const title = section.querySelector(".op-section-title strong")?.textContent?.trim().toLowerCase() ?? "";
  if (title.includes("estado y asistencia")) return "estado";
  if (title.includes("reprogramar reserva")) return "reprogramar";
  if (title.includes("devoluciones")) return "devoluciones";
  return "";
}

function getReservaCode(modal: HTMLElement) {
  const labels = Array.from(modal.querySelectorAll<HTMLLabelElement>(".op-edit-grid label"));
  const codeLabel = labels.find((label) => label.textContent?.trim().toLowerCase().startsWith("código actual"));
  const input = codeLabel?.querySelector<HTMLInputElement>("input");
  if (input?.value) return input.value.trim();
  const text = modal.querySelector(".op-modal-head p")?.textContent ?? "";
  return text.match(/CH\d+/i)?.[0] ?? "";
}

function lockBaseTotal(modal: HTMLElement, role: AppRole | null) {
  const labels = Array.from(modal.querySelectorAll<HTMLLabelElement>(".op-edit-grid label"));
  const totalLabel = labels.find((label) => {
    const clone = label.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input,select,textarea").forEach((node) => node.remove());
    return clone.textContent?.trim().toLowerCase() === "total";
  });
  const input = totalLabel?.querySelector<HTMLInputElement>("input");
  if (!input) return;
  input.readOnly = true;
  input.setAttribute("aria-readonly", "true");
  input.classList.add("op-total-locked");
  input.title = role === "administrador"
    ? "El valor total se modifica desde Opciones avanzadas."
    : "Solo un administrador puede modificar el valor total.";
}

export default function ControlOperativoAdvancedOptions() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [modal, setModal] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<AdvancedOption>("");
  const [reserva, setReserva] = useState<ReservaResumen | null>(null);
  const [nuevoTotal, setNuevoTotal] = useState("");
  const [observacion, setObservacion] = useState("");
  const [loadingReserva, setLoadingReserva] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    getCurrentRole().then((data) => setRole(data?.role ?? null)).catch(() => setRole(null));
  }, []);

  useEffect(() => {
    if (!window.location.pathname.includes("/app/control-operativo")) return;

    const detectModal = () => {
      const currentModal = document.querySelector<HTMLElement>(".op-modal.edit-modal");
      if (!currentModal) {
        setModal(null);
        setHost(null);
        setSelected("");
        setReserva(null);
        setNuevoTotal("");
        setObservacion("");
        setError("");
        setSuccess("");
        return;
      }

      lockBaseTotal(currentModal, role);
      setModal(currentModal);

      let currentHost = currentModal.querySelector<HTMLDivElement>("#op-advanced-options-host");
      if (!currentHost) {
        currentHost = document.createElement("div");
        currentHost.id = "op-advanced-options-host";
        const firstManagement = currentModal.querySelector(".op-management-section");
        if (firstManagement?.parentElement) firstManagement.parentElement.insertBefore(currentHost, firstManagement);
        else currentModal.querySelector(".op-modal-head")?.insertAdjacentElement("afterend", currentHost);
      }
      setHost(currentHost);
    };

    detectModal();
    const observer = new MutationObserver(detectModal);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [role]);

  useEffect(() => {
    if (!modal) return;
    lockBaseTotal(modal, role);
    const sections = Array.from(modal.querySelectorAll<HTMLElement>(".op-management-section"));
    for (const section of sections) {
      const key = sectionKey(section);
      if (!key) continue;
      section.dataset.advancedSection = key;
      section.style.display = selected === key ? "" : "none";
    }
  }, [modal, role, selected]);

  useEffect(() => {
    if (!modal || selected !== "valor" || role !== "administrador") return;
    const codigo = getReservaCode(modal);
    if (!codigo) {
      setError("No fue posible identificar la reserva abierta.");
      return;
    }
    let active = true;
    setLoadingReserva(true);
    setError("");
    setSuccess("");
    getControlOperativo()
      .then((rows) => {
        if (!active) return;
        const row = rows.find((item) => item.reserva_codigo === codigo);
        if (!row) throw new Error("No fue posible cargar la reserva para ajustar su valor.");
        const resumen = {
          id_reserva: row.id_reserva,
          codigo: row.reserva_codigo,
          total: Number(row.total || 0),
          cantidad: Math.max(1, Number(row.cantidad || 1)),
          observacion: row.observacion || "",
        };
        setReserva(resumen);
        setNuevoTotal(String(resumen.total));
        setObservacion("");
      })
      .catch((e: any) => active && setError(e?.message || "No fue posible cargar la reserva."))
      .finally(() => active && setLoadingReserva(false));
    return () => { active = false; };
  }, [modal, role, selected]);

  const unitario = useMemo(() => {
    if (!reserva) return 0;
    const total = Number(nuevoTotal || 0);
    return total > 0 ? total / Math.max(1, reserva.cantidad) : 0;
  }, [nuevoTotal, reserva]);

  const saveTotal = async () => {
    if (role !== "administrador" || !reserva) return;
    const total = Number(String(nuevoTotal).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(total) || total <= 0) {
      setError("Ingresa un valor total válido mayor a cero.");
      return;
    }
    if (!observacion.trim()) {
      setError("La observación es obligatoria para cambiar el valor total.");
      return;
    }
    if (total === reserva.total) {
      setError("El nuevo valor total es igual al valor actual.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await ajustarValorTotalReserva({ id_reserva: reserva.id_reserva, valor_total: total, observacion });
      setSuccess(`Valor actualizado a ${money(total)}. El valor unitario quedó en ${money(total / reserva.cantidad)}.`);
      setReserva({ ...reserva, total });
      setNuevoTotal(String(total));
      setObservacion("");

      window.setTimeout(() => {
        const close = modal?.querySelector<HTMLButtonElement>(".op-modal-head > button");
        close?.click();
        window.setTimeout(() => {
          const refresh = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
            .find((button) => /actualizar/i.test(button.textContent ?? ""));
          refresh?.click();
        }, 80);
      }, 650);
    } catch (e: any) {
      setError(e?.message || "No fue posible cambiar el valor total de la reserva.");
    } finally {
      setSaving(false);
    }
  };

  if (!host || !modal) return null;

  return createPortal(
    <div className="op-advanced-panel">
      <div className="op-advanced-heading">
        <div className="op-advanced-icon"><ShieldCheck size={18} /></div>
        <div>
          <strong>Opciones avanzadas</strong>
          <small>Abre únicamente la gestión que necesites para mantener el modal más limpio.</small>
        </div>
      </div>

      <div className="op-advanced-select-wrap">
        <select
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value as AdvancedOption);
            setError("");
            setSuccess("");
          }}
          aria-label="Opciones avanzadas"
        >
          <option value="">Selecciona una opción</option>
          <option value="estado">Estado y asistencia</option>
          <option value="reprogramar">Reprogramar reserva</option>
          <option value="devoluciones">Devoluciones</option>
          {role === "administrador" && <option value="valor">Cambiar valor total</option>}
        </select>
        <ChevronDown size={17} aria-hidden="true" />
      </div>

      {selected === "valor" && role === "administrador" && (
        <section className="op-admin-total-section">
          <div className="op-admin-total-title">
            <div className="op-admin-total-icon"><CircleDollarSign size={19} /></div>
            <div>
              <strong>Cambiar valor total</strong>
              <small>Solo administradores. El cambio actualiza también el valor unitario y exige una observación.</small>
            </div>
          </div>

          {loadingReserva ? (
            <div className="op-advanced-loading">Cargando valores de la reserva…</div>
          ) : reserva ? (
            <>
              <div className="op-total-summary-grid">
                <div><span>Valor actual</span><b>{money(reserva.total)}</b></div>
                <div><span>Personas</span><b>{reserva.cantidad}</b></div>
                <div><span>Nuevo unitario</span><b>{unitario > 0 ? money(unitario) : "—"}</b></div>
              </div>

              <div className="op-total-form-grid">
                <label>
                  Nuevo valor total *
                  <div className="op-money-input"><span>$</span><input inputMode="numeric" value={nuevoTotal} onChange={(e) => setNuevoTotal(e.target.value.replace(/[^0-9]/g, ""))} /></div>
                </label>
                <label className="op-total-observation">
                  Observación obligatoria *
                  <textarea rows={3} value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Explica por qué se modifica el valor de la reserva…" />
                </label>
              </div>

              <div className="op-total-warning">Este ajuste modifica <b>valor_total</b> y recalcula <b>precio_unitario</b> según la cantidad de personas. La observación queda registrada en la reserva.</div>
              {error && <div className="op-advanced-error">{error}</div>}
              {success && <div className="op-advanced-success">{success}</div>}
              <div className="op-total-actions"><button type="button" className="op-btn primary" disabled={saving} onClick={saveTotal}>{saving ? "Guardando…" : "Guardar nuevo valor"}</button></div>
            </>
          ) : error ? <div className="op-advanced-error">{error}</div> : null}
        </section>
      )}
    </div>,
    host,
  );
}
