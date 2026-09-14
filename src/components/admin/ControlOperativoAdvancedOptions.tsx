import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { ChevronDown, CircleDollarSign, ShieldCheck, UsersRound } from "lucide-react";
import {
  cambiarEstadoOperativo,
  getControlOperativo,
  updateAdminReservationTotal,
  updateControlReserva,
} from "../../services/controlOperativo.service";
import { getCurrentRole, type AppRole } from "../../services/role.service";
import "../../styles/control-operativo-advanced.css";

type AdvancedOption = "" | "estado" | "reprogramar" | "devoluciones" | "valor";
type AttendanceMode = "todos" | "faltaron";

type ReservaResumen = {
  id_reserva: number;
  codigo: string;
  total: number;
  cantidad: number;
  observacion: string;
  abono: number;
  pagoSaldo: number;
};

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;

function sectionKey(section: HTMLElement): AdvancedOption {
  const title = section.querySelector(".op-section-title strong")?.textContent?.trim().toLowerCase() ?? "";
  if (title.includes("estado y asistencia")) return "estado";
  if (title.includes("reprogramar reserva")) return "reprogramar";
  if (title.includes("devoluciones")) return "devoluciones";
  return "";
}

function getStateSection(modal: HTMLElement) {
  return Array.from(modal.querySelectorAll<HTMLElement>(".op-management-section"))
    .find((section) => sectionKey(section) === "estado") ?? null;
}

function getReservaCode(modal: HTMLElement) {
  const labels = Array.from(modal.querySelectorAll<HTMLLabelElement>(".op-edit-grid label"));
  const codeLabel = labels.find((label) => label.textContent?.trim().toLowerCase().startsWith("código actual"));
  const input = codeLabel?.querySelector<HTMLInputElement>("input");
  if (input?.value) return input.value.trim();
  const text = modal.querySelector(".op-modal-head p")?.textContent ?? "";
  return text.match(/CH\d+/i)?.[0] ?? "";
}

function getBaseTotalInput(modal: HTMLElement) {
  const labels = Array.from(modal.querySelectorAll<HTMLLabelElement>(".op-edit-grid label"));
  const totalLabel = labels.find((label) => {
    const clone = label.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input,select,textarea").forEach((node) => node.remove());
    return clone.textContent?.trim().toLowerCase() === "total";
  });
  return totalLabel?.querySelector<HTMLInputElement>("input") ?? null;
}

function lockBaseTotal(modal: HTMLElement, role: AppRole | null) {
  const input = getBaseTotalInput(modal);
  if (!input) return;
  input.readOnly = true;
  input.setAttribute("aria-readonly", "true");
  input.classList.add("op-total-locked");
  input.title = role === "administrador"
    ? "El valor total se modifica desde Opciones avanzadas."
    : "Solo un administrador puede modificar el valor total.";
}

function setReactInputValue(input: HTMLInputElement, value: number) {
  const nextValue = String(value);
  const currentValue = Number(String(input.value || "").replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(currentValue) && Math.abs(currentValue - value) < 0.01) return;

  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, nextValue);
  else input.value = nextValue;

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function syncBaseTotalFromDatabase(modal: HTMLElement) {
  const codigo = getReservaCode(modal);
  if (!codigo) return false;

  const rows = await getControlOperativo();
  const row = rows.find((item) => item.reserva_codigo === codigo);
  const input = getBaseTotalInput(modal);
  if (!row || !input) return false;

  setReactInputValue(input, Number(row.total || 0));
  return true;
}

