import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  History,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import {
  getActivityEntries,
  getActivityFilterOptions,
  type ActivityEntry,
  type ActivityFilterOptions,
} from "../services/activity.service";
import "../styles/activity.css";

const PAGE_SIZE = 50;

const actionLabels: Record<string, string> = {
  aprobar_reserva: "Aprobó reserva",
  desaprobar_reserva: "Desaprobó reserva",
  crear_reserva: "Creó reserva",
  actualizar_reserva: "Actualizó reserva",
  eliminar_reserva: "Eliminó reserva",
  cambiar_plan_reserva: "Cambió plan de reserva",
  reprogramar_reserva: "Reprogramó reserva",
  cambiar_participantes_reserva: "Cambió participantes",
  registrar_devolucion: "Registró devolución",
  actualizar_devolucion: "Actualizó devolución",
  eliminar_devolucion: "Eliminó devolución",
  crear_plan: "Creó plan",
  actualizar_plan: "Actualizó plan",
  eliminar_plan: "Eliminó plan",
  crear_participante: "Creó participante",
  actualizar_participante: "Actualizó participante",
  eliminar_participante: "Eliminó participante",
  registrar_pago_reserva: "Registró pago",
  actualizar_pago_reserva: "Actualizó pago",
  eliminar_pago_reserva: "Eliminó pago",
  registrar_venta_snack: "Registró venta de snack",
  actualizar_venta_snack: "Actualizó venta de snack",
  eliminar_venta_snack: "Eliminó venta de snack",
  crear_movimiento_inventario: "Creó movimiento de inventario",
  actualizar_inventario: "Actualizó inventario",
  eliminar_movimiento_inventario: "Eliminó movimiento de inventario",
  crear_usuario: "Creó usuario",
  editar_usuario: "Editó usuario",
  cambiar_contrasena_usuario: "Cambió contraseña",
};

const tableLabels: Record<string, string> = {
  reserva: "Reservas",
  reserva_devolucion: "Devoluciones",
  reserva_pago: "Pagos de reservas",
  participante: "Participantes",
  plan: "Planes",
  cliente: "Clientes",
  usuario_roles: "Usuarios",
  snack_venta: "Ventas de snacks",
  snack_venta_detalle: "Ventas de snacks",
  inventario_snack: "Inventario de snacks",
  guia_acceso_ventas: "Accesos de guías",
};

const roleLabels: Record<string, string> = {
  administrador: "Administrador",
  atencion: "Atención",
  coordinador: "Coordinador",
  guia: "Guía",
};

const humanize = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const actionLabel = (value: string) => actionLabels[value] ?? humanize(value);
const tableLabel = (value: string) => tableLabels[value] ?? humanize(value);
const roleLabel = (value?: string | null) => roleLabels[value ?? ""] ?? (value || "Sistema");

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
};

const hiddenKey = (key: string) =>
  /password|secret|token|authorization|service_role|api[_-]?key/i.test(key);

const formatValue = (key: string, value: unknown) => {
  if (hiddenKey(key)) return "••••••";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > 180 ? `${text.slice(0, 177)}…` : text;
  }
  const text = String(value);
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
};

const changedKeys = (entry: ActivityEntry) => {
  const keys = Object.keys(entry.cambios ?? {}).filter(
    (key) => !["updated_at", "fecha_actualizacion"].includes(key),
  );
  return keys;
};

