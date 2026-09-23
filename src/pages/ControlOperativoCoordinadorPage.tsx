import { useEffect, useMemo, useState } from "react";
import { Filter, RefreshCw, Search, X } from "lucide-react";
import {
  getControlOperativoCoordinador,
  type ControlOperativoRow,
} from "../services/controlOperativo.service";
import "../styles/control-operativo.css";
import "../styles/control-operativo-estados.css";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;
const dateOnly = (value: string) => String(value || "").slice(0, 10);
const hourOnly = (value: string) => String(value || "").slice(0, 5);

const estadoLabel = (value?: string | null) => {
  const key = String(value || "programada");
  const labels: Record<string, string> = {
    programada: "Programada",
    asistio: "Asistió",
    no_asistio: "No asistió",
    cancelada: "Cancelada",
    reprogramada: "Reprogramada",
  };
  return labels[key] || key.replaceAll("_", " ");
};

export default function ControlOperativoCoordinadorPage() {
  const [rows, setRows] = useState<ControlOperativoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [fecha, setFecha] = useState("");
  const [plan, setPlan] = useState("");
  const [estado, setEstado] = useState("");
  const [hora, setHora] = useState("");
  const [mina, setMina] = useState("");
  const [refrigerio, setRefrigerio] = useState("");
  const [restaurante, setRestaurante] = useState("");
  const [almuerzo, setAlmuerzo] = useState("");
  const [saldo, setSaldo] = useState("");

  const load = async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      setRows(await getControlOperativoCoordinador());
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar el control operativo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const planes = useMemo(
    () => [...new Set(rows.map((row) => row.plan).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "es")),
    [rows],
  );

  const horas = useMemo(
    () => [...new Set(rows.map((row) => hourOnly(row.hora)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const restaurantes = useMemo(
    () => [...new Set(rows.map((row) => row.restaurante).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "es")),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (fecha && dateOnly(row.fecha) !== fecha) return false;
      if (plan && row.plan !== plan) return false;
      if (estado && String(row.estado_operativo || "programada") !== estado) return false;
      if (hora && hourOnly(row.hora) !== hora) return false;

      if (mina === "si" && row.mina !== true) return false;
      if (mina === "no" && row.mina !== false) return false;

      if (refrigerio === "si" && row.refrigerio !== true) return false;
      if (refrigerio === "no" && row.refrigerio !== false) return false;

      if (restaurante && row.restaurante !== restaurante) return false;

      if (almuerzo === "si" && !row.incluye_almuerzo) return false;
      if (almuerzo === "no" && row.incluye_almuerzo) return false;

      if (saldo === "pendiente" && Number(row.saldo_pendiente || 0) <= 0) return false;
      if (saldo === "pagado" && Number(row.saldo_pendiente || 0) > 0) return false;

      if (!q) return true;

      return [
        row.reserva_codigo,
        row.plan,
        row.nombre,
        row.nacionalidad,
        row.tipo_documento,
        row.documento,
        row.contacto,
        row.contacto_cliente,
        row.restaurante,
        row.almuerzo,
        row.medio_abono,
        row.medio_saldo,
        row.referencia_pago_abono,
        row.observacion,
        row.estado_operativo,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [
    rows,
    search,
    fecha,
    plan,
    estado,
    hora,
    mina,
    refrigerio,
    restaurante,
    almuerzo,
    saldo,
  ]);

  const reservasUnicas = useMemo(
    () => [...new Map(filtered.map((row) => [row.id_reserva, row])).values()],
    [filtered],
  );

  const totalVentas = reservasUnicas
    .filter((row) => row.estado_operativo !== "cancelada")
    .reduce((sum, row) => sum + Number(row.total || 0), 0);

  const pendienteTotal = reservasUnicas
    .filter((row) => row.estado_operativo !== "cancelada")
    .reduce((sum, row) => sum + Number(row.saldo_pendiente || 0), 0);

  const clear = () => {
    setSearch("");
    setFecha("");
    setPlan("");
    setEstado("");
    setHora("");
    setMina("");
    setRefrigerio("");
    setRestaurante("");
    setAlmuerzo("");
    setSaldo("");
  };

  if (loading) {
    return <div className="op-loading">Cargando control operativo…</div>;
  }

  let prevReserva: number | null = null;

  return (
    <div className="op-page">
      <div className="op-head">
        <div>
          <h1>Control Operativo</h1>
          <p>Consulta completa para Coordinación. Puedes ver reservas, participantes, servicios y pagos, sin modificar información.</p>
        </div>

        <div className="op-head-actions">
          <button className="op-btn secondary" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} />
            Actualizar
          </button>
        </div>
      </div>

      {error && <div className="op-error">{error}</div>}

      <div className="op-filters">
        <div className="op-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código, nombre, documento…"
          />
        </div>

        <label>
          <span>Fecha reserva</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>

        <label>
          <span>Plan</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">Todos</option>
            {planes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span>Estado operativo</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="programada">Programada</option>
            <option value="asistio">Asistió</option>
            <option value="no_asistio">No asistió</option>
            <option value="reprogramada">Reprogramada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>

        <label>
          <span>Horario</span>
          <select value={hora} onChange={(e) => setHora(e.target.value)}>
            <option value="">Todos</option>
            {horas.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span>Mina</span>
          <select value={mina} onChange={(e) => setMina(e.target.value)}>
            <option value="">Todos</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </label>

        <label>
          <span>Refrigerio</span>
          <select value={refrigerio} onChange={(e) => setRefrigerio(e.target.value)}>
            <option value="">Todos</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </label>

        <label>
          <span>Restaurante</span>
          <select value={restaurante} onChange={(e) => setRestaurante(e.target.value)}>
            <option value="">Todos</option>
            {restaurantes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span>Almuerzo</span>
          <select value={almuerzo} onChange={(e) => setAlmuerzo(e.target.value)}>
            <option value="">Todos</option>
            <option value="si">Con almuerzo</option>
            <option value="no">Sin almuerzo</option>
          </select>
        </label>

        <label>
          <span>Saldo</span>
          <select value={saldo} onChange={(e) => setSaldo(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
          </select>
        </label>

        <button className="op-clear" onClick={clear}>
          <X size={14} />
          Limpiar
        </button>
      </div>

      <div className="op-summary">
        <span><Filter size={14} />{filtered.length} filas</span>
        <span>{reservasUnicas.length} reservas</span>
        <span>Ventas activas: <b>{money(totalVentas)}</b></span>
        <span>Saldo pendiente: <b>{money(pendienteTotal)}</b></span>
        <span>Modo: <b>Solo lectura</b></span>
      </div>

      <div className="op-table-wrap">
        <table className="op-table op-table-operational op-table-coordinator-full">
          <thead>
            <tr>
              <th>Código</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Nombre</th>
              <th>Edad</th>
              <th>Nacionalidad</th>
              <th>Documento</th>
              <th>Contacto</th>
              <th>Cant.</th>
              <th>Mina</th>
              <th>Refrigerio</th>
              <th>Restaurante</th>
              <th>Almuerzo</th>
              <th>Tipo almuerzo</th>
              <th>Total</th>
              <th>Abono</th>
              <th>Medio abono</th>
              <th>Ref. abono</th>
              <th>Pago saldo</th>
              <th>Medio saldo</th>
              <th>Pendiente</th>
              <th>Observación</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={24} className="op-coordinator-empty">
                  No hay reservas para los filtros seleccionados.
                </td>
              </tr>
            ) : filtered.map((row, index) => {
              const first = prevReserva !== row.id_reserva;
              prevReserva = row.id_reserva;

              return (
                <tr
                  key={`${row.id_reserva}-${row.id_participante ?? index}`}
                  className={`${first ? "group-start" : ""} status-row-${row.estado_operativo || "programada"}`}
                >
                  <td><strong>{row.reserva_codigo}</strong></td>
                  <td title={row.plan}>{row.plan || "—"}</td>
                  <td>
                    {first ? (
                      <span className={`op-status-badge status-${row.estado_operativo || "programada"}`}>
                        {estadoLabel(row.estado_operativo)}
                      </span>
                    ) : ""}
                  </td>
                  <td>{dateOnly(row.fecha) || "—"}</td>
                  <td>{hourOnly(row.hora) || "—"}</td>
                  <td title={row.nombre}>{row.nombre || "—"}</td>
                  <td>{row.edad ?? "—"}</td>
                  <td title={row.nacionalidad}>{row.nacionalidad || "—"}</td>
                  <td>{row.documento || "—"}</td>
                  <td>{row.contacto || row.contacto_cliente || "—"}</td>
                  <td>{first ? row.cantidad ?? "—" : ""}</td>
                  <td>{row.mina ? "SI" : "NO"}</td>
                  <td>{row.refrigerio ? "SI" : "NO"}</td>
                  <td title={row.restaurante || "—"}>{row.restaurante || "—"}</td>
                  <td>{row.incluye_almuerzo ? "Sí" : "No"}</td>
                  <td title={row.incluye_almuerzo ? row.almuerzo || "—" : "—"}>
                    {row.incluye_almuerzo ? row.almuerzo || "—" : "—"}
                  </td>
                  <td>{first ? money(row.total) : ""}</td>
                  <td>{first ? money(row.abono) : ""}</td>
                  <td title={first ? row.medio_abono : ""}>{first ? row.medio_abono || "—" : ""}</td>
                  <td className="op-reference-cell">{first ? row.referencia_pago_abono || "—" : ""}</td>
                  <td>{first ? money(row.pago_saldo) : ""}</td>
                  <td title={first ? row.medio_saldo : ""}>{first ? row.medio_saldo || "—" : ""}</td>
                  <td className={Number(row.saldo_pendiente || 0) > 0 ? "pending-money" : "paid-money"}>
                    {first ? money(row.saldo_pendiente) : ""}
                  </td>
                  <td className="op-observation-cell" title={first ? row.observacion : ""}>
                    {first ? row.observacion || "—" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
