import { useEffect, useState, useRef } from "react";
import {
  getParticipantes,
  createParticipante,
  updateParticipante,
  deleteParticipante,
  getReservas,
} from "../../services/api.service";
import {
  Plus, Eye, Pencil, Trash2, Search, X,
  ChevronLeft, ChevronRight, Users, Calendar, MoreVertical, Phone,
} from "lucide-react";
import "../../styles/participantes.css";

/* ── Tipos ── */
interface Participante {
  id_participante: number;
  id_reserva: number;
  nombre: string;
  edad: number | null;
  estatura: number | null;
  peso: number | null;
  telefono_cliente?: string | null;
  telefono_participante?: string | null;
  nombre_plan?: string | null;
}

interface Reserva {
  id_reserva: number;
  telefono_cliente?: string;
  nombre_plan?: string;
}

const emptyForm = {
  id_reserva: "" as number | "",
  nombre: "",
  edad: "",
  estatura: "",
  peso: "",
  telefono_cliente: "",
  telefono_participante: "",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/* ── Componente ── */
export default function ParticipantesAdmin() {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [reservaFilter, setReservaFilter] = useState<string>("todas");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Modal form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Participante | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Modal ver
  const [viewing, setViewing] = useState<Participante | null>(null);

  // Menú acciones (móvil)
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* ── Fetch ── */
  const fetchAll = async () => {
    try {
      setLoading(true);
      const [p, r] = await Promise.all([getParticipantes(), getReservas()]);
      setParticipantes(p);
      setReservas(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

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

  /* ── Helpers ── */
  const openCreate = () => {
    setEditing(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p: Participante) => {
    setOpenMenu(null);
    setEditing(p);
    setFormData({
      id_reserva: p.id_reserva,
      nombre: p.nombre,
      edad: p.edad?.toString() ?? "",
      estatura: p.estatura?.toString() ?? "",
      peso: p.peso?.toString() ?? "",
      telefono_cliente: p.telefono_cliente ?? "",
      telefono_participante: p.telefono_participante ?? "",
    });
    setShowForm(true);
  };

  const openView = (p: Participante) => {
    setOpenMenu(null);
    setViewing(p);
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      alert("El nombre es obligatorio");
      return;
    }
    if (!formData.id_reserva) {
      alert("Debes seleccionar una reserva");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id_reserva: Number(formData.id_reserva),
        nombre: formData.nombre,
        edad: formData.edad ? Number(formData.edad) : null,
        estatura: formData.estatura ? Number(formData.estatura) : null,
        peso: formData.peso ? Number(formData.peso) : null,
        telefono_cliente: formData.telefono_cliente || null,
        telefono_participante: formData.telefono_participante || null,
      };
      if (editing) {
        await updateParticipante(editing.id_participante, payload);
      } else {
        await createParticipante(payload);
      }
      setShowForm(false);
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      alert("No se pudo guardar el participante: " + (e?.message ?? "error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Participante) => {
    setOpenMenu(null);
    if (!confirm(`¿Eliminar a ${p.nombre}?`)) return;
    try {
      await deleteParticipante(p.id_participante);
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      alert("No se pudo eliminar el participante.");
    }
  };

  /* ── Filtrado y paginación ── */
  const filtered = participantes.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      String(p.id_participante).includes(q) ||
      p.nombre.toLowerCase().includes(q) ||
      String(p.id_reserva).includes(q) ||
      (p.telefono_cliente ?? "").toLowerCase().includes(q) ||
      (p.telefono_participante ?? "").toLowerCase().includes(q) ||
      (p.nombre_plan ?? "").toLowerCase().includes(q);
    const matchReserva =
      reservaFilter === "todas" ? true : String(p.id_reserva) === reservaFilter;
    return matchSearch && matchReserva;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleClear = () => { setSearch(""); setReservaFilter("todas"); setPage(1); };

  /* ── KPIs (solo total y reservas con participantes) ── */
  const totalParticipantes = participantes.length;
  const reservasConParticipantes = new Set(participantes.map((p) => p.id_reserva)).size;

  /* ── Sub-componentes ── */
  const ActionButtons = ({ p }: { p: Participante }) => (
    <div className="action-buttons">
      <button className="action-btn action-ver" onClick={() => openView(p)}>
        <Eye size={14} /> Ver
      </button>
      <button className="action-btn action-editar" onClick={() => openEdit(p)}>
        <Pencil size={14} /> Editar
      </button>
      <button className="action-btn action-eliminar" onClick={() => handleDelete(p)}>
        <Trash2 size={14} /> Eliminar
      </button>
    </div>
  );

  const ActionMenu = ({ p }: { p: Participante }) => (
    <div className="pt-card-menu" ref={openMenu === p.id_participante ? menuRef : undefined}>
      <button
        className="pt-menu-trigger"
        onClick={() => setOpenMenu(openMenu === p.id_participante ? null : p.id_participante)}
        aria-label="Acciones"
      >
        <MoreVertical size={18} />
      </button>
      {openMenu === p.id_participante && (
        <div className="pt-menu-dropdown">
          <button onClick={() => openView(p)}><Eye size={15} /> Ver</button>
          <button onClick={() => openEdit(p)}><Pencil size={15} /> Editar</button>
          <button className="pt-menu-danger" onClick={() => handleDelete(p)}>
            <Trash2 size={15} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );

  const fmtEstatura = (v: number | null) => (v != null ? `${v} m` : "—");
  const fmtPeso = (v: number | null) => (v != null ? `${Number(v).toFixed(2)} kg` : "—");

  // Nombre del plan asociado al participante: usa el que ya trae la API y,
  // si no viene, lo busca en la lista de reservas cargada.
  const planDeReserva = (p: Participante) =>
    p.nombre_plan ??
    reservas.find((r) => r.id_reserva === p.id_reserva)?.nombre_plan ??
    "—";

  /* ── Render ── */
  return (
    <div className="pt-page">

      {/* Header */}
      <div className="pt-header">
        <div>
          <h1 className="pt-title">Participantes</h1>
          <p className="pt-subtitle">Gestión de participantes registrados por reserva.</p>
        </div>
        <button className="pt-btn-new" onClick={openCreate}>
          <Plus size={16} /> Nuevo participante
        </button>
      </div>

      {/* KPIs */}
      <div className="pt-kpis">
        <div className="pt-kpi line-blue">
          <div className="pt-kpi-icon pt-kpi-blue"><Users size={20} /></div>
          <div>
            <div className="pt-kpi-label">Total participantes</div>
            <div className="pt-kpi-value">{totalParticipantes}</div>
          </div>
        </div>
        <div className="pt-kpi line-violet">
          <div className="pt-kpi-icon pt-kpi-violet"><Calendar size={20} /></div>
          <div>
            <div className="pt-kpi-label">Reservas con participantes</div>
            <div className="pt-kpi-value">{reservasConParticipantes}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="pt-filter-bar">
        <div className="pt-search-wrap">
          <Search size={15} className="pt-search-icon" />
          <input
            className="pt-search-input"
            placeholder="Buscar por ID, nombre o reserva..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="pt-filter-divider" />

        <div className="pt-filter-group">
          <span className="pt-filter-label">Reserva:</span>
          <select
            className="pt-filter-select"
            value={reservaFilter}
            onChange={(e) => { setReservaFilter(e.target.value); setPage(1); }}
          >
            <option value="todas">Todas</option>
            {reservas.map((r) => (
              <option key={r.id_reserva} value={String(r.id_reserva)}>
                #{r.id_reserva}{r.nombre_plan ? ` — ${r.nombre_plan}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-filter-divider" />

        <button className="pt-clear-btn" onClick={handleClear}>
          <X size={14} /> Limpiar
        </button>

        <div className="pt-filter-divider" />

        <span className="pt-filter-label">Filas:</span>
        <select
          className="pt-filter-select"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* ── Tabla (desktop) ── */}
      <div className="pt-table-wrap pt-desktop-only">
        <table className="pt-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>N° RESERVA</th>
              <th>NOMBRE</th>
              <th>EDAD</th>
              <th>ESTATURA</th>
              <th>PESO</th>
              <th>CLIENTE</th>
              <th>TEL. PARTICIPANTE</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="pt-empty">Cargando...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={9} className="pt-empty">Sin resultados</td></tr>
            ) : paginated.map((p) => (
              <tr key={p.id_participante}>
                <td className="pt-id">#{p.id_participante}</td>
                <td>
                  <div className="pt-reserva-cell">
                    <span className="pt-reserva"><Calendar size={13} /> #{p.id_reserva}</span>
                    <span className="pt-reserva-plan">{planDeReserva(p)}</span>
                  </div>
                </td>
                <td className="pt-nombre">{p.nombre}</td>
                <td>{p.edad ?? <span className="rv-null">—</span>}</td>
                <td>{fmtEstatura(p.estatura)}</td>
                <td>{fmtPeso(p.peso)}</td>
                <td>
                  {p.telefono_cliente ? (
                    <span className="pt-phone"><Phone size={13} /> {p.telefono_cliente}</span>
                  ) : (
                    <span className="rv-null">—</span>
                  )}
                </td>
                <td>
                  {p.telefono_participante ? (
                    <span className="pt-phone"><Phone size={13} /> {p.telefono_participante}</span>
                  ) : (
                    <span className="rv-null">—</span>
                  )}
                </td>
                <td><ActionButtons p={p} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginación */}
        <div className="pt-pagination">
          <span className="pt-pag-info">
            Mostrando {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="pt-pag-controls">
            <button className="pt-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} /> Anterior
            </button>
            <span className="pt-pag-current">Página {page} / {totalPages}</span>
            <button className="pt-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tarjetas (móvil) ── */}
      <div className="pt-cards pt-mobile-only">
        {loading ? (
          <div className="pt-card-empty">Cargando...</div>
        ) : paginated.length === 0 ? (
          <div className="pt-card-empty">Sin resultados</div>
        ) : paginated.map((p) => (
          <div className="pt-card" key={p.id_participante}>
            <div className="pt-card-top">
              <div className="pt-card-headtext">
                <span className="pt-card-id">#{p.id_participante}</span>
                <span className="pt-card-nombre">{p.nombre}</span>
              </div>
              <ActionMenu p={p} />
            </div>

            <div className="pt-card-row">
              <Calendar size={14} /> Reserva #{p.id_reserva} — {planDeReserva(p)}
            </div>

            {p.telefono_cliente && (
              <div className="pt-card-row">
                <Phone size={14} /> Cliente: {p.telefono_cliente}
              </div>
            )}

            {p.telefono_participante && (
              <div className="pt-card-row">
                <Phone size={14} /> Participante: {p.telefono_participante}
              </div>
            )}

            <div className="pt-card-meta">
              <div className="pt-card-meta-item">
                <span className="pt-card-meta-label">Edad</span>
                <span className="pt-card-meta-value">{p.edad ?? "—"}</span>
              </div>
              <div className="pt-card-meta-item">
                <span className="pt-card-meta-label">Estatura</span>
                <span className="pt-card-meta-value">{fmtEstatura(p.estatura)}</span>
              </div>
              <div className="pt-card-meta-item">
                <span className="pt-card-meta-label">Peso</span>
                <span className="pt-card-meta-value">{fmtPeso(p.peso)}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Paginación móvil */}
        <div className="pt-pagination pt-pagination-mobile">
          <span className="pt-pag-info">
            {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="pt-pag-controls">
            <button className="pt-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} />
            </button>
            <span className="pt-pag-current">{page} / {totalPages}</span>
            <button className="pt-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal Ver ── */}
      {viewing && (
        <div className="pt-overlay" onClick={() => setViewing(null)}>
          <div className="pt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pt-modal-header">
              <h2>Detalle del participante</h2>
              <button className="pt-modal-close" onClick={() => setViewing(null)}><X size={20} /></button>
            </div>
            <div className="pt-modal-body">
              <div className="pt-detail-grid">
                <div className="pt-detail-field"><label>ID</label><span>#{viewing.id_participante}</span></div>
                <div className="pt-detail-field"><label>N° Reserva</label><span>#{viewing.id_reserva} — {planDeReserva(viewing)}</span></div>
                <div className="pt-detail-field"><label>Nombre</label><span>{viewing.nombre}</span></div>
                <div className="pt-detail-field"><label>Edad</label><span>{viewing.edad ?? "—"}</span></div>
                <div className="pt-detail-field"><label>Estatura</label><span>{fmtEstatura(viewing.estatura)}</span></div>
                <div className="pt-detail-field"><label>Peso</label><span>{fmtPeso(viewing.peso)}</span></div>
                <div className="pt-detail-field"><label>Tel. cliente</label><span>{viewing.telefono_cliente || "—"}</span></div>
                <div className="pt-detail-field"><label>Tel. participante</label><span>{viewing.telefono_participante || "—"}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Crear / Editar ── */}
      {showForm && (
        <div className="pt-overlay" onClick={() => setShowForm(false)}>
          <div className="pt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pt-modal-header">
              <h2>{editing ? "Editar participante" : "Nuevo participante"}</h2>
              <button className="pt-modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="pt-modal-body">
              <div className="pt-form-group">
                <label>N° Reserva *</label>
                <select
                  value={formData.id_reserva}
                  onChange={(e) => {
                    const idr = e.target.value === "" ? "" : Number(e.target.value);
                    const tel = idr === "" ? "" : (reservas.find((r) => r.id_reserva === idr)?.telefono_cliente ?? "");
                    setFormData({ ...formData, id_reserva: idr, telefono_cliente: tel });
                  }}
                >
                  <option value="">Seleccionar reserva</option>
                  {reservas.map((r) => (
                    <option key={r.id_reserva} value={r.id_reserva}>
                      #{r.id_reserva}{r.nombre_plan ? ` — ${r.nombre_plan}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-form-group">
                <label>Nombre *</label>
                <input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre del participante"
                />
              </div>
              <div className="pt-form-row">
                <div className="pt-form-group">
                  <label>Edad</label>
                  <input
                    type="number"
                    value={formData.edad}
                    onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                    placeholder="Edad"
                  />
                </div>
                <div className="pt-form-group">
                  <label>Estatura (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estatura}
                    onChange={(e) => setFormData({ ...formData, estatura: e.target.value })}
                    placeholder="Ej. 1.72"
                  />
                </div>
                <div className="pt-form-group">
                  <label>Peso (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.peso}
                    onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                    placeholder="Ej. 70.5"
                  />
                </div>
              </div>
              <div className="pt-form-row">
                <div className="pt-form-group">
                  <label>Tel. cliente</label>
                  <input
                    value={formData.telefono_cliente}
                    onChange={(e) => setFormData({ ...formData, telefono_cliente: e.target.value })}
                    placeholder="Se autocompleta con la reserva"
                  />
                </div>
                <div className="pt-form-group">
                  <label>Tel. participante</label>
                  <input
                    value={formData.telefono_participante}
                    onChange={(e) => setFormData({ ...formData, telefono_participante: e.target.value })}
                    placeholder="Ej. 3009876543"
                  />
                </div>
              </div>
            </div>
            <div className="pt-modal-footer">
              <button className="pt-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="pt-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear participante"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}