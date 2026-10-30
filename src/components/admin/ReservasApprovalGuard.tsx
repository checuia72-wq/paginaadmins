import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Plus, Settings2, Tag, Trash2, X } from "lucide-react";
import ReservasAdmin from "./ReservasAdmin";
import { getReservas, updateReserva } from "../../services/api.service";
import { listAvailableGuides, type ManagedUser } from "../../services/adminUsers.service";
import { getMetodosPagoActivos } from "../../services/medioPago.service";
import { getRestaurantesActivos } from "../../services/restaurante.service";
import { getMenusActivosPorRestaurante, type RestauranteMenuItem } from "../../services/restauranteMenu.service";
import { replaceAbonoPagos } from "../../services/controlOperativo.service";
import {
  aprobarReservaOperativa,
  codigosCompatibles,
  getCodigosOperativos,
  type CodigoOperativo,
} from "../../services/codigoOperativo.service";
import {
  getAdicionales,
  getPlanAdicionales,
  getReservaAdicionales,
  impactoPlanAdicionalCantidad,
  maxCantidadPlanAdicional,
  normalizarCantidadPlanAdicional,
  precioEfectivoPlanAdicional,
  replaceReservaAdicionales,
  type Adicional,
  type PlanAdicional,
  type ReservaAdicional,
  type ReservaAdicionalInput,
} from "../../services/adicional.service";
import {
  agregarPlanAdicionalReserva,
  calcularImpactoPlanAdicional,
  getOpcionesPlanesAdicionales,
  getReservaPlanesAdicionales,
  retirarPlanAdicionalReserva,
  type OpcionPlanAdicional,
} from "../../services/reservaPlanAdicional.service";

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
  fecha_reserva?: string | null;
  incluye_almuerzo?: boolean | null;
  id_codigo_operativo?: number | null;
};