export default function ControlOperativoAdvancedOptions() {
  const location = useLocation();
  const [role, setRole] = useState<AppRole | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [stateHost, setStateHost] = useState<HTMLDivElement | null>(null);
  const [modal, setModal] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<AdvancedOption>("");
  const [reserva, setReserva] = useState<ReservaResumen | null>(null);
  const [nuevoTotal, setNuevoTotal] = useState("");
  const [observacion, setObservacion] = useState("");
  const [estadoSeleccionado, setEstadoSeleccionado] = useState("");
  const [asistencia, setAsistencia] = useState<AttendanceMode>("todos");
  const [asistentes, setAsistentes] = useState("");
  const [penalidad, setPenalidad] = useState("");
  const [loadingReserva, setLoadingReserva] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentRole()
      .then((data) => active && setRole(data?.role ?? null))
      .catch(() => active && setRole(null));
    return () => { active = false; };
  }, [location.pathname]);

  useEffect(() => {
    if (!location.pathname.includes("/app/control-operativo")) {
      setModal(null);
      setHost(null);
      setStateHost(null);
      setSelected("");
      return;
    }

    const detectModal = () => {
      const currentModal = document.querySelector<HTMLElement>(".op-modal.edit-modal");
      if (!currentModal) {
        setModal(null);
        setHost(null);
        setStateHost(null);
        setSelected("");
        setReserva(null);
        setNuevoTotal("");
        setObservacion("");
        setEstadoSeleccionado("");
        setAsistencia("todos");
        setAsistentes("");
        setPenalidad("");
        setError("");
        setSuccess("");
        return;
      }

      lockBaseTotal(currentModal, role);
      setModal(currentModal);

      const codigo = getReservaCode(currentModal);
      const loadingKey = codigo ? `loading:${codigo}` : "";
      const doneKey = codigo ? `done:${codigo}` : "";
      if (
        codigo &&
        currentModal.dataset.totalSyncState !== loadingKey &&
        currentModal.dataset.totalSyncState !== doneKey
      ) {
        currentModal.dataset.totalSyncState = loadingKey;
        void syncBaseTotalFromDatabase(currentModal)
          .then((synced) => {
            if (!currentModal.isConnected) return;
            currentModal.dataset.totalSyncState = synced ? doneKey : "";
          })
          .catch((syncError) => {
            console.error("No se pudo sincronizar el valor total de la reserva en el modal operativo", syncError);
            if (currentModal.isConnected) currentModal.dataset.totalSyncState = "";
          });
      }

      let currentHost = currentModal.querySelector<HTMLDivElement>("#op-advanced-options-host");
      if (!currentHost) {
        currentHost = document.createElement("div");
        currentHost.id = "op-advanced-options-host";
        const firstManagement = currentModal.querySelector(".op-management-section");
        if (firstManagement?.parentElement) firstManagement.parentElement.insertBefore(currentHost, firstManagement);
        else currentModal.querySelector(".op-modal-head")?.insertAdjacentElement("afterend", currentHost);
      }
      setHost(currentHost);

      const stateSection = getStateSection(currentModal);
      if (stateSection) {
        let attendanceHost = stateSection.querySelector<HTMLDivElement>("#op-attendance-host");
        if (!attendanceHost) {
          attendanceHost = document.createElement("div");
          attendanceHost.id = "op-attendance-host";
          stateSection.appendChild(attendanceHost);
        }
        setStateHost(attendanceHost);
      } else {
        setStateHost(null);
      }
    };

    detectModal();
    const observer = new MutationObserver(detectModal);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname, role]);

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
    if (!modal) return;
    const stateSection = getStateSection(modal);
    const stateSelect = stateSection?.querySelector<HTMLSelectElement>("select");
    const stateButton = stateSection?.querySelector<HTMLButtonElement>("button.op-action-btn");
    if (!stateSelect) return;

    const syncState = () => {
      const value = stateSelect.value;
      setEstadoSeleccionado(value);
      if (stateButton) stateButton.style.display = value === "asistio" ? "none" : "";
    };

    syncState();
    stateSelect.addEventListener("change", syncState);
    return () => {
      stateSelect.removeEventListener("change", syncState);
      if (stateButton) stateButton.style.removeProperty("display");
    };
  }, [modal]);

  useEffect(() => {
    if (!modal || (selected !== "valor" && selected !== "estado")) return;
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
        if (!row) throw new Error("No fue posible cargar la reserva.");
        const resumen = {
          id_reserva: row.id_reserva,
          codigo: row.reserva_codigo,
          total: Number(row.total || 0),
          cantidad: Math.max(1, Number(row.cantidad || 1)),
          observacion: row.observacion || "",
          abono: Number(row.abono || 0),
          pagoSaldo: Number(row.pago_saldo || 0),
        };
        setReserva(resumen);
        setNuevoTotal(String(resumen.total));
        setObservacion("");
        if (selected === "estado") {
          setAsistencia("todos");
          setAsistentes(String(resumen.cantidad));
          setPenalidad("");
        }
      })
      .catch((e: any) => active && setError(e?.message || "No fue posible cargar la reserva."))
      .finally(() => active && setLoadingReserva(false));
    return () => { active = false; };
  }, [modal, selected]);

  const unitario = useMemo(() => {
    if (!reserva) return 0;
    const total = Number(nuevoTotal || 0);
    return total > 0 ? total / Math.max(1, reserva.cantidad) : 0;
  }, [nuevoTotal, reserva]);

  const unitarioAsistencia = useMemo(() => {
    if (!reserva) return 0;
    return reserva.total / Math.max(1, reserva.cantidad);
  }, [reserva]);

  const totalAsistencia = useMemo(() => {
    if (!reserva) return 0;
    if (asistencia === "todos") return reserva.total;
    const cantidadAsistentes = Number(asistentes || 0);
    const valorPenalidad = Number(penalidad || 0);
    if (!Number.isFinite(cantidadAsistentes) || !Number.isFinite(valorPenalidad)) return 0;
    return Math.max(0, Math.round(unitarioAsistencia * cantidadAsistentes + valorPenalidad));
  }, [asistencia, asistentes, penalidad, reserva, unitarioAsistencia]);

  const pagado = reserva ? reserva.abono + reserva.pagoSaldo : 0;
  const pendienteAsistencia = Math.max(0, totalAsistencia - pagado);
  const excesoAsistencia = Math.max(0, pagado - totalAsistencia);

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
      await updateAdminReservationTotal({ id_reserva: reserva.id_reserva, valor_total: total, observacion });
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

  const saveAttendance = async () => {
    if (!modal || !reserva || estadoSeleccionado !== "asistio") return;

    const cantidadReservada = Math.max(1, reserva.cantidad);
    const cantidadAsistentes = asistencia === "todos" ? cantidadReservada : Number(asistentes || 0);
    const valorPenalidad = asistencia === "faltaron" ? Number(penalidad || 0) : 0;

    if (asistencia === "faltaron") {
      if (!Number.isInteger(cantidadAsistentes) || cantidadAsistentes <= 0 || cantidadAsistentes >= cantidadReservada) {
        setError(`Indica cuántas personas asistieron. Debe ser entre 1 y ${Math.max(1, cantidadReservada - 1)}. Si no asistió nadie, usa el estado “No asistió”.`);
        return;
      }
      if (!Number.isFinite(valorPenalidad) || valorPenalidad < 0) {
        setError("La penalidad debe ser un valor válido igual o mayor a $0.");
        return;
      }
    }

    const nuevoValorTotal = asistencia === "todos"
      ? reserva.total
      : Math.max(0, Math.round(unitarioAsistencia * cantidadAsistentes + valorPenalidad));
    const faltantes = cantidadReservada - cantidadAsistentes;
    const stateSection = getStateSection(modal);
    const motivoInput = stateSection?.querySelector<HTMLInputElement>(".wide-field input");
    const motivoManual = motivoInput?.value.trim() || "";
    const detalleBase = asistencia === "todos"
      ? `Asistencia completa: ${cantidadReservada} de ${cantidadReservada} personas asistieron.`
      : `Asistencia parcial: ${cantidadAsistentes} de ${cantidadReservada} personas asistieron; faltaron ${faltantes}. Penalidad: ${money(valorPenalidad)}. Valor total ajustado: ${money(nuevoValorTotal)}.`;
    const detalle = motivoManual ? `${detalleBase} ${motivoManual}` : detalleBase;
    const observacionAnterior = reserva.observacion.trim();
    const observacionNueva = observacionAnterior ? `${observacionAnterior} | ${detalleBase}` : detalleBase;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (asistencia === "faltaron") {
        await updateControlReserva(reserva.id_reserva, {
          valor_total: nuevoValorTotal,
          precio_unitario: unitarioAsistencia,
          observacion: observacionNueva,
        });
      }

      try {
        await cambiarEstadoOperativo(reserva.id_reserva, "asistio", detalle);
      } catch (statusError) {
        if (asistencia === "faltaron") {
          try {
            await updateControlReserva(reserva.id_reserva, {
              valor_total: reserva.total,
              precio_unitario: unitarioAsistencia,
              observacion: observacionAnterior || null,
            });
          } catch {
            // Si el rollback falla, el error original sigue siendo el más útil para el usuario.
          }
        }
        throw statusError;
      }

      if (asistencia === "faltaron") {
        const totalInput = getBaseTotalInput(modal);
        if (totalInput) setReactInputValue(totalInput, nuevoValorTotal);
        setReserva({ ...reserva, total: nuevoValorTotal, observacion: observacionNueva });
      }

      setSuccess(
        asistencia === "todos"
          ? `Asistencia confirmada: ${cantidadReservada} de ${cantidadReservada} personas.`
          : `Asistencia parcial registrada. Nuevo total: ${money(nuevoValorTotal)}${excesoAsistencia > 0 ? ` · Hay ${money(excesoAsistencia)} a favor del cliente para gestionar como devolución.` : ` · Saldo pendiente: ${money(pendienteAsistencia)}.`}`,
      );

      window.setTimeout(() => {
        const close = modal.querySelector<HTMLButtonElement>(".op-modal-head > button");
        close?.click();
        window.setTimeout(() => {
          const refresh = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
            .find((button) => /actualizar/i.test(button.textContent ?? ""));
          refresh?.click();
        }, 80);
      }, 800);
    } catch (e: any) {
      setError(e?.message || "No fue posible registrar la asistencia.");
    } finally {
      setSaving(false);
    }
  };

  if (!host || !modal) return null;

  const advancedPortal = createPortal(
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

  const attendancePortal = stateHost && selected === "estado" && estadoSeleccionado === "asistio"
    ? createPortal(
      <div className="op-attendance-panel">
        <div className="op-attendance-title">
          <div className="op-attendance-icon"><UsersRound size={18} /></div>
          <div>
            <strong>Confirmar asistencia</strong>
            <small>Indica si llegó todo el grupo o si faltaron personas. Si faltaron, el sistema recalcula automáticamente el total.</small>
          </div>
        </div>

        {loadingReserva ? (
          <div className="op-advanced-loading">Cargando información de la reserva…</div>
        ) : reserva ? (
          <>
            <div className="op-attendance-choice">
              <button type="button" className={asistencia === "todos" ? "active" : ""} onClick={() => { setAsistencia("todos"); setAsistentes(String(reserva.cantidad)); setPenalidad(""); setError(""); }}>
                Asistieron todos
              </button>
              <button type="button" className={asistencia === "faltaron" ? "active" : ""} onClick={() => { setAsistencia("faltaron"); setAsistentes(String(Math.max(1, reserva.cantidad - 1))); setError(""); }}>
                Faltaron personas
              </button>
            </div>

            <div className="op-attendance-summary">
              <div><span>Reservadas</span><b>{reserva.cantidad}</b></div>
              <div><span>Valor por persona</span><b>{money(unitarioAsistencia)}</b></div>
              <div><span>Pagado</span><b>{money(pagado)}</b></div>
            </div>

            {asistencia === "faltaron" && (
              <>
                <div className="op-attendance-fields">
                  <label>
                    Personas que sí asistieron *
                    <input type="number" min={1} max={Math.max(1, reserva.cantidad - 1)} value={asistentes} onChange={(e) => setAsistentes(e.target.value.replace(/[^0-9]/g, ""))} />
                  </label>
                  <label>
                    Penalidad total
                    <div className="op-money-input"><span>$</span><input inputMode="numeric" value={penalidad} onChange={(e) => setPenalidad(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /></div>
                  </label>
                </div>

                <div className="op-attendance-result">
                  <div><span>Nuevo valor total</span><b>{money(totalAsistencia)}</b></div>
                  <div className={excesoAsistencia > 0 ? "warning" : ""}><span>{excesoAsistencia > 0 ? "A favor del cliente" : "Nuevo saldo pendiente"}</span><b>{money(excesoAsistencia > 0 ? excesoAsistencia : pendienteAsistencia)}</b></div>
                </div>
                <div className="op-attendance-note">Cálculo: <b>{Number(asistentes || 0)} asistentes × {money(unitarioAsistencia)}</b> + <b>{money(Number(penalidad || 0))}</b> de penalidad.</div>
              </>
            )}

            {error && <div className="op-advanced-error">{error}</div>}
            {success && <div className="op-advanced-success">{success}</div>}
            <div className="op-attendance-actions">
              <button type="button" className="op-btn primary" disabled={saving} onClick={saveAttendance}>{saving ? "Registrando…" : asistencia === "todos" ? "Confirmar asistencia completa" : "Registrar asistencia parcial"}</button>
            </div>
          </>
        ) : error ? <div className="op-advanced-error">{error}</div> : null}
      </div>,
      stateHost,
    )
    : null;

  return <>{advancedPortal}{attendancePortal}</>;
}
