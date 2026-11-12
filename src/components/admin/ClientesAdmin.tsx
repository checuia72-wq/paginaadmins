import { useEffect, useState } from "react";
import {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  getPlanes,
} from "../../services/api.service";
import {
  Plus, Eye, Pencil, Trash2, Search, X,
  ChevronLeft, ChevronRight, Phone, Users, Headphones, Bot,
  MessageSquare, MoreVertical, Package, AlertTriangle, MessageCircle, ExternalLink,
} from "lucide-react";
import "../../styles/clientes.css";
import { ETAPAS, getEtapaInfo } from "../../lib/etapas";
import type { EtapaConversacionValue } from "../../lib/etapas";
import { supabase } from "../../lib/supabase";
import ClientesHandoffAlert from "./ClientesHandoffAlert";
import type { ClienteHandoffPendiente } from "./ClientesHandoffAlert";

/* ── Tipos ─────────────────────────────────── */
type EstadoAtencion = "atencion_humana" | "atencion_bot" | "atencion_humana_desde_bot";
const ESTADOS_ATENCION: Record<EstadoAtencion, string> = {
  atencion_humana: "Atención humana",
  atencion_bot: "Atención bot",
  atencion_humana_desde_bot: "Atención humana desde bot",
};
const permitidoPruebas = (telefono: string) => {
  const n = telefono.replace(/\D/g, "");
  return n === "3013844877" || n === "573013844877";
};
interface Cliente {
  telefono: string;
  atencion_humana: boolean;
  bot_habilitado: boolean;
  estado_atencion: EstadoAtencion;
  ultima_interaccion_cliente?: string | null;
  fecha_estado_atencion?: string | null;
  alerta_atencion_pendiente: boolean;
  identidad?: { username: string | null; nombre_perfil: string | null; bsuid: string | null } | null;
  etapaconversacion?: EtapaConversacionValue | null;
  id_plan?: number | null;
}

interface Plan {
  id_plan: number;
  nombre_plan: string;
}

