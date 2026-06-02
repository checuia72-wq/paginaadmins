import { useEffect, useState, useRef } from "react";
import {
  getReservas,
  createReserva,
  updateReserva,
  deleteReserva,
  getPlanes,
  getClientes,
} from "../../services/api.service";
import {
  Plus, Eye, Pencil, Trash2, Search, X,
  ChevronLeft, ChevronRight, Phone, CheckCircle, Clock, Users, Calendar,
  MoreVertical,
} from "lucide-react";
import "../../styles/reservas.css";

/* ── Tipos ─────────────────────────────────── */
interface Reserva {
  id_reserva: number;
  fecha_solicitud?: string | null;
  fecha_aprobacion?: string | null;
  telefono_cliente: string;
  id_plan: number;
  nombre_plan?: string;
  cantidad_personas?: number | null;
  aprobado?: boolean | null;
}

interface Plan {
  id_plan: number;
  nombre_plan: string;
}

const emptyForm = {
  telefono_cliente: "",
  id_plan: "" as number | "",
  cantidad_personas: "" as number | "",
  aprobado: false,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function fmt(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Componente ────────────────────────────── */
export default function ReservasAdmin() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [clientes, setClientes] = useState<{ telefono: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "aprobado" | "pendiente">("todos");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Modal form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reserva | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [telefonoError, setTelefonoError] = useState<string | null>(null);

  // Modal ver
  const [viewing, setViewing] = useState<Reserva | null>(null);

  // Confirmación de aprobar/desaprobar (toggle)
  const [confirmAprobar, setConfirmAprobar] = useState<Reserva | null>(null);
  const [togglingAprobar, setTogglingAprobar] = useState(false);

  // Menú de acciones (móvil)
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* ── Fetch ──────────────────────────────── */
  const fetchAll = async () => {
    try {
      setLoading(true);
      const [r, p, c] = await Promise.all([getReservas(), getPlanes(), getClientes()]);
      setReservas(r);
      setPlanes(p);
      setClientes(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Cerrar el menú al hacer clic fuera
  useEffect(() => {
    if (openMenu == null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  /* ── Helpers ────────────────────────────── */
  const openCreate = () => {
    setEditing(null);
    setFormData(emptyForm);
    setTelefonoError(null);
    setShowForm(true);
  };

  const openEdit = (r: Reserva) => {
    setOpenMenu(null);
    setEditing(r);
    setFormData({
      telefono_cliente: r.telefono_cliente,
      id_plan: r.id_plan,
      cantidad_personas: r.cantidad_personas ?? "",
      aprobado: r.aprobado ?? false,
    });
    setTelefonoError(null);
    setShowForm(true);
  };

  const openView = (r: Reserva) => {
    setOpenMenu(null);
    setViewing(r);
  };

  const handleSave = async () => {
    setTelefonoError(null);
    const tel = formData.telefono_cliente.trim();
    if (!tel || formData.id_plan === "") return;

    // Validación previa: el teléfono debe existir como cliente.
    const existe = clientes.some((c) => c.telefono === tel);
    if (!existe) {
      setTelefonoError("Teléfono no registrado. Debes crear el cliente primero.");
      return;
    }

    setSaving(true);
    try {
      // Calcular fecha_aprobacion según el estado:
      // - Si se aprueba y no tenía fecha previa → ahora.
      // - Si se aprueba y ya tenía fecha → conservarla.
      // - Si queda como pendiente → limpiar la fecha.
      let fecha_aprobacion: string | null = null;
      if (formData.aprobado) {
        fecha_aprobacion = editing?.fecha_aprobacion ?? new Date().toISOString();
      }

      const payload = {
        telefono_cliente: tel,
        id_plan: Number(formData.id_plan),
        cantidad_personas: formData.cantidad_personas !== "" ? Number(formData.cantidad_personas) : null,
        aprobado: formData.aprobado,
        fecha_aprobacion,
      };
      if (editing) {
        await updateReserva(editing.id_reserva, payload);
      } else {
        await createReserva(payload);
      }
      setShowForm(false);
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message ?? "");
      // Respaldo: si la BD rechaza por la llave foránea del cliente,
      // mostrarlo bajo el campo en lugar de un alert con jerga técnica.
      if (msg.includes("fk_reserva_cliente") || msg.toLowerCase().includes("foreign key")) {
        setTelefonoError("Teléfono no registrado. Debes crear el cliente primero.");
      } else {
        alert("No se pudo guardar la reserva: " + (msg || "error desconocido"));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Reserva) => {
    setOpenMenu(null);
    if (!confirm(`¿Eliminar reserva #${r.id_reserva}?`)) return;
    try {
      await deleteReserva(r.id_reserva);
      await fetchAll();
    } catch (e) {
      console.error(e);
    }
  };

  // Aplica el cambio de estado aprobado (desde el toggle, ya confirmado).
  const aplicarAprobar = async () => {
    if (!confirmAprobar) return;
    const r = confirmAprobar;
    const nuevoAprobado = !r.aprobado;
    setTogglingAprobar(true);
    try {
      // Al aprobar: fecha ahora (o conservar si ya tenía). Al desaprobar: limpiar.
      const fecha_aprobacion = nuevoAprobado
        ? (r.fecha_aprobacion ?? new Date().toISOString())
        : null;
      await updateReserva(r.id_reserva, {
        aprobado: nuevoAprobado,
        fecha_aprobacion,
      });
      setConfirmAprobar(null);
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      alert("No se pudo actualizar el estado: " + (e?.message ?? "error desconocido"));
    } finally {
      setTogglingAprobar(false);
    }
  };

  /* ── Filtrado y paginación ──────────────── */
  const filtered = reservas.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      String(r.id_reserva).includes(q) ||
      r.telefono_cliente.toLowerCase().includes(q) ||
      (r.nombre_plan ?? "").toLowerCase().includes(q);
    const matchEstado =
      estadoFilter === "todos" ? true :
      estadoFilter === "aprobado" ? r.aprobado === true :
      !r.aprobado;
    return matchSearch && matchEstado;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleClear = () => { setSearch(""); setEstadoFilter("todos"); setPage(1); };

  /* ── KPIs ───────────────────────────────── */
  const totalPersonas = reservas.reduce((s, r) => s + (r.cantidad_personas ?? 0), 0);
  const aprobadas = reservas.filter((r) => r.aprobado).length;
  const pendientes = reservas.filter((r) => !r.aprobado).length;

  /* ── Badge de estado reutilizable ── */
  const EstadoBadge = ({ aprobado }: { aprobado?: boolean | null }) =>
    aprobado
      ? <span className="rv-badge rv-badge-ok"><CheckCircle size={12} /> Aprobado</span>
      : <span className="rv-badge rv-badge-pend"><Clock size={12} /> Pendiente</span>;

  /* ── Acciones desktop ── */
  const ActionButtons = ({ r }: { r: Reserva }) => (
    <div className="action-buttons">
      <button className="action-btn action-ver" onClick={() => openView(r)}>
        <Eye size={14} /> Ver
      </button>
      <button className="action-btn action-editar" onClick={() => openEdit(r)}>
        <Pencil size={14} /> Editar
      </button>
      <button className="action-btn action-eliminar" onClick={() => handleDelete(r)}>
        <Trash2 size={14} /> Eliminar
      </button>
    </div>
  );

  /* ── Menú tres puntos (móvil) ── */
  const ActionMenu = ({ r }: { r: Reserva }) => (
    <div className="rv-card-menu" ref={openMenu === r.id_reserva ? menuRef : undefined}>
      <button
        className="rv-menu-trigger"
        onClick={() => setOpenMenu(openMenu === r.id_reserva ? null : r.id_reserva)}
        aria-label="Acciones"
      >
        <MoreVertical size={18} />
      </button>
      {openMenu === r.id_reserva && (
        <div className="rv-menu-dropdown">
          <button onClick={() => openView(r)}><Eye size={15} /> Ver</button>
          <button onClick={() => openEdit(r)}><Pencil size={15} /> Editar</button>
          <button className="rv-menu-danger" onClick={() => handleDelete(r)}>
            <Trash2 size={15} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );

  /* ── Render ─────────────────────────────── */
  return (
    <div className="rv-page">

      {/* Header */}
      <div className="rv-header">
        <div>
          <h1 className="rv-title">Reservas</h1>
          <p className="rv-subtitle">Gestión de solicitudes, aprobaciones y participantes.</p>
        </div>
        <button className="rv-btn-new" onClick={openCreate}>
          <Plus size={16} /> Nueva reserva
        </button>
      </div>

      {/* KPIs */}
      <div className="rv-kpis">
        <div className="rv-kpi line-blue">
          <div className="rv-kpi-icon rv-kpi-blue"><Calendar size={20} /></div>
          <div>
            <div className="rv-kpi-label">Total reservas</div>
            <div className="rv-kpi-value">{reservas.length}</div>
          </div>
        </div>
        <div className="rv-kpi line-green">
          <div className="rv-kpi-icon rv-kpi-green"><CheckCircle size={20} /></div>
          <div>
            <div className="rv-kpi-label">Aprobadas</div>
            <div className="rv-kpi-value">{aprobadas}</div>
          </div>
        </div>
        <div className="rv-kpi line-amber">
          <div className="rv-kpi-icon rv-kpi-amber"><Clock size={20} /></div>
          <div>
            <div className="rv-kpi-label">Pendientes</div>
            <div className="rv-kpi-value">{pendientes}</div>
          </div>
        </div>
        <div className="rv-kpi line-violet">
          <div className="rv-kpi-icon rv-kpi-violet"><Users size={20} /></div>
          <div>
            <div className="rv-kpi-label">Total personas</div>
            <div className="rv-kpi-value">{totalPersonas}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rv-filter-bar">
        <div className="rv-search-wrap">
          <Search size={15} className="rv-search-icon" />
          <input
            className="rv-search-input"
            placeholder="Buscar por ID, teléfono o plan..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="rv-filter-divider" />

        <div className="rv-filter-group">
          <span className="rv-filter-label">Estado:</span>
          <select
            className="rv-filter-select"
            value={estadoFilter}
            onChange={(e) => { setEstadoFilter(e.target.value as any); setPage(1); }}
          >
            <option value="todos">Todos</option>
            <option value="aprobado">Aprobado</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>

        <div className="rv-filter-divider" />

        <button className="rv-clear-btn" onClick={handleClear}>
          <X size={14} /> Limpiar
        </button>

        <div className="rv-filter-divider" />

        <span className="rv-filter-label">Filas:</span>
        <select
          className="rv-filter-select"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* ── Tabla (desktop) ── */}
      <div className="rv-table-wrap rv-desktop-only">
        <table className="rv-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha solicitud</th>
              <th>Fecha aprobación</th>
              <th>TELÉFONO</th>
              <th>PLAN</th>
              <th>PERSONAS</th>
              <th>ESTADO</th>
              <th>APROBAR</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="rv-empty">Cargando...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={9} className="rv-empty">Sin resultados</td></tr>
            ) : paginated.map((r) => (
              <tr key={r.id_reserva}>
                <td className="rv-id">#{r.id_reserva}</td>
                <td>{fmt(r.fecha_solicitud) ?? <span className="rv-null">NULL</span>}</td>
                <td>{fmt(r.fecha_aprobacion) ?? <span className="rv-null">NULL</span>}</td>
                <td>
                  <span className="rv-phone"><Phone size={13} /> {r.telefono_cliente}</span>
                </td>
                <td>
                  <div className="rv-plan-cell">
                    <span className="rv-plan-id">#{r.id_plan}</span>
                    <span className="rv-plan-name">{r.nombre_plan}</span>
                  </div>
                </td>
                <td>
                  {r.cantidad_personas != null
                    ? <span className="rv-personas"><Users size={13} /> {r.cantidad_personas}</span>
                    : <span className="rv-null">—</span>}
                </td>
                <td><EstadoBadge aprobado={r.aprobado} /></td>
                <td>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!r.aprobado}
                    className={`rv-switch ${r.aprobado ? "rv-switch-on" : ""}`}
                    onClick={() => setConfirmAprobar(r)}
                    title={r.aprobado ? "Desaprobar reserva" : "Aprobar reserva"}
                  >
                    <span className="rv-switch-knob" />
                  </button>
                </td>
                <td>
                  <ActionButtons r={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginación */}
        <div className="rv-pagination">
          <span className="rv-pag-info">
            Mostrando {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="rv-pag-controls">
            <button className="rv-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} /> Anterior
            </button>
            <span className="rv-pag-current">Página {page} / {totalPages}</span>
            <button className="rv-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tarjetas (móvil) ── */}
      <div className="rv-cards rv-mobile-only">
        {loading ? (
          <div className="rv-card-empty">Cargando...</div>
        ) : paginated.length === 0 ? (
          <div className="rv-card-empty">Sin resultados</div>
        ) : paginated.map((r) => (
          <div className="rv-card" key={r.id_reserva}>
            <div className="rv-card-top">
              <div className="rv-card-headtext">
                <span className="rv-card-id">#{r.id_reserva}</span>
                <span className="rv-card-plan">#{r.id_plan} — {r.nombre_plan}</span>
              </div>
              <EstadoBadge aprobado={r.aprobado} />
              <ActionMenu r={r} />
            </div>

            <div className="rv-card-row">
              <Phone size={14} /> {r.telefono_cliente}
            </div>

            <div className="rv-card-meta">
              <div className="rv-card-meta-item">
                <span className="rv-card-meta-label">Personas</span>
                <span className="rv-card-meta-value">{r.cantidad_personas ?? "—"}</span>
              </div>
              <div className="rv-card-meta-item">
                <span className="rv-card-meta-label">Solicitud</span>
                <span className="rv-card-meta-value">{fmt(r.fecha_solicitud) ?? "—"}</span>
              </div>
              <div className="rv-card-meta-item">
                <span className="rv-card-meta-label">Aprobación</span>
                <span className="rv-card-meta-value">{fmt(r.fecha_aprobacion) ?? "—"}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Paginación móvil */}
        <div className="rv-pagination rv-pagination-mobile">
          <span className="rv-pag-info">
            {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="rv-pag-controls">
            <button className="rv-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} />
            </button>
            <span className="rv-pag-current">{page} / {totalPages}</span>
            <button className="rv-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal confirmar aprobar/desaprobar ── */}
      {confirmAprobar && (
        <div className="rv-overlay" onClick={() => !togglingAprobar && setConfirmAprobar(null)}>
          <div className="rv-modal rv-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="rv-modal-header">
              <h2>{confirmAprobar.aprobado ? "Desaprobar reserva" : "Aprobar reserva"}</h2>
              <button className="rv-modal-close" onClick={() => setConfirmAprobar(null)} disabled={togglingAprobar}><X size={20} /></button>
            </div>
            <div className="rv-modal-body">
              <p className="rv-confirm-text">
                {confirmAprobar.aprobado
                  ? <>¿Marcar la reserva <strong>#{confirmAprobar.id_reserva}</strong> como <strong>pendiente</strong>? Se borrará su fecha de aprobación.</>
                  : <>¿Aprobar la reserva <strong>#{confirmAprobar.id_reserva}</strong>? Se registrará la fecha de aprobación.</>}
              </p>
            </div>
            <div className="rv-modal-footer">
              <button className="rv-btn-cancel" onClick={() => setConfirmAprobar(null)} disabled={togglingAprobar}>Cancelar</button>
              <button className="rv-btn-save" onClick={aplicarAprobar} disabled={togglingAprobar}>
                {togglingAprobar ? "Guardando..." : confirmAprobar.aprobado ? "Sí, desaprobar" : "Sí, aprobar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ver ── */}
      {viewing && (
        <div className="rv-overlay" onClick={() => setViewing(null)}>
          <div className="rv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rv-modal-header">
              <h2>Detalle reserva #{viewing.id_reserva}</h2>
              <button className="rv-modal-close" onClick={() => setViewing(null)}><X size={20} /></button>
            </div>
            <div className="rv-modal-body">
              <div className="rv-detail-grid">
                <div className="rv-detail-field"><label>Teléfono</label><span>{viewing.telefono_cliente}</span></div>
                <div className="rv-detail-field"><label>Plan</label><span>#{viewing.id_plan} — {viewing.nombre_plan}</span></div>
                <div className="rv-detail-field"><label>Cantidad personas</label><span>{viewing.cantidad_personas ?? "—"}</span></div>
                <div className="rv-detail-field"><label>Estado</label>
                  <span><EstadoBadge aprobado={viewing.aprobado} /></span>
                </div>
                <div className="rv-detail-field"><label>Fecha solicitud</label><span>{fmt(viewing.fecha_solicitud) ?? "—"}</span></div>
                <div className="rv-detail-field"><label>Fecha aprobación</label><span>{fmt(viewing.fecha_aprobacion) ?? "—"}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Crear / Editar ── */}
      {showForm && (
        <div className="rv-overlay" onClick={() => setShowForm(false)}>
          <div className="rv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rv-modal-header">
              <h2>{editing ? `Editar reserva #${editing.id_reserva}` : "Nueva reserva"}</h2>
              <button className="rv-modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="rv-modal-body">
              <div className="rv-form-group">
                <label>Teléfono cliente *</label>
                <input
                  className={telefonoError ? "rv-input-error" : undefined}
                  value={formData.telefono_cliente}
                  onChange={(e) => {
                    setFormData({ ...formData, telefono_cliente: e.target.value });
                    if (telefonoError) setTelefonoError(null);
                  }}
                  placeholder="+57 300 000 0000"
                  disabled={!!editing}
                />
                {telefonoError && <span className="rv-field-error">{telefonoError}</span>}
              </div>
              <div className="rv-form-group">
                <label>Plan *</label>
                <select
                  value={formData.id_plan}
                  onChange={(e) => setFormData({ ...formData, id_plan: Number(e.target.value) })}
                >
                  <option value="">Seleccionar plan</option>
                  {planes.map((p) => (
                    <option key={p.id_plan} value={p.id_plan}>#{p.id_plan} — {p.nombre_plan}</option>
                  ))}
                </select>
              </div>
              <div className="rv-form-group">
                <label>Cantidad de personas</label>
                <input
                  type="number"
                  min={1}
                  value={formData.cantidad_personas}
                  onChange={(e) => setFormData({ ...formData, cantidad_personas: e.target.value ? Number(e.target.value) : "" })}
                  placeholder="1"
                />
              </div>
              <div className="rv-form-check">
                <input
                  type="checkbox"
                  id="aprobado-check"
                  checked={formData.aprobado}
                  onChange={(e) => setFormData({ ...formData, aprobado: e.target.checked })}
                />
                <label htmlFor="aprobado-check">Marcar como aprobada</label>
              </div>
            </div>
            <div className="rv-modal-footer">
              <button className="rv-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="rv-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear reserva"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}