type AdvancedOption = "" | "refrigerio" | "adicionales" | "valor_total" | "valor_unitario";
type AbonoSplit = {
  monto: string;
  metodoPago: string;
  referencia: string;
  fechaAbono: string;
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const parseMoney = (value: string) => Number(value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.]/g, "") || 0);
const formatMoney = (value: number | null | undefined) => Number(value || 0).toLocaleString("es-CO");
const labelMetodo = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const todayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function ReservasApprovalGuard() {
  const [reservas, setReservas] = useState<ReservaLite[]>([]);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [restaurantes, setRestaurantes] = useState<string[]>([]);
  const [codigos, setCodigos] = useState<CodigoOperativo[]>([]);
  const [planAdicionales, setPlanAdicionales] = useState<PlanAdicional[]>([]);
  const [adicionalesCatalogo, setAdicionalesCatalogo] = useState<Adicional[]>([]);
  const [adicionalCantidad, setAdicionalCantidad] = useState<Record<number, number>>({});
  const [incluirAdicionales, setIncluirAdicionales] = useState(false);
  const [crearTemporal, setCrearTemporal] = useState(false);
  const [temporal, setTemporal] = useState({nombre:"",descripcion:"",precio:"",tipo:"por_persona" as "por_persona"|"por_reserva",cantidad:1});
  const [reservaAdicionalesOriginales, setReservaAdicionalesOriginales] = useState<ReservaAdicional[]>([]);
  const [planesAdicionalesDisponibles, setPlanesAdicionalesDisponibles] = useState<OpcionPlanAdicional[]>([]);
  const [planAdicionalCantidad, setPlanAdicionalCantidad] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<ReservaLite | null>(null);
  const [guias,setGuias] = useState<ManagedUser[]>([]);
  const [guiaId,setGuiaId] = useState("");
  const [buscarGuia,setBuscarGuia] = useState("");
  const [abonos, setAbonos] = useState<AbonoSplit[]>([
    { monto: "", metodoPago: "", referencia: "", fechaAbono: todayLocal() },
  ]);
  const [restaurante, setRestaurante] = useState("");
  const [menusSeleccionados, setMenusSeleccionados] = useState<(number | "")[]>([]);
  const [menusRestaurante, setMenusRestaurante] = useState<RestauranteMenuItem[]>([]);
  const [codigoId, setCodigoId] = useState<number | "">("");
  const [advancedOption, setAdvancedOption] = useState<AdvancedOption>("");
  const [incluyeRefrigerio, setIncluyeRefrigerio] = useState(true);
  const [valorTotal, setValorTotal] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedSaved, setAdvancedSaved] = useState("");

  useEffect(() => {
    listAvailableGuides().then(setGuias).catch((error)=>console.error("No se pudieron cargar los guías",error));
    Promise.all([
      getReservas(),
      getMetodosPagoActivos(),
      getRestaurantesActivos(),
      getCodigosOperativos(),
      getPlanAdicionales().catch(() => []),
      getAdicionales(true).catch(() => []),
    ])
      .then(([reservasData, metodosData, restaurantesData, codigosData, adicionalesData, catalogoData]) => {
        setReservas(Array.isArray(reservasData) ? reservasData : []);
        setMetodosPago(Array.isArray(metodosData) ? metodosData : []);
        setRestaurantes(Array.isArray(restaurantesData) ? restaurantesData : []);
        setCodigos(codigosData);
        setPlanAdicionales(adicionalesData);
        setAdicionalesCatalogo(Array.isArray(catalogoData) ? catalogoData : []);
      })
      .catch((e) => console.error("No se pudieron precargar los datos para aprobación", e));
  }, []);

  const adicionalesDelPlan = useMemo(
    () => selected ? planAdicionales.filter((item) => Number(item.id_plan) === Number(selected.id_plan) && item.activo && item.adicional.activo) : [],
    [planAdicionales, selected],
  );
  const adicionalesLibres = useMemo(() => {
    const configuredIds = new Set(adicionalesDelPlan.map((item) => Number(item.id_adicional)));
    return adicionalesCatalogo.filter((item) => item.activo && !configuredIds.has(Number(item.id_adicional)));
  }, [adicionalesCatalogo, adicionalesDelPlan]);

  const almuerzoConfigurado = useMemo(
    () => adicionalesDelPlan.find((item) => item.adicional.codigo === "almuerzo") ?? null,
    [adicionalesDelPlan],
  );

  // El plan determina si el almuerzo está incluido. El usuario no puede activarlo gratis.
  const almuerzoIncluidoPlan = adicionalesDelPlan.some((item) =>
    item.adicional.codigo === "almuerzo" && item.modalidad === "incluido"
  ) || Boolean(selected && !adicionalesDelPlan.some((item) => item.adicional.codigo === "almuerzo") &&
    codigos.some((c) => c.activo && c.id_plan === selected.id_plan && c.incluye_almuerzo) &&
    !codigos.some((c) => c.activo && c.id_plan === selected.id_plan && !c.incluye_almuerzo));

  // El almuerzo opcional no debe modificar el tipo de CH del plan contratado.
  const almuerzoAdicionalActivo = incluirAdicionales && (
    adicionalesDelPlan.some((item) =>
      item.adicional.codigo === "almuerzo" && item.modalidad === "opcional" &&
      Number(adicionalCantidad[item.id_adicional] || 0) > 0
    ) ||
    adicionalesLibres.some((item) =>
      item.codigo === "almuerzo" && Number(adicionalCantidad[item.id_adicional] || 0) > 0
    )
  );
  const cantidadAlmuerzosIncluidos = adicionalesDelPlan
    .filter((item) => item.adicional.codigo === "almuerzo" && item.modalidad === "incluido")
    .reduce((sum, item) => sum + (
      item.permitir_quitar
        ? Number(adicionalCantidad[item.id_adicional] ?? maxCantidadPlanAdicional(item, Math.max(1, Number(selected?.cantidad_personas || 1))))
        : maxCantidadPlanAdicional(item, Math.max(1, Number(selected?.cantidad_personas || 1)))
    ), 0);
  const cantidadAlmuerzosAdicionales = incluirAdicionales
    ? [...adicionalesDelPlan.filter((item) => item.adicional.codigo === "almuerzo" && item.modalidad === "opcional"),
       ...adicionalesLibres.filter((item) => item.codigo === "almuerzo")]
        .reduce((sum, item) => sum + Number(adicionalCantidad[item.id_adicional] || 0), 0)
    : 0;
  const cantidadAlmuerzos = cantidadAlmuerzosIncluidos + cantidadAlmuerzosAdicionales ||
    (almuerzoIncluidoPlan && cantidadAlmuerzosIncluidos === 0 && !almuerzoConfigurado
      ? Math.max(1, Number(selected?.cantidad_personas || 1)) : 0);
  const almuerzoParaCH = almuerzoIncluidoPlan;
  const restauranteParaCH = almuerzoParaCH ? restaurante : "";

  const opcionesCH = useMemo(
    () => selected ? codigosCompatibles(codigos, selected.id_plan, almuerzoParaCH, restauranteParaCH) : [],
    [codigos, selected, almuerzoParaCH, restauranteParaCH],
  );

  useEffect(() => {
    setMenusRestaurante([]);
    if (!selected || !restaurante || cantidadAlmuerzos <= 0) return;
    let active = true;
    getMenusActivosPorRestaurante(restaurante).then((items) => {
      if (active) setMenusRestaurante(items);
    }).catch((e) => console.warn("No se pudo consultar el menú del restaurante", e));
    return () => { active = false; };
  }, [selected, restaurante, cantidadAlmuerzos]);

  useEffect(() => {
    setMenusSeleccionados((prev) =>
      Array.from({ length: cantidadAlmuerzos }, (_, index) => prev[index] ?? "")
    );
  }, [cantidadAlmuerzos, selected]);

  useEffect(() => {
    if (!selected) return;
    if (!opcionesCH.some(c => c.id_codigo_operativo === codigoId)) {
      setCodigoId(opcionesCH[0]?.id_codigo_operativo ?? "");
    }
  }, [opcionesCH, selected, codigoId]);

  const identifyReservation = (button: HTMLElement, source: ReservaLite[] = reservas): ReservaLite | null => {
    const row = button.closest("tr");
    if (!row) return null;

    const codigo = row.querySelector("td:first-child")?.textContent?.trim() ?? "";
    if (codigo) {
      const byCode = source.find((r) => String(r.codigo_reserva ?? "").trim().toLowerCase() === codigo.toLowerCase());
      if (byCode) return byCode;

      const legacyId = Number(codigo.replace(/\D/g, ""));
      if (codigo.startsWith("#") && legacyId) {
        const byId = source.find((r) => Number(r.id_reserva) === legacyId);
        if (byId) return byId;
      }
    }

    const phone = onlyDigits(row.querySelector(".rv-phone")?.textContent ?? "");
    const candidates = source.filter((r) => onlyDigits(r.telefono_cliente) === phone && !r.aprobado);
    return candidates.length === 1 ? candidates[0] : null;
  };

  const handleClickCapture = async (event: React.MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest("button.rv-switch") as HTMLElement | null;
    if (!button || button.getAttribute("aria-checked") === "true") return;

    event.preventDefault();
    event.stopPropagation();

    let latestReservas = reservas;
    try {
      const latestData = await getReservas();
      latestReservas = Array.isArray(latestData) ? latestData : [];
      setReservas(latestReservas);
    } catch (refreshError) {
      console.error("No se pudieron refrescar las reservas antes de aprobar", refreshError);
    }

    const reserva = identifyReservation(button, latestReservas);
    if (!reserva) {
      alert("No se pudo identificar la reserva para aprobar. Actualiza la página e inténtalo nuevamente.");
      return;
    }

    const cantidad = Math.max(1, Number(reserva.cantidad_personas || 1));
    const total = Number(reserva.valor_total || 0);
    const unitario = Number(reserva.precio_unitario || (total > 0 ? total / cantidad : 0));

    const adicionalesPlan = planAdicionales.filter((item) => Number(item.id_plan) === Number(reserva.id_plan) && item.activo && item.adicional.activo);
    const [existentes, opcionesPlanExtra, planesExtraExistentes] = await Promise.all([
      getReservaAdicionales(reserva.id_reserva).catch(() => [] as ReservaAdicional[]),
      getOpcionesPlanesAdicionales(reserva.id_plan).catch(() => [] as OpcionPlanAdicional[]),
      getReservaPlanesAdicionales(reserva.id_reserva).catch(() => []),
    ]);
    const planesYaAgregados = new Set(
      planesExtraExistentes
        .filter((item) => item.origen === "plan" && item.id_plan_adicional != null)
        .map((item) => Number(item.id_plan_adicional)),
    );
    const planesDisponibles = opcionesPlanExtra.filter(
      (opcion) =>
        opcion.origen === "plan" &&
        opcion.id_plan != null &&
        !planesYaAgregados.has(Number(opcion.id_plan)),
    );
    const cantidades = Object.fromEntries(adicionalesPlan.map((item) => {
      const max = maxCantidadPlanAdicional(item, cantidad);
      const existing = existentes.find((row) => Number(row.id_adicional) === Number(item.id_adicional));
      let selectedQuantity = item.modalidad === "incluido" ? max : 0;

      if (existing?.tipo_movimiento === "agregado") selectedQuantity = Number(existing.cantidad_aplicada || 0);
      else if (existing?.tipo_movimiento === "incluido") selectedQuantity = max;
      else if (existing?.tipo_movimiento === "retirado") selectedQuantity = Math.max(0, max - Number(existing.cantidad_aplicada || 0));

      return [item.id_adicional, normalizarCantidadPlanAdicional(item, selectedQuantity, cantidad)];
    })) as Record<number, number>;

    for (const existing of existentes) {
      if (existing.tipo_movimiento !== "agregado" || existing.id_adicional == null) continue;
      if (Object.prototype.hasOwnProperty.call(cantidades, existing.id_adicional)) continue;
      cantidades[Number(existing.id_adicional)] = Math.max(0, Number(existing.cantidad_aplicada || 0));
    }

    setSelected(reserva);
    setGuiaId("");
    setBuscarGuia("");
    setAbonos([{ monto: "", metodoPago: "", referencia: "", fechaAbono: todayLocal() }]);
    setReservaAdicionalesOriginales(existentes);
    setPlanesAdicionalesDisponibles(planesDisponibles);
    setPlanAdicionalCantidad({});
    setCrearTemporal(false);
    setTemporal({nombre:"",descripcion:"",precio:"",tipo:"por_persona",cantidad:1});
    setAdicionalCantidad(cantidades);
    setIncluirAdicionales(existentes.some((row) => row.tipo_movimiento === "agregado" && Number(row.cantidad_aplicada || 0) > 0));
    setRestaurante("");
    setMenusSeleccionados([]);
    setCodigoId("");
    setAdvancedOption("");
    setIncluyeRefrigerio(true);
    setValorTotal(formatMoney(total));
    setValorUnitario(formatMoney(unitario));
    setObservacion(String(reserva.observacion ?? ""));
    setError(null);
    setAdvancedSaved("");
  };

  const closeModal = () => {
    if (!saving) {
      setSelected(null);
      setAdicionalCantidad({});
      setReservaAdicionalesOriginales([]);
      setPlanesAdicionalesDisponibles([]);
      setPlanAdicionalCantidad({});
      setIncluirAdicionales(false);
    }
  };

  const setCantidadAdicional = (item: PlanAdicional, quantity: number) => {
    const cantidadPersonas = Math.max(1, Number(selected?.cantidad_personas || 1));
    const normalized = normalizarCantidadPlanAdicional(item, quantity, cantidadPersonas);
    setAdicionalCantidad((current) => ({ ...current, [item.id_adicional]: normalized }));
    if (item.adicional.codigo === "almuerzo") {
      const hasLunch = normalized > 0;
      if (!hasLunch) setRestaurante("");
    }
    setError(null);
  };

  const setCantidadAdicionalLibre = (item: Adicional, quantity: number) => {
    const cantidadPersonas = Math.max(1, Number(selected?.cantidad_personas || 1));
    const max = item.tipo_cobro === "por_persona" ? cantidadPersonas : 1;
    const normalized = Math.min(max, Math.max(0, Math.floor(Number(quantity) || 0)));
    setAdicionalCantidad((current) => ({ ...current, [item.id_adicional]: normalized }));
    if (item.codigo === "almuerzo") {
      const hasLunch = normalized > 0;
      if (!hasLunch) setRestaurante("");
    }
    setError(null);
  };

  const guardarCambioValor = async () => {
    if (!selected) return;

    const cantidad = Math.max(1, Number(selected.cantidad_personas || 1));
    const totalNuevo = advancedOption === "valor_total"
      ? parseMoney(valorTotal)
      : advancedOption === "valor_unitario"
        ? parseMoney(valorUnitario) * cantidad
        : 0;
    const unitarioNuevo = totalNuevo / cantidad;

    if (advancedOption !== "valor_total" && advancedOption !== "valor_unitario") {
      setError("Selecciona una opción de cambio de valor.");
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
    if (!observacion.trim()) {
      setError("Debes registrar una observación explicando el cambio de valor.");
      return;
    }

    setSaving(true);
    setError(null);
    setAdvancedSaved("");

    try {
      await updateReserva(selected.id_reserva, {
        valor_total: totalNuevo,
        precio_unitario: unitarioNuevo,
        observacion: observacion.trim(),
      });

      setSelected({
        ...selected,
        valor_total: totalNuevo,
        precio_unitario: unitarioNuevo,
        observacion: observacion.trim(),
      });
      setReservas((current) => current.map((item) =>
        item.id_reserva === selected.id_reserva
          ? { ...item, valor_total: totalNuevo, precio_unitario: unitarioNuevo, observacion: observacion.trim() }
          : item
      ));
      setValorTotal(formatMoney(totalNuevo));
      setValorUnitario(formatMoney(unitarioNuevo));
      setAdvancedSaved(`Cambios guardados. Nuevo total: ${formatMoney(totalNuevo)}.`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "No fue posible guardar el nuevo valor de la reserva.");
    } finally {
      setSaving(false);
    }
  };

  const aprobarReserva = async () => {
    if (!selected) return;

    const guiaElegido = guias.find(g=>g.user_id===guiaId);
    if (!guiaElegido || !guiaElegido.telefono) { setError("Selecciona un guía con teléfono registrado antes de aprobar."); return; }
    const pagosAbono = abonos
      .map((p) => ({
        monto: parseMoney(p.monto),
        medio_pago: p.metodoPago.trim(),
        referencia: p.referencia.trim().toUpperCase(),
        fecha_abono: p.fechaAbono.trim(),
      }))
      .filter((p) => p.monto > 0 || p.medio_pago || p.referencia);
    const valor = pagosAbono.reduce((total, p) => total + p.monto, 0);
    const cantidad = Math.max(1, Number(selected.cantidad_personas || 1));
    const totalOriginal = Number(selected.valor_total || 0);
    const unitarioOriginal = Number(selected.precio_unitario || (totalOriginal > 0 ? totalOriginal / cantidad : 0));
    const impactoOriginal = reservaAdicionalesOriginales.reduce((total, item) => total + Number(item.impacto_total || 0), 0);
    const totalBaseOriginal = totalOriginal - impactoOriginal;

    const movimientosAdicionales: ReservaAdicionalInput[] = adicionalesDelPlan.flatMap<ReservaAdicionalInput>((item) => {
      const max = maxCantidadPlanAdicional(item, cantidad);
      const seleccionada = normalizarCantidadPlanAdicional(item, adicionalCantidad[item.id_adicional] ?? (item.modalidad === "incluido" ? max : 0), cantidad);
      const precio = precioEfectivoPlanAdicional(item);
      const impacto = impactoPlanAdicionalCantidad(item, seleccionada, cantidad);

      if (item.modalidad === "opcional") {
        if (!incluirAdicionales || seleccionada <= 0) return [];
        return [{
          id_adicional: item.id_adicional,
          codigo_adicional: item.adicional.codigo,
          nombre_adicional: item.adicional.nombre,
          tipo_cobro: item.adicional.tipo_cobro,
          tipo_movimiento: "agregado" as const,
          precio_unitario: precio,
          cantidad_aplicada: seleccionada,
          impacto_total: impacto,
        }];
      }

      const retiradas = max - seleccionada;
      if (retiradas > 0 && item.permitir_quitar) {
        return [{
          id_adicional: item.id_adicional,
          codigo_adicional: item.adicional.codigo,
          nombre_adicional: item.adicional.nombre,
          tipo_cobro: item.adicional.tipo_cobro,
          tipo_movimiento: "retirado" as const,
          precio_unitario: precio,
          cantidad_aplicada: retiradas,
          impacto_total: impacto,
        }];
      }

      return [{
        id_adicional: item.id_adicional,
        codigo_adicional: item.adicional.codigo,
        nombre_adicional: item.adicional.nombre,
        tipo_cobro: item.adicional.tipo_cobro,
        tipo_movimiento: "incluido" as const,
        precio_unitario: precio,
        cantidad_aplicada: max,
        impacto_total: 0,
      }];
    });

    const movimientosAdicionalesLibres: ReservaAdicionalInput[] = incluirAdicionales
      ? adicionalesLibres.flatMap<ReservaAdicionalInput>((item) => {
          const max = item.tipo_cobro === "por_persona" ? cantidad : 1;
          const seleccionada = Math.min(
            max,
            Math.max(0, Math.floor(Number(adicionalCantidad[item.id_adicional] || 0))),
          );
          if (seleccionada <= 0) return [];

          const precio = Number(item.precio || 0);
          return [{
            id_adicional: item.id_adicional,
            codigo_adicional: item.codigo,
            nombre_adicional: item.nombre,
            tipo_cobro: item.tipo_cobro,
            tipo_movimiento: "agregado" as const,
            precio_unitario: precio,
            cantidad_aplicada: seleccionada,
            impacto_total: precio * seleccionada,
          }];
        })
      : [];

    const precioTemporal = parseMoney(temporal.precio);
    const cantidadTemporal = temporal.tipo === "por_reserva" ? 1 : Math.min(cantidad, Math.max(1, Math.floor(temporal.cantidad)));
    if (crearTemporal && (!temporal.nombre.trim() || !temporal.descripcion.trim() || precioTemporal <= 0)) {
      setError("Completa nombre, observaciones (qué incluye) y precio positivo del adicional temporal.");
      return;
    }
    const movimientosTemporales: ReservaAdicionalInput[] = crearTemporal ? [{
      id_adicional:null, codigo_adicional:"temporal_reserva", nombre_adicional:temporal.nombre.trim(),
      descripcion_temporal:temporal.descripcion.trim(), tipo_cobro:temporal.tipo, tipo_movimiento:"agregado",
      precio_unitario:precioTemporal,cantidad_aplicada:cantidadTemporal,impacto_total:precioTemporal*cantidadTemporal,
    }] : [];
    const movimientosAdicionalesFinales = [...movimientosAdicionales, ...movimientosAdicionalesLibres, ...movimientosTemporales];
    const impactoAdicionales = movimientosAdicionalesFinales.reduce((total, item) => total + Number(item.impacto_total || 0), 0);

    const planesParaAgregar = planesAdicionalesDisponibles.flatMap((opcion) => {
      const personas = Math.min(
        cantidad,
        Math.max(0, Math.floor(Number(planAdicionalCantidad[opcion.key] || 0))),
      );
      if (personas <= 0) return [];
      const calculo = calcularImpactoPlanAdicional(
        opcion,
        personas,
        String(selected.fecha_reserva ?? "").slice(0, 10),
      );
      if (!Number.isFinite(calculo.impacto_total) || calculo.impacto_total <= 0) return [];
      return [{ opcion, personas, calculo }];
    });

    const impactoPlanesAdicionales = planesParaAgregar.reduce(
      (total, item) => total + Number(item.calculo.impacto_total || 0),
      0,
    );

    const totalSinPlanesAdicionales = advancedOption === "valor_total"
      ? parseMoney(valorTotal)
      : advancedOption === "valor_unitario"
        ? parseMoney(valorUnitario) * cantidad
        : totalBaseOriginal + impactoAdicionales;
    const totalNuevo = totalSinPlanesAdicionales + impactoPlanesAdicionales;
    const unitarioSinPlanesAdicionales = totalSinPlanesAdicionales / cantidad;
    const unitarioNuevo = totalNuevo / cantidad;
    const ajusteMonetario = advancedOption === "valor_total"
      ? Math.abs(totalSinPlanesAdicionales - totalOriginal) > 0.01
      : advancedOption === "valor_unitario"
        ? Math.abs(unitarioSinPlanesAdicionales - unitarioOriginal) > 0.01
        : false;

    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Ingresa al menos un valor abonado mayor a $0.");
      return;
    }
    if (!pagosAbono.length) {
      setError("Agrega al menos un método de pago para el abono.");
      return;
    }
    if (pagosAbono.some((p) => p.monto <= 0)) {
      setError("Cada método de pago debe tener un valor mayor a $0.");
      return;
    }
    if (pagosAbono.some((p) => !p.medio_pago)) {
      setError("Selecciona el método de pago de cada abono.");
      return;
    }
    if (pagosAbono.some((p) => !/^[A-Z0-9]{4}$/.test(p.referencia))) {
      setError("Cada abono debe tener los últimos 4 caracteres de su referencia.");
      return;
    }
    if (pagosAbono.some((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha_abono))) {
      setError("Selecciona la fecha de cada abono.");
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
    if (cantidadAlmuerzos > 0 && !restaurante) {
      setError("Selecciona el restaurante para la reserva con almuerzo.");
      return;
    }
    if (menusSeleccionados.slice(0, cantidadAlmuerzos).some((id) =>
      id !== "" && !menusRestaurante.some((item) => item.id_menu === id)
    )) {
      setError("Uno de los platos seleccionados no corresponde al restaurante.");
      return;
    }
    if (almuerzoAdicionalActivo && !movimientosAdicionalesFinales.some((item) =>
      item.codigo_adicional === "almuerzo" && item.tipo_movimiento === "agregado" &&
      item.cantidad_aplicada === cantidadAlmuerzosAdicionales &&
      item.impacto_total > 0 && item.precio_unitario > 0
    )) {
      setError("El almuerzo adicional debe cobrarse antes de aprobar la reserva.");
      return;
    }
    if (Number(codigos.find((item) => item.id_codigo_operativo === Number(codigoId))?.incluye_almuerzo) !== Number(almuerzoIncluidoPlan)) {
      setError("El CH debe corresponder al almuerzo incluido en el plan original.");
      return;
    }
    if (!codigoId) {
      setError("No existe un CH configurado para este plan y esta combinación. Vincúlalo primero en Códigos operativos.");
      return;
    }

    setSaving(true);
    setError(null);

    let reservaActualizada = false;
    const planesAgregadosEnIntento: number[] = [];
    try {
      const patch: Record<string, unknown> = {
        refrigerio: incluyeRefrigerio,
        referencia_pago_abono: pagosAbono.length === 1 ? pagosAbono[0].referencia : null,
        guia_user_id: guiaElegido.user_id,
        guia_username: guiaElegido.username,
        guia_telefono: guiaElegido.telefono,
      };

      if (ajusteMonetario || Math.abs(impactoAdicionales - impactoOriginal) > 0.01) {
        patch.valor_total = totalSinPlanesAdicionales;
        patch.precio_unitario = unitarioSinPlanesAdicionales;
        if (ajusteMonetario || crearTemporal) patch.observacion = [
          observacion.trim(),
          crearTemporal ? `Adicional temporal: ${temporal.nombre.trim()} (Qué incluye: ${temporal.descripcion.trim()}). ${cantidadTemporal} x ${formatMoney(precioTemporal)} = ${formatMoney(precioTemporal*cantidadTemporal)}.` : "",
        ].filter(Boolean).join("\n");
      }

      await updateReserva(selected.id_reserva, patch);
      reservaActualizada = true;
      await replaceReservaAdicionales(selected.id_reserva, movimientosAdicionalesFinales);

      for (const item of planesParaAgregar) {
        const result = await agregarPlanAdicionalReserva({
          id_reserva: selected.id_reserva,
          opcion: item.opcion,
          cantidad_personas: item.personas,
          aplica_todos: item.personas === cantidad,
          precio_unitario: item.calculo.precio_unitario,
          impacto_total: item.calculo.impacto_total,
        });
        if (result.id_reserva_plan_adicional) {
          planesAgregadosEnIntento.push(result.id_reserva_plan_adicional);
        }
      }

      await replaceAbonoPagos(selected.id_reserva, pagosAbono);

      await aprobarReservaOperativa({
        id_reserva: selected.id_reserva,
        valor_abonado: valor,
        metodo_pago: pagosAbono[0].medio_pago,
        incluye_almuerzo: almuerzoParaCH,
        restaurante: restauranteParaCH || null,
        id_codigo_operativo: Number(codigoId),
      });

      // Datos del adicional en columnas independientes: no volver a generar el CH.
      if (almuerzoAdicionalActivo) {
        await updateReserva(selected.id_reserva, {
          almuerzo_adicional: true,
          restaurante_almuerzo_adicional: restaurante,
          id_menu_almuerzo_adicional: menusSeleccionados[0] || null,
          seleccion_almuerzos: menusSeleccionados.slice(0, cantidadAlmuerzos).map((id_menu, index) => ({ numero: index + 1, id_menu: id_menu || null })),
          // Mantiene compatibilidad con el control operativo de almuerzos.
          // El CH ya fue emitido para el plan base y no se vuelve a generar.
          incluye_almuerzo: true,
          restaurante,
        });
      } else {
        await updateReserva(selected.id_reserva, {
          almuerzo_adicional: false,
          restaurante_almuerzo_adicional: null,
          id_menu_almuerzo_adicional: null,
          seleccion_almuerzos: menusSeleccionados.slice(0, cantidadAlmuerzos).map((id_menu, index) => ({ numero: index + 1, id_menu: id_menu || null })),
        });
      }

      setSelected(null);
      window.location.reload();
    } catch (e: any) {
      console.error(e);

      if (planesAgregadosEnIntento.length) {
        for (const id of [...planesAgregadosEnIntento].reverse()) {
          try {
            await retirarPlanAdicionalReserva(id);
          } catch (rollbackPlanError) {
            console.error("No se pudo retirar un plan adicional durante la reversión:", rollbackPlanError);
          }
        }
      }

      if (reservaActualizada) {
        try {
          await updateReserva(selected.id_reserva, {
            valor_total: totalOriginal,
            precio_unitario: unitarioOriginal,
            refrigerio: selected.refrigerio ?? false,
            referencia_pago_abono: selected.referencia_pago_abono ?? null,
            observacion: selected.observacion ?? null,
          });
          await replaceReservaAdicionales(selected.id_reserva, reservaAdicionalesOriginales);
          await replaceAbonoPagos(selected.id_reserva, []);
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
  const impactoOriginalVista = reservaAdicionalesOriginales.reduce((total, item) => total + Number(item.impacto_total || 0), 0);
  const totalBaseOriginalVista = Number(selected?.valor_total || 0) - impactoOriginalVista;
  const impactoAdicionalesVista = adicionalesDelPlan.reduce((total, item) => {
    const quantity = item.modalidad === "opcional" && !incluirAdicionales
      ? 0
      : adicionalCantidad[item.id_adicional] ?? (item.modalidad === "incluido" ? maxCantidadPlanAdicional(item, cantidadSeleccionada) : 0);

    return total + impactoPlanAdicionalCantidad(
      item,
      quantity,
      cantidadSeleccionada,
    );
  }, 0);
  const impactoAdicionalesLibresVista = incluirAdicionales
    ? adicionalesLibres.reduce((total, item) => {
        const max = item.tipo_cobro === "por_persona" ? cantidadSeleccionada : 1;
        const quantity = Math.min(
          max,
          Math.max(0, Math.floor(Number(adicionalCantidad[item.id_adicional] || 0))),
        );
        return total + Number(item.precio || 0) * quantity;
      }, 0)
    : 0;
  const precioTemporalVista = parseMoney(temporal.precio);
  const cantidadTemporalVista = temporal.tipo === "por_reserva" ? 1 : Math.min(cantidadSeleccionada,Math.max(1,Math.floor(temporal.cantidad)));
  const impactoTemporalVista = crearTemporal ? precioTemporalVista * cantidadTemporalVista : 0;
  const impactoAdicionalesTotalVista = impactoAdicionalesVista + impactoAdicionalesLibresVista + impactoTemporalVista;
  const planesAdicionalesSeleccionadosVista = planesAdicionalesDisponibles.flatMap((opcion) => {
    const personas = Math.min(
      cantidadSeleccionada,
      Math.max(0, Math.floor(Number(planAdicionalCantidad[opcion.key] || 0))),
    );
    if (personas <= 0) return [];
    const calculo = calcularImpactoPlanAdicional(
      opcion,
      personas,
      String(selected?.fecha_reserva ?? "").slice(0, 10),
    );
    return [{ opcion, personas, calculo }];
  });
  const impactoPlanesAdicionalesVista = planesAdicionalesSeleccionadosVista.reduce(
    (total, item) => total + Number(item.calculo.impacto_total || 0),
    0,
  );

  const totalBaseVista = advancedOption === "valor_unitario"
    ? parseMoney(valorUnitario) * cantidadSeleccionada
    : advancedOption === "valor_total"
      ? parseMoney(valorTotal)
      : totalBaseOriginalVista + impactoAdicionalesTotalVista;
  const totalVista = totalBaseVista + impactoPlanesAdicionalesVista;
  const unitarioVista = totalVista / cantidadSeleccionada;

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
                    setAdvancedSaved("");
                  }}
                  disabled={saving}
                  style={{ width: "100%" }}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="refrigerio">Refrigerio</option>
                  <option value="adicionales">Adicionales</option>
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
                          setAdvancedSaved("");
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
                      onChange={(e) => { setObservacion(e.target.value); setError(null); setAdvancedSaved(""); }}
                      placeholder="Ej. Tarifa especial, descuento autorizado o ajuste operativo."
                      rows={3}
                      disabled={saving}
                      style={{ resize: "vertical", minHeight: 82 }}
                    />
                  </div>

                  <button
                    type="button"
                    className="rv-btn-save"
                    onClick={guardarCambioValor}
                    disabled={saving}
                    style={{ justifySelf: "start" }}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                  {advancedSaved && <div className="rv-approval-success">{advancedSaved}</div>}
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
                          setAdvancedSaved("");
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

                  <button
                    type="button"
                    className="rv-btn-save"
                    onClick={guardarCambioValor}
                    disabled={saving}
                    style={{ justifySelf: "start" }}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                  {advancedSaved && <div className="rv-approval-success">{advancedSaved}</div>}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <strong style={{ display: "block", color: "#3b3127", fontSize: 14 }}>Abono de la reserva</strong>
                  <small style={{ color: "#877967" }}>Puedes dividir el abono entre varios métodos de pago, cada uno con su propia referencia.</small>
                </div>
                <button
                  type="button"
                  className="rv-btn-cancel"
                  disabled={saving}
                  onClick={() => setAbonos((current) => [...current, { monto: "", metodoPago: "", referencia: "", fechaAbono: todayLocal() }])}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Plus size={15}/> Añadir método
                </button>
              </div>

              {abonos.map((pago, index) => (
                <div
                  key={index}
                  className="rv-approval-grid"
                  style={{
                    padding: 12,
                    border: "1px solid #e7dac6",
                    borderRadius: 12,
                    background: "#fff",
                    alignItems: "end",
                  }}
                >
                  <div className="rv-form-group">
                    <label>Valor abonado *</label>
                    <div className="rv-money-input-wrap">
                      <span>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus={index === 0}
                        value={pago.monto}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setAbonos((current) => current.map((item, i) =>
                            i === index
                              ? { ...item, monto: digits ? Number(digits).toLocaleString("es-CO") : "" }
                              : item
                          ));
                          setError(null);
                        }}
                        placeholder="0"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="rv-form-group">
                    <label>Método de pago *</label>
                    <select
                      value={pago.metodoPago}
                      onChange={(e) => {
                        setAbonos((current) => current.map((item, i) =>
                          i === index ? { ...item, metodoPago: e.target.value } : item
                        ));
                        setError(null);
                      }}
                      disabled={saving}
                    >
                      <option value="">Seleccionar método de pago</option>
                      {metodosPago.map((m) => <option key={m} value={m}>{labelMetodo(m)}</option>)}
                    </select>
                  </div>

                  <div className="rv-form-group">
                    <label>Referencia *</label>
                    <input
                      type="text"
                      value={pago.referencia}
                      maxLength={4}
                      autoComplete="off"
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
                        setAbonos((current) => current.map((item, i) =>
                          i === index ? { ...item, referencia: clean } : item
                        ));
                        setError(null);
                      }}
                      placeholder="Ej. A7F3"
                      disabled={saving}
                      style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}
                    />
                  </div>

                  <div className="rv-form-group">
                    <label>Fecha de abono *</label>
                    <input
                      type="date"
                      value={pago.fechaAbono}
                      onChange={(e) => {
                        setAbonos((current) => current.map((item, i) =>
                          i === index ? { ...item, fechaAbono: e.target.value } : item
                        ));
                        setError(null);
                      }}
                      disabled={saving}
                    />
                  </div>

                  {abonos.length > 1 && (
                    <button
                      type="button"
                      className="rv-btn-cancel"
                      onClick={() => setAbonos((current) => current.filter((_, i) => i !== index))}
                      disabled={saving}
                      title="Quitar método"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 42 }}
                    >
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              ))}

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: "#fff8ec",
                border: "1px solid #ead9bf",
                fontSize: 13,
              }}>
                <span style={{ color: "#6f665d", fontWeight: 700 }}>Total abonado</span>
                <strong style={{ color: "#2d241a" }}>
                  ${formatMoney(abonos.reduce((total, item) => total + parseMoney(item.monto), 0))}
                </strong>
              </div>
            </div>

            <div style={{padding:16,border:"1px solid #dbe7dc",background:"#f7fbf7",borderRadius:12,marginTop:12,display:"grid",gap:10}}>
              <strong style={{color:"#245238"}}>Guía acompañante de la reserva</strong>
              <div className="rv-form-group" style={{display:"grid",gap:8}}>
                <label htmlFor="buscar-acompanante">Buscar acompañante por usuario *</label>
                <input id="buscar-acompanante" type="search" value={buscarGuia} disabled={saving}
                  onChange={e=>setBuscarGuia(e.target.value)} placeholder="Escribe el nombre de usuario..."
                  style={{width:"100%",minHeight:42,padding:"10px 12px",border:"1px solid #cdded0",borderRadius:9,background:"#fff",color:"#284634",boxSizing:"border-box"}} />
                <label htmlFor="seleccionar-acompanante">Usuario acompañante *</label>
                <select id="seleccionar-acompanante" value={guiaId} disabled={saving}
                  onChange={e=>setGuiaId(e.target.value)}
                  style={{width:"100%",minHeight:44,padding:"10px 12px",border:"1px solid #cdded0",borderRadius:9,background:"#fff",color:"#284634"}}>
                  <option value="">Selecciona el usuario que acompañará esta reserva</option>
                  {guias.filter(g=>g.user_id===guiaId || g.username.toLowerCase().includes(buscarGuia.trim().toLowerCase())).map(g=>
                    <option key={g.user_id} value={g.user_id}>@{g.username}{g.telefono ? ` · ${g.telefono}` : " · Sin teléfono"}</option>
                  )}
                </select>
                <small style={{color:"#6b796e"}}>Se muestran todos los usuarios del sistema, independientemente de su rol.</small>
              </div>
              {guiaId && <small style={{color:"#526e5a"}}>Teléfono del guía: {guias.find(g=>g.user_id===guiaId)?.telefono || "Pendiente de registrar en Usuarios"}</small>}
            </div>
            {advancedOption === "adicionales" && (
              <div style={{ display: "grid", gap: 10 }}>
                {true ? (
                  <div style={{ border: "1px solid #e4ddd4", borderRadius: 14, padding: 14, background: "#fff" }}>
                    <div style={{ marginBottom: 12 }}>
                      <strong style={{ display: "block", fontSize: 15 }}>Adicionales y planes adicionales</strong>
                      <small style={{ color: "#81776c" }}>
                        Puedes agregar servicios del catálogo o incluso otro plan. Todo lo seleccionado se suma automáticamente al valor total antes de aprobar.
                      </small>
                    </div>

                    <div className="rv-form-group" style={{ marginBottom: 12 }}>
                      <label>¿Deseas incluir adicionales del catálogo?</label>
                      <select
                        value={incluirAdicionales ? "si" : "no"}
                        onChange={(e) => {
                          const enabled = e.target.value === "si";
                          setIncluirAdicionales(enabled);
                          if (!enabled) {
                            if (!almuerzoConfigurado || almuerzoConfigurado.modalidad === "opcional") {
                              setRestaurante("");
                            }
                            setAdicionalCantidad((current) => {
                              const next = { ...current };
                              for (const item of adicionalesDelPlan) {
                                if (item.modalidad === "opcional") next[item.id_adicional] = 0;
                              }
                              for (const item of adicionalesLibres) {
                                next[item.id_adicional] = 0;
                              }
                              return next;
                            });
                          }
                          setError(null);
                        }}
                        disabled={saving}
                      >
                        <option value="no">No</option>
                        <option value="si">Sí</option>
                      </select>
                    </div>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      marginBottom: 12,
                      borderRadius: 10,
                      background: "#fff8ec",
                      border: "1px solid #ead9bf",
                    }}>
                      <span style={{ fontSize: 12, color: "#6f665d", fontWeight: 700 }}>
                        Total actual de la reserva
                      </span>
                      <strong style={{ color: "#2d241a", fontSize: 18 }}>${formatMoney(totalVista)}</strong>
                    </div>

                    <div style={{ display: "grid", gap: 9 }}>
                      <div style={{display:"grid",gap:12,padding:16,border:"1px solid #ead9bf",borderRadius:12,background:"#fffaf3"}}>
                        <label style={{display:"flex",gap:10,alignItems:"center",cursor:"pointer",fontWeight:700,color:"#4a3929"}}>
                          <input type="checkbox" checked={crearTemporal} onChange={e=>setCrearTemporal(e.target.checked)} disabled={saving}/>
                          Crear adicional temporal para esta reserva
                        </label>
                        {crearTemporal && <div style={{display:"grid",gap:12}}>
                          <div className="rv-form-group"><label>Nombre del adicional *</label><input style={{width:"100%",minHeight:40,padding:"9px 12px",border:"1px solid #dcd4ca",borderRadius:8,background:"#fff",color:"#2d241a",boxSizing:"border-box"}} placeholder="Ej. Servicio de fotografía" value={temporal.nombre} onChange={e=>setTemporal(v=>({...v,nombre:e.target.value}))}/></div>
                          <div className="rv-form-group"><label>Observaciones (qué incluye) *</label><textarea rows={3} style={{width:"100%",minHeight:90,padding:"10px 12px",border:"1px solid #dcd4ca",borderRadius:8,background:"#fff",color:"#2d241a",boxSizing:"border-box",resize:"vertical"}} placeholder="Describe detalladamente qué incluye el adicional" value={temporal.descripcion} onChange={e=>setTemporal(v=>({...v,descripcion:e.target.value}))}/></div>
                          <div className="rv-form-group"><label>Precio unitario (COP) *</label><input style={{width:"100%",minHeight:40,padding:"9px 12px",border:"1px solid #dcd4ca",borderRadius:8,background:"#fff",color:"#2d241a",boxSizing:"border-box"}} placeholder="Ej. 25000" value={temporal.precio} onChange={e=>setTemporal(v=>({...v,precio:e.target.value}))} inputMode="numeric"/></div>
                          <div className="rv-form-group"><label>Tipo de cobro</label><select style={{width:"100%",minHeight:40,padding:"8px 12px",border:"1px solid #dcd4ca",borderRadius:8,background:"#fff",color:"#2d241a"}} value={temporal.tipo} onChange={e=>setTemporal(v=>({...v,tipo:e.target.value as "por_persona"|"por_reserva",cantidad:1}))}><option value="por_persona">Por persona</option><option value="por_reserva">Por reserva</option></select></div>
                          {temporal.tipo==="por_persona" && <div className="rv-form-group"><label>Cantidad de personas</label><select style={{width:"100%",minHeight:40,padding:"8px 12px",border:"1px solid #dcd4ca",borderRadius:8,background:"#fff",color:"#2d241a"}} value={temporal.cantidad} onChange={e=>setTemporal(v=>({...v,cantidad:Number(e.target.value)}))}>{Array.from({length:cantidadSeleccionada},(_,i)=><option key={i+1} value={i+1}>{i+1} / {cantidadSeleccionada}</option>)}</select></div>}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 12px",borderRadius:10,background:"#fff3df",border:"1px solid #ead9bf"}}><span style={{fontSize:13,fontWeight:700,color:"#6f665d"}}>Total del adicional</span><strong style={{fontSize:18,color:"#2d241a"}}>$${formatMoney(impactoTemporalVista)}</strong></div>
                          <small style={{color:"#81776c"}}>Solo se agregará a esta reserva; no aparecerá en el catálogo general.</small>
                        </div>}
                      </div>

                  <details style={{border:"1px solid #e4ddd4",borderRadius:12,padding:12,background:"#fff"}}>
                    <summary style={{cursor:"pointer",fontWeight:700,color:"#5b5147",padding:"5px 0"}}>Desplegar / plegar adicionales ({adicionalesDelPlan.length + adicionalesLibres.length})</summary>
                    <div style={{display:"grid",gap:10,marginTop:12}}>
                  {adicionalesDelPlan.length > 0 && (
                    <div style={{ margin: "2px 0 4px" }}>
                      <strong style={{ display: "block", fontSize: 13, color: "#5b5147" }}>
                        Adicionales configurados para este plan
                      </strong>
                      <small style={{ color: "#82786d" }}>
                        Aquí aparecen los servicios incluidos u opcionales vinculados directamente al plan.
                      </small>
                    </div>
                  )}

                  {adicionalesDelPlan.map((item) => {
                    const max = maxCantidadPlanAdicional(item, cantidadSeleccionada);
                    const quantity = normalizarCantidadPlanAdicional(
                      item,
                      item.modalidad === "opcional" && !incluirAdicionales
                        ? 0
                        : adicionalCantidad[item.id_adicional] ?? (item.modalidad === "incluido" ? max : 0),
                      cantidadSeleccionada,
                    );
                    const precio = precioEfectivoPlanAdicional(item);
                    const impacto = impactoPlanAdicionalCantidad(item, quantity, cantidadSeleccionada);
                    const locked = item.modalidad === "incluido" && !item.permitir_quitar;
                    const perPerson = item.adicional.tipo_cobro === "por_persona";
                    return (
                      <div key={item.id_adicional} style={{ display: "grid", gap: 8, padding: "10px 11px", border: "1px solid #eee7de", borderRadius: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <span>
                            <strong style={{ display: "block" }}>{item.adicional.nombre}</strong>
                            <small style={{ color: "#82786d" }}>{item.modalidad === "incluido" ? "Incluido en el plan" : "Opcional"} · ${formatMoney(precio)} {perPerson ? "por persona" : "por reserva"}</small>
                          </span>
                          <strong style={{ color: impacto > 0 ? "#2f765b" : impacto < 0 ? "#a04b3d" : "#82786d", whiteSpace: "nowrap" }}>
                            {impacto > 0 ? "+" : impacto < 0 ? "−" : ""}${formatMoney(Math.abs(impacto))}
                          </strong>
                        </div>
                        {locked ? (
                          <small style={{ color: "#2f765b", fontWeight: 700 }}>Incluido para {max} {perPerson ? (max === 1 ? "persona" : "personas") : "reserva"}.</small>
                        ) : perPerson ? (
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <small style={{ color: "#6f665d", fontWeight: 700 }}>{item.modalidad === "incluido" ? "Personas que mantienen el servicio" : "Personas que lo quieren"}</small>
                            <select value={quantity} disabled={saving || (item.modalidad === "opcional" && !incluirAdicionales)} onChange={(e) => setCantidadAdicional(item, Number(e.target.value))}>
                              {Array.from({ length: max + 1 }, (_, value) => <option key={value} value={value}>{value} / {max}</option>)}
                            </select>
                          </label>
                        ) : (
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <small style={{ color: "#6f665d", fontWeight: 700 }}>{item.modalidad === "incluido" ? "Mantener servicio" : "Agregar servicio"}</small>
                            <input type="checkbox" checked={quantity > 0} disabled={saving || (item.modalidad === "opcional" && !incluirAdicionales)} onChange={(e) => setCantidadAdicional(item, e.target.checked ? 1 : 0)}/>
                          </label>
                        )}
                      </div>
                    );
                  })}

                  {adicionalesLibres.length > 0 && (
                    <>
                      <div style={{ margin: "5px 0 2px", paddingTop: 8, borderTop: adicionalesDelPlan.length ? "1px solid #eee7de" : "none" }}>
                        <strong style={{ display: "block", fontSize: 13, color: "#5b5147" }}>
                          Todos los demás adicionales disponibles
                        </strong>
                        <small style={{ color: "#82786d" }}>
                          Esta lista muestra todos los adicionales activos del catálogo, aunque no estén vinculados originalmente al plan.
                        </small>
                      </div>

                      {adicionalesLibres.map((item) => {
                        const perPerson = item.tipo_cobro === "por_persona";
                        const max = perPerson ? cantidadSeleccionada : 1;
                        const quantity = incluirAdicionales
                          ? Math.min(
                              max,
                              Math.max(0, Math.floor(Number(adicionalCantidad[item.id_adicional] || 0))),
                            )
                          : 0;
                        const impacto = Number(item.precio || 0) * quantity;

                        return (
                          <div
                            key={`libre-${item.id_adicional}`}
                            style={{
                              display: "grid",
                              gap: 8,
                              padding: "10px 11px",
                              border: "1px solid #eee7de",
                              borderRadius: 10,
                              opacity: incluirAdicionales ? 1 : 0.72,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <span>
                                <strong style={{ display: "block" }}>{item.nombre}</strong>
                                <small style={{ color: "#82786d" }}>
                                  Catálogo general · Opcional · ${formatMoney(item.precio)} {perPerson ? "por persona" : "por reserva"}
                                </small>
                              </span>
                              <strong style={{ color: impacto > 0 ? "#2f765b" : "#82786d", whiteSpace: "nowrap" }}>
                                {impacto > 0 ? "+" : ""}${formatMoney(impacto)}
                              </strong>
                            </div>

                            {perPerson ? (
                              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <small style={{ color: "#6f665d", fontWeight: 700 }}>Personas que lo quieren</small>
                                <select
                                  value={quantity}
                                  disabled={saving || !incluirAdicionales}
                                  onChange={(e) => setCantidadAdicionalLibre(item, Number(e.target.value))}
                                >
                                  {Array.from({ length: max + 1 }, (_, value) => (
                                    <option key={value} value={value}>{value} / {max}</option>
                                  ))}
                                </select>
                              </label>
                            ) : (
                              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <small style={{ color: "#6f665d", fontWeight: 700 }}>Agregar servicio</small>
                                <input
                                  type="checkbox"
                                  checked={quantity > 0}
                                  disabled={saving || !incluirAdicionales}
                                  onChange={(e) => setCantidadAdicionalLibre(item, e.target.checked ? 1 : 0)}
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                    </div>
                  </details>

                  {planesAdicionalesDisponibles.length > 0 && (
                    <details style={{border:"1px solid #e4ddd4",borderRadius:12,padding:12,background:"#fff"}}>
                      <summary style={{cursor:"pointer",fontWeight:700,color:"#5b5147",padding:"5px 0"}}>Desplegar / plegar planes adicionales ({planesAdicionalesDisponibles.length})</summary>
                      <div style={{display:"grid",gap:10,marginTop:12}}>
                      <div style={{ margin: "8px 0 2px", paddingTop: 10, borderTop: "1px solid #e4ddd4" }}>
                        <strong style={{ display: "block", fontSize: 13, color: "#5b5147" }}>
                          Planes adicionales disponibles
                        </strong>
                        <small style={{ color: "#82786d" }}>
                          Selecciona cuántas personas tomarán cada plan adicional. Puedes agregar más de uno en la misma reserva.
                        </small>
                      </div>

                      {planesAdicionalesDisponibles.map((opcion) => {
                        const personas = Math.min(
                          cantidadSeleccionada,
                          Math.max(0, Math.floor(Number(planAdicionalCantidad[opcion.key] || 0))),
                        );
                        const calculo = personas > 0
                          ? calcularImpactoPlanAdicional(
                              opcion,
                              personas,
                              String(selected?.fecha_reserva ?? "").slice(0, 10),
                            )
                          : null;

                        return (
                          <div
                            key={opcion.key}
                            style={{
                              display: "grid",
                              gap: 8,
                              padding: "10px 11px",
                              border: "1px solid #dfe8e2",
                              borderRadius: 10,
                              background: personas > 0 ? "#f6fbf8" : "#fff",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <span style={{ minWidth: 0 }}>
                                <strong style={{ display: "block" }}>{opcion.nombre}</strong>
                                <small style={{ color: "#82786d", display: "block" }}>
                                  Plan adicional · {opcion.tipo_cobro === "por_persona" ? "cobro por persona" : "cobro por reserva"}
                                </small>
                                {opcion.descripcion && (
                                  <small style={{ color: "#9a8f82", display: "block", marginTop: 2 }}>
                                    {opcion.descripcion}
                                  </small>
                                )}
                              </span>
                              <strong style={{ color: calculo && calculo.impacto_total > 0 ? "#2f765b" : "#82786d", whiteSpace: "nowrap" }}>
                                {calculo && calculo.impacto_total > 0 ? "+" : ""}${formatMoney(calculo?.impacto_total ?? 0)}
                              </strong>
                            </div>

                            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                              <small style={{ color: "#6f665d", fontWeight: 700 }}>Personas que tomarán este plan</small>
                              <select
                                value={personas}
                                disabled={saving}
                                onChange={(e) => {
                                  const value = Math.min(
                                    cantidadSeleccionada,
                                    Math.max(0, Math.floor(Number(e.target.value) || 0)),
                                  );
                                  setPlanAdicionalCantidad((current) => ({
                                    ...current,
                                    [opcion.key]: value,
                                  }));
                                  setError(null);
                                }}
                              >
                                <option value={0}>No agregar</option>
                                {Array.from({ length: cantidadSeleccionada }, (_, index) => index + 1).map((value) => (
                                  <option key={value} value={value}>
                                    {value} / {cantidadSeleccionada}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {calculo && (
                              <small style={{ color: "#6f665d" }}>
                                {calculo.detalle}
                              </small>
                            )}
                          </div>
                        );
                      })}
                      </div>
                    </details>
                  )}
                  </div>
                  </div>
                ) : (
                  <div style={{
                    padding: 14,
                    border: "1px solid #e4ddd4",
                    borderRadius: 12,
                    background: "#fff",
                    color: "#81776c",
                    fontSize: 13,
                  }}>
                    No hay adicionales ni planes adicionales activos disponibles para esta reserva.
                  </div>
                )}
              </div>
            )}

            <div className="rv-approval-note" style={{ marginTop: 14 }}>
              <div className="rv-approval-note-icon"><Tag size={18}/></div>
              <span>El CH se calcula según el plan base. Comprar almuerzo como adicional no cambia el CH del plan original.</span>
            </div>

            <div className="rv-approval-grid" style={{ marginTop: 14 }}>
              <div className="rv-form-group">
                <label>¿El plan incluye almuerzo?</label>
                <select
                  value={almuerzoIncluidoPlan ? "si" : "no"}
                  disabled
                >
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </div>

              <div className="rv-form-group">
                <label>Restaurante {cantidadAlmuerzos > 0 ? "*" : ""}</label>
                <select disabled={cantidadAlmuerzos === 0} value={restaurante} onChange={(e) => { setRestaurante(e.target.value); setError(null); }}>
                  <option value="">Seleccionar restaurante</option>
                  {restaurantes.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {cantidadAlmuerzos > 0 && (
                <div className="rv-form-group" style={{ gridColumn: "1 / -1", display: "grid", gap: 10 }}>
                  <label>Tipos de almuerzo ({cantidadAlmuerzos} en total, opcional)</label>
                  <small>Puedes elegir los platos ahora o confirmar la reserva sin definirlos.</small>
                  {Array.from({ length: cantidadAlmuerzos }, (_, index) => (
                    <label key={index} style={{ display: "grid", gap: 4 }}>
                      Almuerzo {index + 1}
                      <select
                        value={menusSeleccionados[index] ?? ""}
                        disabled={!restaurante || saving}
                        onChange={(e) => setMenusSeleccionados((prev) => {
                          const next = [...prev];
                          next[index] = e.target.value ? Number(e.target.value) : "";
                          return next;
                        })}
                      >
                        <option value="">Pendiente por elegir</option>
                        {menusRestaurante.map((item) => (
                          <option key={item.id_menu} value={item.id_menu}>{item.nombre_plato}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

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
