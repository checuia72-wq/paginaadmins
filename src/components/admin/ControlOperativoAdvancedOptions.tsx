import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { ChevronDown, CircleDollarSign, Minus, PackagePlus, Plus, ShieldCheck, ShoppingCart, Trash2, UsersRound } from "lucide-react";
import {
  cambiarEstadoOperativo,
  getControlOperativo,
  updateAdminReservationTotal,
  updateControlReserva,
} from "../../services/controlOperativo.service";
import { getCurrentRole, type AppRole } from "../../services/role.service";
import {
  agregarPlanAdicionalReserva,
  calcularImpactoPlanAdicional,
  getOpcionesPlanesAdicionales,
  getReservaPlanesAdicionales,
  retirarPlanAdicionalReserva,
  type OpcionPlanAdicional,
  type ReservaPlanAdicional,
} from "../../services/reservaPlanAdicional.service";
import { getMetodosPagoActivos } from "../../services/medioPago.service";
import {
  cancelSnackSaleForReservation,
  getSnackProducts,
  getSnackSalesForReservation,
  registerSnackSaleForReservation,
  snackLocationLabel,
  type SnackLocationCode,
  type SnackProduct,
  type SnackSale,
} from "../../services/snack.service";
import "../../styles/control-operativo-advanced.css";

type AdvancedOption = "" | "estado" | "reprogramar" | "devoluciones" | "planes_adicionales" | "ventas_snacks" | "valor";
type AttendanceMode = "todos" | "faltaron";

type ReservaResumen = {
  id_reserva: number;
  codigo: string;
  id_plan: number | null;
  fecha: string;
  total: number;
  cantidad: number;
  observacion: string;
  abono: number;
  pagoSaldo: number;
};

const money = (value: number) => "$" + Number(value || 0).toLocaleString("es-CO");