const emptyForm = {
  telefono: "",
  atencion_humana: false,
  bot_habilitado: false,
  estado_atencion: "atencion_humana" as EstadoAtencion,
  etapaconversacion: "" as EtapaConversacionValue | "",
  id_plan: "" as number | "",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// wa.me abre el chat existente por número; no envía mensajes automáticamente.
function whatsappChatUrl(telefono: string): string | null {
  let digitos = String(telefono ?? "").replace(/\D/g, "");
  if (digitos.length === 10 && digitos.startsWith("3")) digitos = "57" + digitos;
  if (!/^[1-9]\d{10,14}$/.test(digitos)) return null;
  return "https://wa.me/" + digitos;
}


/* ── Componente ────────────────────────────── */
export default function ClientesAdmin() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  // Ocultar el aviso inmediatamente, mientras se confirma el cambio en Supabase.
  const [ocultadasTemporal, setOcultadasTemporal] = useState<Record<string, string>>({});

  // Filtros
  const [search, setSearch] = useState("");
  const [etapaFilter, setEtapaFilter] = useState("todas");
  const [atencionFilter, setAtencionFilter] = useState<"todas" | "humana" | "bot" | "desde_bot" | "pendiente">("todas");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Modal form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Modal ver
  const [viewing, setViewing] = useState<Cliente | null>(null);

  // Menú acciones (móvil)
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  /* ── Fetch ── */
  const fetchClientes = async () => {
    try {
      setLoading(true);
      const [data, planesData] = await Promise.all([getClientes(), getPlanes()]);
      setClientes(data);
      setPlanes(planesData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchClientes(); }, []);

  // Refresca la bandeja ante nuevas derivaciones. El sondeo cubre instalaciones
  // donde los eventos Realtime de la tabla cliente no están habilitados.
  useEffect(() => {
    let activo = true;
    let consultando = false;
    const refrescar = async () => {
      if (!activo || consultando) return;
      consultando = true;
      try {
        const data = await getClientes();
        if (activo) setClientes(data);
      } catch (error) {
        console.error("No se pudo actualizar la lista de clientes", error);
      } finally {
        consultando = false;
      }
    };
    const timer = window.setInterval(() => void refrescar(), 60_000);
    const channel = supabase?.channel("clientes-derivaciones-bot")
      .on("postgres_changes", { event: "*", schema: "public", table: "cliente" }, () => void refrescar())
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refrescar();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      activo = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (openMenu == null) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".cl-card-menu")) {
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

  const openEdit = (c: Cliente) => {
    setOpenMenu(null);
    setEditing(c);
    setFormData({
      telefono: c.telefono,
      atencion_humana: c.atencion_humana,
      bot_habilitado: c.bot_habilitado,
      estado_atencion: c.estado_atencion,
      etapaconversacion: (c.etapaconversacion ?? "") as EtapaConversacionValue | "",
      id_plan: c.id_plan ?? "",
    });
    setShowForm(true);
  };

  const openView = (c: Cliente) => {
    setOpenMenu(null);
    setViewing(c);
  };

  const handleSave = async () => {
    if (!formData.telefono.trim()) {
      alert("El teléfono es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCliente(editing.telefono, {
          estado_atencion: formData.estado_atencion,
          atencion_humana: formData.estado_atencion !== "atencion_bot",
          bot_habilitado: formData.estado_atencion === "atencion_bot" && permitidoPruebas(formData.telefono),
          etapaconversacion: formData.etapaconversacion || null,
          id_plan: formData.id_plan === "" ? null : Number(formData.id_plan),
        });
      } else {
        await createCliente({
          telefono: formData.telefono,
          estado_atencion: formData.estado_atencion,
          atencion_humana: formData.estado_atencion !== "atencion_bot",
          bot_habilitado: formData.estado_atencion === "atencion_bot" && permitidoPruebas(formData.telefono),
          etapaconversacion: formData.etapaconversacion || null,
          id_plan: formData.id_plan === "" ? null : Number(formData.id_plan),
        });
      }
      setShowForm(false);
      await fetchClientes();
    } catch (e: any) {
      console.error(e);
      alert("No se pudo guardar el cliente: " + (e?.message ?? "puede que el teléfono ya exista."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Cliente) => {
    setOpenMenu(null);
    if (!confirm(`¿Eliminar al cliente ${c.telefono}?`)) return;
    try {
      await deleteCliente(c.telefono);
      await fetchClientes();
    } catch (e: any) {
      console.error(e);
      alert("No se pudo eliminar. Puede que tenga reservas asociadas.");
    }
  };

  const toggleBot = async (c: Cliente) => {
    const next = c.estado_atencion !== "atencion_bot";
    const estado: EstadoAtencion = next ? "atencion_bot" : "atencion_humana";
    const habilitado = next && permitidoPruebas(c.telefono);
    setOpenMenu(null);
    try {
      await updateCliente(c.telefono, { estado_atencion: estado, bot_habilitado: habilitado, atencion_humana: !next });
      setClientes(prev => prev.map(x => x.telefono === c.telefono
        ? {...x, estado_atencion: estado, bot_habilitado: habilitado, atencion_humana: !next} : x));
    } catch (e: any) {
      alert("No se pudo cambiar el estado del bot: " + (e?.message ?? "Error desconocido"));
    }
  };

  const displayName = (c: Cliente) => c.identidad?.nombre_perfil?.trim()
    || c.identidad?.username?.trim()
    || c.telefono;

  const necesitaAtencion = (c: Cliente) =>
    c.estado_atencion === "atencion_humana_desde_bot"
    && c.alerta_atencion_pendiente === true
    && ocultadasTemporal[c.telefono] !== (c.fecha_estado_atencion ?? "sin-fecha");

  // Abrir WhatsApp no cambia el estado de atención, solo reconoce la alerta.
  const marcarAtencionIniciada = (telefono: string) => {
    const actual = clientes.find(c => c.telefono === telefono);
    if (!actual || !necesitaAtencion(actual)) return;
    const identificador = actual.fecha_estado_atencion ?? "sin-fecha";
    setOcultadasTemporal(prev => ({ ...prev, [telefono]: identificador }));
    void (async () => {
      try {
        const actualizado = await updateCliente(telefono, { alerta_atencion_pendiente: false });
        if (actualizado.alerta_atencion_pendiente !== false) {
          throw new Error("La confirmación no quedó registrada.");
        }
        setClientes(prev => prev.map(c =>
          c.telefono === telefono ? { ...c, alerta_atencion_pendiente: false } : c
        ));
      } catch (error) {
        console.error("No se pudo registrar la atención del cliente", error);
        setOcultadasTemporal(prev => {
          if (prev[telefono] !== identificador) return prev;
          const siguiente = { ...prev };
          delete siguiente[telefono];
          return siguiente;
        });
        window.alert("Se abrió WhatsApp, pero no se pudo quitar la alerta. Inténtalo de nuevo.");
      }
    })();
  };

  /* ── Filtrado y paginación ── */
  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      c.telefono.toLowerCase().includes(q) ||
      displayName(c).toLowerCase().includes(q) ||
      (c.etapaconversacion ?? "").toLowerCase().includes(q);
    const matchEtapa = etapaFilter === "todas" ? true : c.etapaconversacion === etapaFilter;
    const matchAtencion =
      atencionFilter === "todas" ? true :
      atencionFilter === "humana" ? c.estado_atencion === "atencion_humana" :
      atencionFilter === "bot" ? c.estado_atencion === "atencion_bot" :
      atencionFilter === "pendiente" ? necesitaAtencion(c) :
      c.estado_atencion === "atencion_humana_desde_bot";
    return matchSearch && matchEtapa && matchAtencion;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleClear = () => {
    setSearch(""); setEtapaFilter("todas"); setAtencionFilter("todas"); setPage(1);
  };

  /* ── KPIs ── */
  const totalClientes = clientes.length;
  const conHumana = clientes.filter((c) => c.estado_atencion === "atencion_humana").length;
  const soloBot = clientes.filter((c) => c.estado_atencion === "atencion_bot").length;
  const desdeBot = clientes.filter((c) => c.estado_atencion === "atencion_humana_desde_bot").length;

  const pendientesAtencion: ClienteHandoffPendiente[] = clientes
    .filter(necesitaAtencion)
    .map((c) => ({
      telefono: c.telefono,
      nombre: displayName(c),
      plan: planes.find((p) => p.id_plan === c.id_plan)?.nombre_plan ?? null,
      fechaEstado: c.fecha_estado_atencion ?? null,
      ultimaInteraccion: c.ultima_interaccion_cliente ?? null,
      whatsappUrl: whatsappChatUrl(c.telefono),
    }))
    .sort((a, b) => Date.parse(b.fechaEstado || b.ultimaInteraccion || "") -
                    Date.parse(a.fechaEstado || a.ultimaInteraccion || ""));

  const verPendientes = () => {
    setSearch("");
    setEtapaFilter("todas");
    setAtencionFilter("pendiente");
    setPage(1);
    document.getElementById("clientes-filtros")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ── Sub-componentes ── */
  const nombrePlan = (id_plan?: number | null) => {
    if (id_plan == null) return null;
    return planes.find((p) => p.id_plan === id_plan)?.nombre_plan ?? `#${id_plan}`;
  };

  const PlanBadge = ({ id_plan }: { id_plan?: number | null }) => {
    const nombre = nombrePlan(id_plan);
    if (!nombre) return <span className="rv-null">—</span>;
    return <span className="cl-badge cl-badge-plan"><Package size={12} /> {nombre}</span>;
  };

  const AtencionBadge = ({ estado }: { estado: EstadoAtencion }) =>
    estado === "atencion_bot"
      ? <span className="cl-badge cl-badge-bot"><Bot size={12} /> {ESTADOS_ATENCION[estado]}</span>
      : estado === "atencion_humana_desde_bot"
        ? <span className="cl-badge cl-badge-derivada"><Headphones size={12} /> {ESTADOS_ATENCION[estado]}</span>
        : <span className="cl-badge cl-badge-humana"><Headphones size={12} /> {ESTADOS_ATENCION[estado]}</span>;

  const AtenderLink = ({ c, compacto = false }: { c: Cliente; compacto?: boolean }) => {
    if (c.estado_atencion !== "atencion_humana_desde_bot") return null;
    const url = whatsappChatUrl(c.telefono);
    if (!url) return <span className="cl-handoff-invalid">Número no válido</span>;
    return (
      <a className={compacto ? "cl-attend-btn cl-attend-btn-compact" : "cl-attend-btn"}
        href={url} target="_blank" rel="noopener noreferrer"
        onClick={() => marcarAtencionIniciada(c.telefono)}
        title="Abrir conversación en WhatsApp"
        aria-label={"Abrir WhatsApp para " + displayName(c)}>
        <MessageCircle size={15}/> {necesitaAtencion(c) ? "Atender" : "Abrir WhatsApp"} <ExternalLink size={13}/>
      </a>
    );
  };

  const EtapaBadge = ({ etapa }: { etapa?: string | null }) => {
    if (!etapa) return <span className="rv-null">—</span>;
    const info = getEtapaInfo(etapa);
    return (
      <span
        className="cl-etapa"
        style={{ color: info.color, background: info.bg, borderColor: info.color + "33" }}
      >
        <MessageSquare size={12} /> {info.label}
      </span>
    );
  };

  // Mostramos las acciones frecuentes sin ocupar toda la fila.
  // El menú agrupa el mantenimiento (bot, edición y eliminación).
  const ActionButtons = ({ c }: { c: Cliente }) => (
    <div className="cl-row-actions">
      {c.estado_atencion === "atencion_humana_desde_bot" && <AtenderLink c={c} compacto />}
      <button type="button" className="action-btn action-ver" onClick={() => openView(c)}>
        <Eye size={14} /> Ver
      </button>
      <ActionMenu c={c} soloGestion />
    </div>
  );

  const ActionMenu = ({ c, soloGestion = false }: { c: Cliente; soloGestion?: boolean }) => (
    <div className="cl-card-menu">
      <button type="button"
        className="cl-menu-trigger"
        onClick={() => setOpenMenu(openMenu === c.telefono ? null : c.telefono)}
        aria-label={"Más acciones para " + displayName(c)}
        aria-expanded={openMenu === c.telefono}
        aria-haspopup="menu"
        title="Más acciones"
      >
        <MoreVertical size={18} />
      </button>
      {openMenu === c.telefono && (
        <div className="cl-menu-dropdown" role="menu">
          {!soloGestion && c.estado_atencion === "atencion_humana_desde_bot" && whatsappChatUrl(c.telefono) && (
            <a href={whatsappChatUrl(c.telefono)!} target="_blank" rel="noopener noreferrer"
              onClick={() => { setOpenMenu(null); marcarAtencionIniciada(c.telefono); }}>
              <MessageCircle size={15}/> {necesitaAtencion(c) ? "Atender en WhatsApp" : "Abrir WhatsApp"}
            </a>
          )}
          {!soloGestion && <button type="button" onClick={() => openView(c)}><Eye size={15} /> Ver</button>}
          <button type="button" onClick={() => toggleBot(c)}>
            <Bot size={15} /> {c.estado_atencion === "atencion_bot" ? "Pasar a humana" : "Pasar a bot"}
          </button>
          <button type="button" onClick={() => openEdit(c)}><Pencil size={15} /> Editar</button>
          <button type="button" className="cl-menu-danger" onClick={() => handleDelete(c)}>
            <Trash2 size={15} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );

  /* ── Render ── */
  return (
    <div className="cl-page">

      {/* Header */}
      <div className="cl-header">
        <div>
          <h1 className="cl-title">Clientes</h1>
          <p className="cl-subtitle">Gestión de clientes, etapas de conversación y atención.</p>
        </div>
        <button className="cl-btn-new" onClick={openCreate}>
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      {/* KPIs */}
      <div className="cl-kpis">
        <div className="cl-kpi line-blue">
          <div className="cl-kpi-icon cl-kpi-blue"><Users size={20} /></div>
          <div>
            <div className="cl-kpi-label">Total clientes</div>
            <div className="cl-kpi-value">{totalClientes}</div>
          </div>
        </div>
        <div className="cl-kpi line-amber">
          <div className="cl-kpi-icon cl-kpi-amber"><Headphones size={20} /></div>
          <div>
            <div className="cl-kpi-label">Atención humana</div>
            <div className="cl-kpi-value">{conHumana}</div>
          </div>
        </div>
        <div className="cl-kpi line-slate">
          <div className="cl-kpi-icon cl-kpi-slate"><Bot size={20} /></div>
          <div>
            <div className="cl-kpi-label">Bot activo</div>
            <div className="cl-kpi-value">{soloBot}</div>
          </div>
        </div>
        <div className="cl-kpi line-violet">
          <div className="cl-kpi-icon cl-kpi-violet"><Headphones size={20} /></div>
          <div>
            <div className="cl-kpi-label">Humana desde bot</div>
            <div className="cl-kpi-value">{desdeBot}</div>
          </div>
        </div>
      </div>

      <ClientesHandoffAlert pendientes={pendientesAtencion} onShowAll={verPendientes} onAtender={marcarAtencionIniciada} />

      {/* Filter bar */}
      <div className="cl-filter-bar" id="clientes-filtros">
        <div className="cl-search-wrap">
          <Search size={15} className="cl-search-icon" />
          <input
            className="cl-search-input"
            placeholder="Buscar por teléfono o etapa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="cl-filter-divider" />

        <div className="cl-filter-group">
          <span className="cl-filter-label">Etapa:</span>
          <select
            className="cl-filter-select"
            value={etapaFilter}
            onChange={(e) => { setEtapaFilter(e.target.value); setPage(1); }}
          >
            <option value="todas">Todas</option>
            {ETAPAS.map((et) => <option key={et.key} value={et.key}>{et.label}</option>)}
          </select>
        </div>

        <div className="cl-filter-divider" />

        <div className="cl-filter-group">
          <span className="cl-filter-label">Atención:</span>
          <select
            className="cl-filter-select"
            value={atencionFilter}
            onChange={(e) => { setAtencionFilter(e.target.value as any); setPage(1); }}
          >
            <option value="todas">Todas</option>
            <option value="humana">Atención humana</option>
            <option value="bot">Atención bot</option>
            <option value="desde_bot">Atención humana desde bot</option>
            <option value="pendiente">Necesita atención</option>
          </select>
        </div>

        <div className="cl-filter-divider" />

        <button className="cl-clear-btn" onClick={handleClear}>
          <X size={14} /> Limpiar
        </button>

        <div className="cl-filter-divider" />

        <span className="cl-filter-label">Filas:</span>
        <select
          className="cl-filter-select"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* ── Tabla (desktop) ── */}
      <div className="cl-table-wrap cl-desktop-only">
        <table className="cl-table">
          <colgroup>
            <col className="cl-col-client" />
            <col className="cl-col-attention" />
            <col className="cl-col-stage" />
            <col className="cl-col-plan" />
            <col className="cl-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>CLIENTE / WHATSAPP</th>
              <th>ATENCIÓN</th>
              <th>ETAPA</th>
              <th>PLAN</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="cl-empty">Cargando...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={5} className="cl-empty">Sin resultados</td></tr>
            ) : paginated.map((c) => (
              <tr key={c.telefono}>
                <td>
                  <div className="cl-client-cell">
                    <strong className="cl-client-name" title={displayName(c)}>{displayName(c)}</strong>
                    <span className="cl-phone"><Phone size={13} /> {c.telefono}</span>
                  </div>
                </td>
                <td>
                  <div className="cl-status-stack">
                    <AtencionBadge estado={c.estado_atencion} />
                  {necesitaAtencion(c) && (
                    <span className="cl-needs-attention"><AlertTriangle size={12}/> Necesita atención</span>
                  )}
                  </div>
                </td>
                <td><EtapaBadge etapa={c.etapaconversacion} /></td>
                <td><PlanBadge id_plan={c.id_plan} /></td>
                <td><ActionButtons c={c} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginación */}
        <div className="cl-pagination">
          <span className="cl-pag-info">
            Mostrando {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="cl-pag-controls">
            <button className="cl-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} /> Anterior
            </button>
            <span className="cl-pag-current">Página {page} / {totalPages}</span>
            <button className="cl-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tarjetas (móvil) ── */}
      <div className="cl-cards cl-mobile-only">
        {loading ? (
          <div className="cl-card-empty">Cargando...</div>
        ) : paginated.length === 0 ? (
          <div className="cl-card-empty">Sin resultados</div>
        ) : paginated.map((c) => (
          <div className="cl-card" key={c.telefono}>
            <div className="cl-card-top">
              <div className="cl-card-identity">
                <strong className="cl-card-name">{displayName(c)}</strong>
                <span className="cl-card-number"><Phone size={13} /> {c.telefono}</span>
              </div>
              <ActionMenu c={c} />
            </div>
            <div className="cl-card-badges">
              <AtencionBadge estado={c.estado_atencion} />
              {necesitaAtencion(c) && (
                <span className="cl-needs-attention"><AlertTriangle size={12}/> Necesita atención</span>
              )}
              <EtapaBadge etapa={c.etapaconversacion} />
              <PlanBadge id_plan={c.id_plan} />
            </div>
            {c.estado_atencion === "atencion_humana_desde_bot" && (
              <div className="cl-card-attend"><AtenderLink c={c}/></div>
            )}
          </div>
        ))}

        {/* Paginación móvil */}
        <div className="cl-pagination cl-pagination-mobile">
          <span className="cl-pag-info">
            {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="cl-pag-controls">
            <button className="cl-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} />
            </button>
            <span className="cl-pag-current">{page} / {totalPages}</span>
            <button className="cl-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal Ver ── */}
      {viewing && (
        <div className="cl-overlay" onClick={() => setViewing(null)}>
          <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h2>Detalle del cliente</h2>
              <button className="cl-modal-close" onClick={() => setViewing(null)}><X size={20} /></button>
            </div>
            <div className="cl-modal-body">
              <div className="cl-detail-field"><label>Teléfono</label><span>{viewing.telefono}</span></div>
              <div className="cl-detail-field"><label>Nombre WhatsApp</label><span>{displayName(viewing)}</span></div>
              <div className="cl-detail-field"><label>Atención</label><span><AtencionBadge estado={viewing.estado_atencion} /></span></div>
              <div className="cl-detail-field"><label>Última interacción</label><span>{viewing.ultima_interaccion_cliente ? new Date(viewing.ultima_interaccion_cliente).toLocaleString("es-CO") : "Sin registro"}</span></div>
              <div className="cl-detail-field"><label>Etapa de conversación</label><span><EtapaBadge etapa={viewing.etapaconversacion} /></span></div>
              <div className="cl-detail-field"><label>Plan asociado</label><span><PlanBadge id_plan={viewing.id_plan} /></span></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Crear / Editar ── */}
      {showForm && (
        <div className="cl-overlay" onClick={() => setShowForm(false)}>
          <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h2>{editing ? "Editar cliente" : "Nuevo cliente"}</h2>
              <button className="cl-modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="cl-modal-body">
              <div className="cl-form-group">
                <label>Teléfono *</label>
                <input
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Ej. 3001234567"
                  disabled={!!editing}
                />
              </div>
              <div className="cl-form-group">
                <label>Etapa de conversación</label>
                <select
                  className="cl-select"
                  value={formData.etapaconversacion}
                  onChange={(e) => setFormData({ ...formData, etapaconversacion: e.target.value as EtapaConversacionValue | "" })}
                >
                  <option value="">— Selecciona una etapa —</option>
                  {ETAPAS.map((et) => (
                    <option key={et.key} value={et.key}>{et.label}</option>
                  ))}
                </select>
              </div>
              <div className="cl-form-group">
                <label>Plan asociado</label>
                <select
                  className="cl-select"
                  value={formData.id_plan}
                  onChange={(e) => setFormData({ ...formData, id_plan: e.target.value === "" ? "" : Number(e.target.value) })}
                >
                  <option value="">Sin plan</option>
                  {planes.map((p) => (
                    <option key={p.id_plan} value={p.id_plan}>#{p.id_plan} — {p.nombre_plan}</option>
                  ))}
                </select>
              </div>
              <div className="cl-form-group">
                <label>Estado de atención</label>
                <select className="cl-select" value={formData.estado_atencion}
                  onChange={(e) => setFormData({...formData, estado_atencion: e.target.value as EstadoAtencion})}>
                  {(Object.entries(ESTADOS_ATENCION) as [EstadoAtencion, string][]).map(([valor, nombre]) => (
                    <option key={valor} value={valor}>{nombre}</option>
                  ))}
                </select>
                {formData.estado_atencion === "atencion_bot" && !permitidoPruebas(formData.telefono) && (
                  <small>El bot sigue limitado al número de pruebas autorizado.</small>
                )}
              </div>
            </div>
            <div className="cl-modal-footer">
              <button className="cl-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="cl-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}