function ChangesSummary({ entry }: { entry: ActivityEntry }) {
  if (entry.operacion === "INSERT") return <span className="activity-muted">Registro creado</span>;
  if (entry.operacion === "DELETE") return <span className="activity-muted">Registro eliminado</span>;

  const keys = changedKeys(entry);
  if (!keys.length) return <span className="activity-muted">Cambio registrado</span>;

  return (
    <span className="activity-change-summary" title={keys.map(humanize).join(", ")}>
      {keys.slice(0, 3).map(humanize).join(", ")}
      {keys.length > 3 ? ` +${keys.length - 3}` : ""}
    </span>
  );
}

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityEntry[]>([]);
  const [count, setCount] = useState(0);
  const [options, setOptions] = useState<ActivityFilterOptions>({
    users: [],
    actions: [],
    tables: [],
  });
  const [selected, setSelected] = useState<ActivityEntry | null>(null);
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [table, setTable] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadOptions = useCallback(async () => {
    try {
      setOptions(await getActivityFilterOptions());
    } catch {
      // La tabla principal mostrará el error si la auditoría aún no está instalada.
    }
  }, []);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const result = await getActivityEntries({
        userId,
        action,
        table,
        from,
        to,
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      });
      setRows(result.rows);
      setCount(result.count);
    } catch (e: any) {
      setRows([]);
      setCount(0);
      setError(
        e?.message ||
          "No fue posible cargar la actividad. Verifica que la migración de auditoría esté instalada.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, action, table, from, to, debouncedSearch, page]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const hasFilters = Boolean(userId || action || table || from || to || search.trim());

  const filteredUsers = useMemo(
    () =>
      options.users.map((user) => ({
        ...user,
        label: user.username
          ? `@${user.username} · ${user.email || roleLabel(user.role)}`
          : user.email || user.user_id,
      })),
    [options.users],
  );

  const clearFilters = () => {
    setUserId("");
    setAction("");
    setTable("");
    setFrom("");
    setTo("");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  return (
    <div className="activity-page">
      <div className="activity-head">
        <div>
          <div className="activity-title-row">
            <History size={24} />
            <h1>Actividad</h1>
          </div>
          <p>
            Historial de cambios realizados en la página. Permite identificar quién hizo cada
            modificación, cuándo la hizo y qué información cambió.
          </p>
        </div>

        <button
          className="activity-button secondary"
          onClick={() => {
            void load(true);
            void loadOptions();
          }}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "activity-spin" : ""} />
          Actualizar
        </button>
      </div>

      <section className="activity-filter-card">
        <div className="activity-filter-title">
          <Filter size={17} />
          <strong>Filtros</strong>
          <span>{count.toLocaleString("es-CO")} registros encontrados</span>
        </div>

        <div className="activity-filters">
          <label>
            Usuario
            <select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los usuarios</option>
              {filteredUsers.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Acción
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las acciones</option>
              {options.actions.map((item) => (
                <option key={item} value={item}>
                  {actionLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Módulo
            <select
              value={table}
              onChange={(e) => {
                setTable(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los módulos</option>
              {options.tables.map((item) => (
                <option key={item} value={item}>
                  {tableLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <label>
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <label className="activity-search-label">
            Buscar
            <div className="activity-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Usuario, reserva, acción, referencia…"
              />
            </div>
          </label>

          <button
            type="button"
            className="activity-button ghost"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            <X size={15} /> Limpiar
          </button>
        </div>
      </section>

      {error && <div className="activity-alert">{error}</div>}

      <section className="activity-table-card">
        <div className="activity-table-wrap">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Referencia</th>
                <th>Cambios</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="activity-empty">Cargando actividad…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="activity-empty">
                    No hay actividad que coincida con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                rows.map((entry) => (
                  <tr key={entry.id_actividad}>
                    <td className="activity-date-cell">
                      <CalendarDays size={14} />
                      {formatDateTime(entry.fecha)}
                    </td>
                    <td>
                      <div className="activity-user-cell">
                        <UserRound size={15} />
                        <div>
                          <strong>
                            {entry.actor_username
                              ? `@${entry.actor_username}`
                              : entry.actor_source === "sistema"
                                ? "Sistema"
                                : "Usuario"}
                          </strong>
                          <span>{entry.actor_email || "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="activity-role">{roleLabel(entry.actor_role)}</span>
                    </td>
                    <td>
                      <span className={`activity-action ${entry.operacion.toLowerCase()}`}>
                        {actionLabel(entry.accion)}
                      </span>
                    </td>
                    <td>{tableLabel(entry.tabla)}</td>
                    <td className="activity-reference">
                      {entry.referencia || entry.registro_id || "—"}
                    </td>
                    <td><ChangesSummary entry={entry} /></td>
                    <td>
                      <button
                        className="activity-icon-button"
                        onClick={() => setSelected(entry)}
                        title="Ver detalle"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="activity-pagination">
          <span>
            Página {page} de {totalPages} · {count.toLocaleString("es-CO")} registros
          </span>
          <div>
            <button
              className="activity-button secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              className="activity-button secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {selected && (
        <div className="activity-modal-backdrop" onMouseDown={() => setSelected(null)}>
          <div className="activity-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="activity-modal-head">
              <div>
                <span className={`activity-action ${selected.operacion.toLowerCase()}`}>
                  {actionLabel(selected.accion)}
                </span>
                <h2>Detalle de actividad</h2>
                <p>{formatDateTime(selected.fecha)}</p>
              </div>
              <button className="activity-icon-button" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="activity-meta-grid">
              <div><span>Usuario</span><strong>{selected.actor_username ? `@${selected.actor_username}` : "Sistema"}</strong></div>
              <div><span>Correo</span><strong>{selected.actor_email || "—"}</strong></div>
              <div><span>Rol</span><strong>{roleLabel(selected.actor_role)}</strong></div>
              <div><span>Módulo</span><strong>{tableLabel(selected.tabla)}</strong></div>
              <div><span>Operación</span><strong>{selected.operacion}</strong></div>
              <div><span>Referencia</span><strong>{selected.referencia || selected.registro_id || "—"}</strong></div>
            </div>

            <div className="activity-detail-section">
              <h3>
                {selected.operacion === "UPDATE"
                  ? "Campos modificados"
                  : selected.operacion === "INSERT"
                    ? "Datos creados"
                    : "Datos eliminados"}
              </h3>

              <div className="activity-diff-table-wrap">
                <table className="activity-diff-table">
                  <thead>
                    <tr>
                      <th>Campo</th>
                      {selected.operacion === "UPDATE" ? (
                        <>
                          <th>Antes</th>
                          <th>Después</th>
                        </>
                      ) : (
                        <th>Valor</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selected.cambios ?? {})
                      .filter(([key]) => !["updated_at", "fecha_actualizacion"].includes(key))
                      .map(([key, raw]) => {
                        if (selected.operacion === "UPDATE") {
                          const diff = (raw ?? {}) as { antes?: unknown; despues?: unknown };
                          return (
                            <tr key={key}>
                              <td><strong>{humanize(key)}</strong></td>
                              <td>{formatValue(key, diff.antes)}</td>
                              <td>{formatValue(key, diff.despues)}</td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={key}>
                            <td><strong>{humanize(key)}</strong></td>
                            <td>{formatValue(key, raw)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