function opcionCoincideConAgregado(opcion: OpcionPlanAdicional, agregado: ReservaPlanAdicional) {
  if (opcion.origen !== agregado.origen) return false;
  if (opcion.origen === "plan") return Number(opcion.id_plan) === Number(agregado.id_plan_adicional);
  return Number(opcion.id_adicional) === Number(agregado.id_adicional);
}

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
  const [opcionesPlanesAdicionales, setOpcionesPlanesAdicionales] = useState<OpcionPlanAdicional[]>([]);
  const [planesAdicionalesReserva, setPlanesAdicionalesReserva] = useState<ReservaPlanAdicional[]>([]);
  const [planAdicionalKey, setPlanAdicionalKey] = useState("");
  const [alcancePlanAdicional, setAlcancePlanAdicional] = useState<"todos" | "algunos">("todos");
  const [cantidadPlanAdicional, setCantidadPlanAdicional] = useState("");
  const [snackProducts, setSnackProducts] = useState<SnackProduct[]>([]);
  const [snackCart, setSnackCart] = useState<Record<number, number>>({});
  const [snackLocation, setSnackLocation] = useState<SnackLocationCode>("taquilla_1");
  const [snackPayment, setSnackPayment] = useState("");
  const [snackMethods, setSnackMethods] = useState<string[]>([]);
  const [snackSearch, setSnackSearch] = useState("");
  const [snackReservationSales, setSnackReservationSales] = useState<SnackSale[]>([]);
  const [loadingSnacks, setLoadingSnacks] = useState(false);
  const [loadingSnackSales, setLoadingSnackSales] = useState(false);
  const [loadingReserva, setLoadingReserva] = useState(false);
  const [loadingPlanesAdicionales, setLoadingPlanesAdicionales] = useState(false);
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
        setOpcionesPlanesAdicionales([]);
        setPlanesAdicionalesReserva([]);
        setPlanAdicionalKey("");
        setAlcancePlanAdicional("todos");
        setCantidadPlanAdicional("");
        setSnackProducts([]);
        setSnackCart({});
        setSnackLocation("taquilla_1");
        setSnackPayment("");
        setSnackMethods([]);
        setSnackSearch("");
        setSnackReservationSales([]);
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
    if (!modal || (selected !== "valor" && selected !== "estado" && selected !== "planes_adicionales" && selected !== "ventas_snacks")) return;
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
          id_plan: row.id_plan,
          fecha: row.fecha,
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
        if (selected === "planes_adicionales") {
          setAlcancePlanAdicional("todos");
          setCantidadPlanAdicional(String(resumen.cantidad));
        }
      })
      .catch((e: any) => active && setError(e?.message || "No fue posible cargar la reserva."))
      .finally(() => active && setLoadingReserva(false));
    return () => { active = false; };
  }, [modal, selected]);

  useEffect(() => {
    if (selected !== "planes_adicionales" || !reserva) return;
    let active = true;
    setLoadingPlanesAdicionales(true);
    setError("");
    Promise.all([
      getOpcionesPlanesAdicionales(reserva.id_plan),
      getReservaPlanesAdicionales(reserva.id_reserva),
    ])
      .then(([opciones, agregados]) => {
        if (!active) return;
        setOpcionesPlanesAdicionales(opciones);
        setPlanesAdicionalesReserva(agregados);
      })
      .catch((e: any) => active && setError(e?.message || "No fue posible cargar los planes adicionales."))
      .finally(() => active && setLoadingPlanesAdicionales(false));
    return () => { active = false; };
  }, [selected, reserva?.id_reserva, reserva?.id_plan]);

  useEffect(() => {
    if (selected !== "ventas_snacks") return;
    let active = true;
    setLoadingSnacks(true);
    setError("");
    Promise.all([
      getSnackProducts(false, snackLocation),
      getMetodosPagoActivos(),
    ])
      .then(([products, methods]) => {
        if (!active) return;
        setSnackProducts(products);
        setSnackMethods(methods);
        setSnackCart((current) => {
          const next: Record<number, number> = {};
          for (const product of products) {
            const quantity = Math.min(current[product.id_producto] ?? 0, product.cantidad);
            if (quantity > 0) next[product.id_producto] = quantity;
          }
          return next;
        });
        if (!snackPayment && methods.length === 1) setSnackPayment(methods[0]);
      })
      .catch((e: any) => active && setError(e?.message || "No fue posible cargar los snacks disponibles."))
      .finally(() => active && setLoadingSnacks(false));
    return () => { active = false; };
  }, [selected, snackLocation]);

  useEffect(() => {
    if (selected !== "ventas_snacks" || !reserva) {
      setSnackReservationSales([]);
      return;
    }

    let active = true;
    setLoadingSnackSales(true);
    getSnackSalesForReservation(reserva.id_reserva)
      .then((sales) => active && setSnackReservationSales(sales))
      .catch((e: any) => active && setError(e?.message || "No fue posible cargar las ventas de snacks vinculadas a la reserva."))
      .finally(() => active && setLoadingSnackSales(false));

    return () => { active = false; };
  }, [selected, reserva?.id_reserva]);

    const filteredSnackProducts = useMemo(() => {
    const query = snackSearch.trim().toLowerCase();
    return snackProducts.filter((product) =>
      !query || [product.numero_producto, product.nombre_producto].some((value) => value.toLowerCase().includes(query)),
    );
  }, [snackProducts, snackSearch]);

  const snackCartItems = useMemo(
    () => snackProducts
      .filter((product) => (snackCart[product.id_producto] ?? 0) > 0)
      .map((product) => ({ product, cantidad: snackCart[product.id_producto] ?? 0 })),
    [snackProducts, snackCart],
  );

  const snackTotal = useMemo(
    () => snackCartItems.reduce((sum, item) => sum + item.product.precio * item.cantidad, 0),
    [snackCartItems],
  );

  const setSnackQuantity = (product: SnackProduct, quantity: number) => {
    const nextQuantity = Math.max(0, Math.min(product.cantidad, Math.floor(Number(quantity) || 0)));
    setSnackCart((current) => {
      const next = { ...current };
      if (nextQuantity <= 0) delete next[product.id_producto];
      else next[product.id_producto] = nextQuantity;
      return next;
    });
  };

  const opcionesDisponibles = useMemo(
    () => opcionesPlanesAdicionales.filter((opcion) => !planesAdicionalesReserva.some((agregado) => opcionCoincideConAgregado(opcion, agregado))),
    [opcionesPlanesAdicionales, planesAdicionalesReserva],
  );

  useEffect(() => {
    if (selected !== "planes_adicionales") return;
    if (!opcionesDisponibles.some((opcion) => opcion.key === planAdicionalKey)) {
      setPlanAdicionalKey(opcionesDisponibles[0]?.key ?? "");
    }
  }, [selected, opcionesDisponibles, planAdicionalKey]);

  const opcionPlanAdicional = useMemo(
    () => opcionesDisponibles.find((opcion) => opcion.key === planAdicionalKey) ?? null,
    [opcionesDisponibles, planAdicionalKey],
  );

  const cantidadAplicadaPlanAdicional = useMemo(() => {
    if (!reserva) return 0;
    if (alcancePlanAdicional === "todos") return reserva.cantidad;
    return Number(cantidadPlanAdicional || 0);
  }, [alcancePlanAdicional, cantidadPlanAdicional, reserva]);

  const previewPlanAdicional = useMemo(() => {
    if (!opcionPlanAdicional || !reserva || cantidadAplicadaPlanAdicional <= 0) return null;
    return calcularImpactoPlanAdicional(opcionPlanAdicional, cantidadAplicadaPlanAdicional, reserva.fecha);
  }, [opcionPlanAdicional, cantidadAplicadaPlanAdicional, reserva]);

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

  const recargarPlanesAdicionales = async (idReserva: number) => {
    const agregados = await getReservaPlanesAdicionales(idReserva);
    setPlanesAdicionalesReserva(agregados);
    return agregados;
  };

  const savePlanAdicional = async () => {
    if (!modal || !reserva || !opcionPlanAdicional || !previewPlanAdicional) return;
    const cantidad = cantidadAplicadaPlanAdicional;
    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > reserva.cantidad) {
      setError(`La cantidad debe estar entre 1 y ${reserva.cantidad} persona(s).`);
      return;
    }
    if (alcancePlanAdicional === "algunos" && reserva.cantidad > 1 && cantidad >= reserva.cantidad) {
      setError("Si el plan adicional aplica a toda la reserva, selecciona “Para todos”.");
      return;
    }
    if (previewPlanAdicional.impacto_total <= 0) {
      setError("El elemento seleccionado no tiene una tarifa válida para esta reserva.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await agregarPlanAdicionalReserva({
        id_reserva: reserva.id_reserva,
        opcion: opcionPlanAdicional,
        cantidad_personas: cantidad,
        aplica_todos: alcancePlanAdicional === "todos",
        precio_unitario: previewPlanAdicional.precio_unitario,
        impacto_total: previewPlanAdicional.impacto_total,
      });
      const nuevoTotal = result.nuevo_total;
      const esAlmuerzo = opcionPlanAdicional.nombre.toLowerCase().includes("almuerzo");
      setReserva({ ...reserva, total: nuevoTotal });
      window.dispatchEvent(new CustomEvent("control-operativo-reserva-updated", {
        detail: {
          id_reserva: reserva.id_reserva,
          total: nuevoTotal,
          ...(esAlmuerzo ? { incluye_almuerzo: true } : {}),
        },
      }));
      const totalInput = getBaseTotalInput(modal);
      if (totalInput) setReactInputValue(totalInput, nuevoTotal);
      await recargarPlanesAdicionales(reserva.id_reserva);
      setAlcancePlanAdicional("todos");
      setCantidadPlanAdicional(String(reserva.cantidad));
      setSuccess(`${opcionPlanAdicional.nombre} agregado por ${money(previewPlanAdicional.impacto_total)}. Nuevo total: ${money(nuevoTotal)}.`);
    } catch (e: any) {
      setError(e?.message || "No fue posible agregar el plan adicional.");
    } finally {
      setSaving(false);
    }
  };

  const removePlanAdicional = async (item: ReservaPlanAdicional) => {
    if (!modal || !reserva) return;
    if (!window.confirm(`¿Retirar “${item.nombre}” de esta reserva? Se descontarán ${money(item.impacto_total)}.`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await retirarPlanAdicionalReserva(item.id_reserva_plan_adicional);
      const nuevoTotal = result.nuevo_total;
      setReserva({ ...reserva, total: nuevoTotal });
      window.dispatchEvent(new CustomEvent("control-operativo-reserva-updated", {
        detail: { id_reserva: reserva.id_reserva, total: nuevoTotal },
      }));
      const totalInput = getBaseTotalInput(modal);
      if (totalInput) setReactInputValue(totalInput, nuevoTotal);
      await recargarPlanesAdicionales(reserva.id_reserva);
      setSuccess(`${item.nombre} retirado. Nuevo total: ${money(nuevoTotal)}.`);
    } catch (e: any) {
      setError(e?.message || "No fue posible retirar el plan adicional.");
    } finally {
      setSaving(false);
    }
  };

  const saveSnackSale = async () => {
    if (!modal || !reserva) return;
    if (!snackCartItems.length) {
      setError("Agrega al menos un snack a la venta.");
      return;
    }
    if (!snackPayment) {
      setError("Selecciona el método de pago de los snacks.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await registerSnackSaleForReservation(
        reserva.id_reserva,
        snackCartItems.map(({ product, cantidad }) => ({
          id_producto: product.id_producto,
          cantidad,
        })),
        snackPayment,
        snackLocation,
      );

      setReserva({
        ...reserva,
        total: result.nuevo_total,
        observacion: result.observacion || reserva.observacion,
      });
      const totalInput = getBaseTotalInput(modal);
      if (totalInput) setReactInputValue(totalInput, result.nuevo_total);

      setSnackCart({});
      const [refreshedProducts, refreshedSales] = await Promise.all([
        getSnackProducts(false, snackLocation),
        getSnackSalesForReservation(reserva.id_reserva),
      ]);
      setSnackProducts(refreshedProducts);
      setSnackReservationSales(refreshedSales);
      setSuccess(
        `Venta de snacks registrada por ${money(result.total)}. Nuevo total de la reserva: ${money(result.nuevo_total)} · Saldo pendiente: ${money(result.saldo_pendiente)}.`,
      );
    } catch (e: any) {
      setError(e?.message || "No fue posible registrar la venta de snacks en esta reserva.");
    } finally {
      setSaving(false);
    }
  };

  const removeSnackSale = async (sale: SnackSale) => {
    if (!modal || !reserva) return;
    const detalle = sale.items.map((item) => `${item.cantidad}× ${item.nombre_producto}`).join(", ");
    if (!window.confirm(
      `¿Quitar la venta de snacks #${sale.id_venta} por ${money(sale.total)}?\n\n${detalle}\n\nLos productos volverán al inventario y el valor se descontará de la reserva.`,
    )) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await cancelSnackSaleForReservation(
        reserva.id_reserva,
        sale.id_venta,
        "Cliente desistió de la compra",
      );

      setReserva({
        ...reserva,
        total: result.nuevo_total,
        observacion: result.observacion || reserva.observacion,
      });
      const totalInput = getBaseTotalInput(modal);
      if (totalInput) setReactInputValue(totalInput, result.nuevo_total);

      const [refreshedProducts, refreshedSales] = await Promise.all([
        getSnackProducts(false, snackLocation),
        getSnackSalesForReservation(reserva.id_reserva),
      ]);
      setSnackProducts(refreshedProducts);
      setSnackReservationSales(refreshedSales);

      setSuccess(
        result.exceso_pagado > 0
          ? `Venta #${sale.id_venta} retirada. Se descontaron ${money(result.total_retirado)} y los productos volvieron al inventario. Quedó ${money(result.exceso_pagado)} a favor del cliente para gestionar como devolución.`
          : `Venta #${sale.id_venta} retirada. Se descontaron ${money(result.total_retirado)} de la reserva, se restauró el inventario y el nuevo saldo pendiente es ${money(result.saldo_pendiente)}.`,
      );
    } catch (e: any) {
      setError(e?.message || "No fue posible retirar la venta de snacks de esta reserva.");
    } finally {
      setSaving(false);
    }
  };

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
          {(role === "administrador" || role === "atencion") && <option value="planes_adicionales">Planes adicionales</option>}
          {(role === "administrador" || role === "atencion") && <option value="ventas_snacks">Ventas de snacks</option>}
          {role === "administrador" && <option value="valor">Cambiar valor total</option>}
        </select>
        <ChevronDown size={17} aria-hidden="true" />
      </div>

      {selected === "ventas_snacks" && (role === "administrador" || role === "atencion") && (
        <section className="op-snack-sale-section">
          <div className="op-plan-additional-title">
            <div className="op-snack-sale-icon"><ShoppingCart size={19} /></div>
            <div>
              <strong>Ventas de snacks</strong>
              <small>Vende snacks desde Control Operativo y vincula la compra a esta reserva. El valor se suma al total y se refleja inmediatamente en el saldo pendiente.</small>
            </div>
          </div>

          {loadingReserva || loadingSnacks ? (
            <div className="op-advanced-loading">Cargando inventario y métodos de pago…</div>
          ) : reserva ? (
            <>
              <div className="op-snack-financial-summary">
                <div><span>Total actual</span><b>{money(reserva.total)}</b></div>
                <div><span>Ya pagado</span><b>{money(reserva.abono + reserva.pagoSaldo)}</b></div>
                <div><span>Saldo actual</span><b>{money(Math.max(0, reserva.total - reserva.abono - reserva.pagoSaldo))}</b></div>
                <div className="accent"><span>Snacks seleccionados</span><b>{money(snackTotal)}</b></div>
                <div><span>Nuevo total</span><b>{money(reserva.total + snackTotal)}</b></div>
                <div><span>Nuevo saldo</span><b>{money(Math.max(0, reserva.total + snackTotal - reserva.abono - reserva.pagoSaldo))}</b></div>
              </div>

              <div className="op-snack-sale-controls">
                <label>
                  Punto de venta *
                  <select value={snackLocation} onChange={(e) => { setSnackLocation(e.target.value as SnackLocationCode); setSnackCart({}); setError(""); }}>
                    <option value="taquilla_1">Taquilla 1</option>
                    <option value="enclave">Enclave</option>
                  </select>
                </label>
                <label>
                  Método de pago *
                  <select value={snackPayment} onChange={(e) => setSnackPayment(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {snackMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                </label>
                <label className="wide">
                  Buscar producto
                  <input value={snackSearch} onChange={(e) => setSnackSearch(e.target.value)} placeholder={`Buscar snack en ${snackLocationLabel(snackLocation)}…`} />
                </label>
              </div>

              <div className="op-snack-product-list">
                {filteredSnackProducts.length === 0 ? (
                  <div className="op-plan-additional-empty">No hay snacks disponibles en {snackLocationLabel(snackLocation)}.</div>
                ) : filteredSnackProducts.map((product) => {
                  const quantity = snackCart[product.id_producto] ?? 0;
                  return (
                    <div className="op-snack-product-row" key={product.id_producto}>
                      <div>
                        <strong>{product.nombre_producto}</strong>
                        <small>{product.numero_producto} · {product.cantidad} disponible{product.cantidad === 1 ? "" : "s"} · {money(product.precio)} c/u</small>
                      </div>
                      <div className="op-snack-qty">
                        <button type="button" disabled={quantity <= 0} onClick={() => setSnackQuantity(product, quantity - 1)}><Minus size={14} /></button>
                        <input type="number" min={0} max={product.cantidad} value={quantity} onChange={(e) => setSnackQuantity(product, Number(e.target.value))} />
                        <button type="button" disabled={product.cantidad <= 0 || quantity >= product.cantidad} onClick={() => setSnackQuantity(product, quantity + 1)}><Plus size={14} /></button>
                      </div>
                      <b>{money(product.precio * quantity)}</b>
                    </div>
                  );
                })}
              </div>

              {snackCartItems.length > 0 && (
                <div className="op-snack-cart">
                  <div className="op-snack-cart-head"><strong>Productos a cobrar</strong><b>{money(snackTotal)}</b></div>
                  {snackCartItems.map(({ product, cantidad }) => (
                    <div className="op-snack-cart-line" key={product.id_producto}>
                      <span>{cantidad}× {product.nombre_producto}</span>
                      <b>{money(product.precio * cantidad)}</b>
                    </div>
                  ))}
                  <small>El sistema agregará automáticamente una observación a la reserva con los productos, cantidades, total, método de pago y número de venta.</small>
                </div>
              )}

              <div className="op-plan-additional-actions">
                <button type="button" className="op-btn primary" disabled={saving || !snackCartItems.length || !snackPayment} onClick={saveSnackSale}>
                  {saving ? "Registrando venta…" : `Registrar venta · ${money(snackTotal)}`}
                </button>
              </div>

              <div className="op-snack-linked-sales">
                <div className="op-plan-additional-current-head">
                  <strong>Ventas vinculadas a esta reserva</strong>
                  <small>Si el cliente se arrepiente, puedes retirar la venta. El stock vuelve al punto de venta y el total de la reserva se corrige.</small>
                </div>

                {loadingSnackSales ? (
                  <div className="op-advanced-loading">Cargando ventas vinculadas…</div>
                ) : snackReservationSales.length === 0 ? (
                  <div className="op-plan-additional-empty">Esta reserva todavía no tiene ventas de snacks vinculadas.</div>
                ) : (
                  <div className="op-snack-linked-list">
                    {snackReservationSales.map((sale) => (
                      <div className="op-snack-linked-row" key={sale.id_venta}>
                        <div>
                          <strong>Venta #{sale.id_venta} · {money(sale.total)}</strong>
                          <small>
                            {sale.items.map((item) => `${item.cantidad}× ${item.nombre_producto}`).join(" · ")}
                          </small>
                          <small>{sale.medio_pago} · {snackLocationLabel(sale.ubicacion_codigo)}</small>
                        </div>
                        <button
                          type="button"
                          title="Quitar venta de snacks"
                          aria-label={`Quitar venta de snacks #${sale.id_venta}`}
                          disabled={saving}
                          onClick={() => removeSnackSale(sale)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="op-plan-additional-empty">No fue posible cargar la información de la reserva.</div>
          )}
        </section>
      )}

            {selected === "planes_adicionales" && (role === "administrador" || role === "atencion") && (
        <section className="op-plan-additional-section">
          <div className="op-plan-additional-title">
            <div className="op-plan-additional-icon"><PackagePlus size={19} /></div>
            <div>
              <strong>Planes adicionales</strong>
              <small>Agrega otro plan o un adicional existente a esta reserva. El valor se suma al total según la tarifa del elemento.</small>
            </div>
          </div>

          {loadingReserva || loadingPlanesAdicionales ? (
            <div className="op-advanced-loading">Cargando planes y adicionales…</div>
          ) : reserva ? (
            <>
              <div className="op-plan-additional-summary">
                <div><span>Total actual</span><b>{money(reserva.total)}</b></div>
                <div><span>Personas en la reserva</span><b>{reserva.cantidad}</b></div>
                <div><span>Agregados</span><b>{planesAdicionalesReserva.length}</b></div>
              </div>

              {opcionesDisponibles.length > 0 ? (
                <>
                  <div className="op-plan-additional-grid">
                    <label className="wide">
                      Plan o adicional *
                      <select value={planAdicionalKey} onChange={(e) => { setPlanAdicionalKey(e.target.value); setError(""); setSuccess(""); }}>
                        {opcionesDisponibles.map((opcion) => (
                          <option key={opcion.key} value={opcion.key}>
                            {opcion.origen === "plan" ? "Plan" : "Adicional"} · {opcion.nombre} · {opcion.tipo_cobro === "por_persona" ? "por persona" : "por reserva"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="op-plan-additional-choice">
                    <button type="button" className={alcancePlanAdicional === "todos" ? "active" : ""} onClick={() => { setAlcancePlanAdicional("todos"); setCantidadPlanAdicional(String(reserva.cantidad)); setError(""); }}>
                      Para todos ({reserva.cantidad})
                    </button>
                    <button type="button" disabled={reserva.cantidad <= 1} className={alcancePlanAdicional === "algunos" ? "active" : ""} onClick={() => { setAlcancePlanAdicional("algunos"); setCantidadPlanAdicional(String(Math.max(1, reserva.cantidad - 1))); setError(""); }}>
                      Solo algunas personas
                    </button>
                  </div>

                  {alcancePlanAdicional === "algunos" && reserva.cantidad > 1 && (
                    <div className="op-plan-additional-grid">
                      <label>
                        ¿Cuántas personas lo quieren? *
                        <input type="number" min={1} max={Math.max(1, reserva.cantidad - 1)} value={cantidadPlanAdicional} onChange={(e) => setCantidadPlanAdicional(e.target.value.replace(/[^0-9]/g, ""))} />
                      </label>
                    </div>
                  )}

                  {opcionPlanAdicional && previewPlanAdicional && (
                    <div className="op-plan-additional-preview">
                      <div><span>Elemento</span><b>{opcionPlanAdicional.nombre}</b><small>{opcionPlanAdicional.origen === "plan" ? "Plan" : "Adicional"} · {opcionPlanAdicional.tipo_cobro === "por_persona" ? "cobro por persona" : "cobro por reserva"}</small></div>
                      <div><span>Valor a sumar</span><b>{money(previewPlanAdicional.impacto_total)}</b><small>{previewPlanAdicional.detalle}</small></div>
                      <div><span>Nuevo total estimado</span><b>{money(reserva.total + previewPlanAdicional.impacto_total)}</b></div>
                    </div>
                  )}

                  <div className="op-plan-additional-actions">
                    <button type="button" className="op-btn primary" disabled={saving || !opcionPlanAdicional || !previewPlanAdicional} onClick={savePlanAdicional}>
                      {saving ? "Guardando…" : "Agregar a la reserva"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="op-plan-additional-empty">Todos los planes y adicionales disponibles ya fueron agregados a esta reserva.</div>
              )}

              {planesAdicionalesReserva.length > 0 && (
                <div className="op-plan-additional-current">
                  <div className="op-plan-additional-current-head"><strong>Planes adicionales de la reserva</strong><small>Estos valores ya están incluidos en el total.</small></div>
                  {planesAdicionalesReserva.map((item) => (
                    <div className="op-plan-additional-row" key={item.id_reserva_plan_adicional}>
                      <div>
                        <strong>{item.nombre}</strong>
                        <small>{item.origen === "plan" ? "Plan" : "Adicional"} · {item.aplica_todos ? "Para todos" : `${item.cantidad_personas} persona(s)`} · {item.tipo_cobro === "por_persona" ? "por persona" : "por reserva"}</small>
                      </div>
                      <b>+{money(item.impacto_total)}</b>
                      <button type="button" title="Retirar de la reserva" disabled={saving} onClick={() => removePlanAdicional(item)}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
              )}

              {error && <div className="op-advanced-error">{error}</div>}
              {success && <div className="op-advanced-success">{success}</div>}
            </>
          ) : error ? <div className="op-advanced-error">{error}</div> : null}
        </section>
      )}

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
