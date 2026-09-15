import { useEffect, useMemo, useState } from "react";
import {
  getReservas,
  createReserva,
  updateReserva,
  deleteReserva,
  getPlanes,
  getClientes,
  createCliente,
  getParticipantesPorReserva,
  createParticipante,
  updateParticipante,
  deleteParticipante,
  getOrCreatePlanFecha,
  getOrCreatePlanHora,
} from "../../services/api.service";
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Phone,
  CheckCircle,
  Clock,
  Users,
  Calendar,
  UserCheck,
} from "lucide-react";
import ReservationApprovalModal from "../common/ReservationApprovalModal";
import LargeGroupExcelImport, { type ImportedGroupParticipant } from "./LargeGroupExcelImport";
import "../../styles/reservas.css";

interface Reserva {
  id_reserva: number;
  codigo_reserva?: string | null;
  fecha_solicitud?: string | null;
  fecha_aprobacion?: string | null;
  telefono_cliente: string;
  id_plan: number;
  id_fecha?: number | null;
  id_hora?: number | null;
  nombre_plan?: string;
  cantidad_personas?: number | null;
  aprobado?: boolean | null;
  fecha_reserva?: string | null;
  hora_reserva?: string | null;
}

interface PlanHora {
  id_hora: number;
  hora: string;
}

interface Plan {
  id_plan: number;
  nombre_plan: string;
  tipo_hora?: string | null;
  plan_horas?: PlanHora[];
}

interface Participante {
  id_participante: number;
  id_reserva: number;
  nombre: string;
  edad: number | null;
  nacionalidad?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  correo?: string | null;
  telefono_cliente?: string | null;
  telefono_participante?: string | null;
}

type NuevoParticipante = {
  id_participante?: number;
  nombre: string;
  edad: string;
  nacionalidad: string;
  tipo_documento: string;
  numero_documento: string;
  correo: string;
  telefono: string;
};

const emptyParticipant = (): NuevoParticipante => ({
  nombre: "",
  edad: "",
  nacionalidad: "",
  tipo_documento: "CC",
  numero_documento: "",
  correo: "",
  telefono: "",
});

const emptyForm = {
  telefono_cliente: "",
  id_plan: "" as number | "",
  id_fecha: "" as number | "",
  fecha_visita: "",
  id_hora: "" as number | "",
  hora_visita: "",
  cantidad_personas: 1,
  aprobado: false,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function fmt(d?: string | null) {
  if (!d) return null;
  const raw = String(d).trim();
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtReserva(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

function fmtHora(h?: string | null) {
  if (!h) return "";
  return h.slice(0, 5);
}

export default function ReservasAdmin() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [clientes, setClientes] = useState<{ telefono: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "aprobado" | "pendiente">("todos");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reserva | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [newParticipants, setNewParticipants] = useState<NuevoParticipante[]>([emptyParticipant()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingEditParticipants, setLoadingEditParticipants] = useState(false);
  const [isLargeGroup, setIsLargeGroup] = useState(false);
  const [hasFullGroupList, setHasFullGroupList] = useState(false);
  const [groupImportFile, setGroupImportFile] = useState("");
  const [groupImportDirty, setGroupImportDirty] = useState(false);

  const [viewing, setViewing] = useState<Reserva | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<Reserva | null>(null);
  const [approvalSaving, setApprovalSaving] = useState(false);

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

  useEffect(() => {
    fetchAll();
  }, []);

  const selectedPlan = useMemo(
    () =>
      formData.id_plan === ""
        ? null
        : planes.find((p) => Number(p.id_plan) === Number(formData.id_plan)) ?? null,
    [planes, formData.id_plan],
  );

  const availableHours = useMemo(
    () =>
      [...(selectedPlan?.plan_horas ?? [])].sort((a, b) =>
        String(a.hora).localeCompare(String(b.hora)),
      ),
    [selectedPlan],
  );

  const syncParticipantCount = (count: number) => {
    const max = isLargeGroup ? 1000 : 30;
    const safe = Math.max(1, Math.min(max, Number(count) || 1));
    setFormData((p) => ({ ...p, cantidad_personas: safe }));

    if (isLargeGroup) {
      if (!hasFullGroupList) setNewParticipants((p) => [p[0] ?? emptyParticipant()]);
      return;
    }

    setNewParticipants((p) =>
      p.length === safe
        ? p
        : p.length < safe
          ? [...p, ...Array.from({ length: safe - p.length }, emptyParticipant)]
          : p.slice(0, safe),
    );
  };

  const toggleLargeGroup = (checked: boolean) => {
    setIsLargeGroup(checked);
    setHasFullGroupList(false);
    setGroupImportFile("");
    setGroupImportDirty(false);

    if (checked) {
      setFormData((p) => ({
        ...p,
        cantidad_personas: Math.max(31, Number(p.cantidad_personas) || 31),
      }));
      setNewParticipants((p) => [p[0] ?? emptyParticipant()]);
      return;
    }

    setFormData((p) => {
      const safe = Math.max(1, Math.min(30, Number(p.cantidad_personas) || 1));
      setNewParticipants((current) =>
        current.length === safe
          ? current
          : current.length < safe
            ? [...current, ...Array.from({ length: safe - current.length }, emptyParticipant)]
            : current.slice(0, safe),
      );
      return { ...p, cantidad_personas: safe };
    });
  };

  const handleLargeGroupImport = (rows: ImportedGroupParticipant[], fileName: string) => {
    const mapped: NuevoParticipante[] = rows.map((row) => ({ ...row }));
    setNewParticipants(mapped);
    setHasFullGroupList(true);
    setGroupImportFile(fileName);
    setGroupImportDirty(true);
    setFormData((previous) => ({
      ...previous,
      cantidad_personas: mapped.length,
      telefono_cliente: mapped[0]?.telefono || previous.telefono_cliente,
    }));
    setFormError(null);
  };

  const clearLargeGroupImport = () => {
    setNewParticipants((current) => [current[0] ?? emptyParticipant()]);
    setHasFullGroupList(false);
    setGroupImportFile("");
    setGroupImportDirty(true);
    setFormError(null);
  };

  const openCreate = () => {
    setEditing(null);
    setIsLargeGroup(false);
    setHasFullGroupList(false);
    setGroupImportFile("");
    setGroupImportDirty(false);
    setFormData(emptyForm);
    setNewParticipants([emptyParticipant()]);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = async (r: Reserva) => {
    const large = Number(r.cantidad_personas ?? 0) > 30;
    setEditing(r);
    setIsLargeGroup(large);
    setHasFullGroupList(false);
    setGroupImportFile("");
    setGroupImportDirty(false);
    setFormData({
      telefono_cliente: r.telefono_cliente,
      id_plan: r.id_plan,
      id_fecha: r.id_fecha ?? "",
      fecha_visita: r.fecha_reserva?.slice(0, 10) ?? "",
      id_hora: r.id_hora ?? "",
      hora_visita: r.hora_reserva?.slice(0, 5) ?? "",
      cantidad_personas: r.cantidad_personas ?? 1,
      aprobado: !!r.aprobado,
    });
    setNewParticipants([]);
    setFormError(null);
    setShowForm(true);
    setLoadingEditParticipants(true);

    try {
      const existentes: Participante[] = await getParticipantesPorReserva(r.id_reserva);
      const mapped: NuevoParticipante[] = existentes.map((p) => ({
        id_participante: p.id_participante,
        nombre: p.nombre ?? "",
        edad: p.edad == null ? "" : String(p.edad),
        nacionalidad: p.nacionalidad ?? "",
        tipo_documento: p.tipo_documento ?? "CC",
        numero_documento: p.numero_documento ?? "",
        correo: p.correo ?? "",
        telefono: p.telefono_participante || p.telefono_cliente || "",
      }));
      const total = Math.max(1, Number(r.cantidad_personas) || 1, mapped.length);
      const isLarge = total > 30;
      const hasSavedList = isLarge && mapped.length > 1;
      setIsLargeGroup(isLarge);
      setHasFullGroupList(hasSavedList);
      setGroupImportFile(hasSavedList ? "Lista guardada en la reserva" : "");
      setGroupImportDirty(false);
      setFormData((prev) => ({ ...prev, cantidad_personas: total }));
      setNewParticipants(
        isLarge
          ? hasSavedList
            ? mapped
            : [mapped[0] ?? emptyParticipant()]
          : [...mapped, ...Array.from({ length: Math.max(0, total - mapped.length) }, emptyParticipant)],
      );
    } catch (e: any) {
      console.error(e);
      setFormError(e?.message || "No fue posible cargar los participantes de la reserva.");
      const total = Math.max(1, Number(r.cantidad_personas) || 1);
      setHasFullGroupList(false);
      setGroupImportFile("");
      setGroupImportDirty(false);
      setNewParticipants(
        large ? [emptyParticipant()] : Array.from({ length: Math.min(30, total) }, emptyParticipant),
      );
    } finally {
      setLoadingEditParticipants(false);
    }
  };

  const openView = async (r: Reserva) => {
    setViewing(r);
    setParticipantes([]);
    setLoadingParticipantes(true);
    try {
      setParticipantes(await getParticipantesPorReserva(r.id_reserva));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingParticipantes(false);
    }
  };

  const updateNewParticipant = (i: number, f: keyof NuevoParticipante, v: string) => {
    setNewParticipants((p) => p.map((x, j) => (j === i ? { ...x, [f]: v } : x)));
    if (i === 0 && f === "telefono") {
      setFormData((p) => ({ ...p, telefono_cliente: v }));
    }
  };

  const validateParticipants = () => {
    if (formData.id_plan === "") return "Selecciona un plan.";
    if (!formData.fecha_visita) return "Selecciona la fecha de la visita.";
    if (!formData.hora_visita) return "Selecciona la hora de la visita.";
    if (isLargeGroup && Number(formData.cantidad_personas) < 31) {
      return "Para usar Grupo grande registra al menos 31 personas.";
    }
    if (isLargeGroup && hasFullGroupList && newParticipants.length !== Number(formData.cantidad_personas)) {
      return "La cantidad de personas debe coincidir con la lista importada desde Excel.";
    }

    const participantsToValidate = isLargeGroup
      ? hasFullGroupList
        ? newParticipants
        : newParticipants.slice(0, 1)
      : newParticipants;

    for (let i = 0; i < participantsToValidate.length; i++) {
      const p = participantsToValidate[i];
      const who = isLargeGroup
        ? i === 0
          ? "encargado del grupo"
          : `participante ${i + 1}`
        : `participante ${i + 1}`;
      if (!p.nombre.trim()) return `Falta el nombre del ${who}.`;
      if (!p.telefono.trim()) return `Falta el teléfono del ${who}.`;
      if (!p.numero_documento.trim()) return `Falta el documento del ${who}.`;
      if (!p.nacionalidad.trim()) return `Falta la nacionalidad del ${who}.`;
    }
    return null;
  };

  const participantPayload = (p: NuevoParticipante, idReserva: number, clientPhone: string, index: number) => ({
    id_reserva: idReserva,
    telefono_cliente: clientPhone,
    telefono_participante: index === 0 ? null : p.telefono.trim(),
    nombre: p.nombre.trim(),
    edad: p.edad ? Number(p.edad) : null,
    nacionalidad: p.nacionalidad.trim() || null,
    tipo_documento: p.tipo_documento || null,
    numero_documento: p.numero_documento.trim() || null,
    correo: p.correo.trim() || null,
  });

  const handleSave = async () => {
    setFormError(null);
    setSaving(true);
    try {
      const validation = validateParticipants();
      if (validation) {
        setFormError(validation);
        return;
      }

      const fecha_aprobacion = formData.aprobado
        ? editing?.fecha_aprobacion ?? new Date().toISOString()
        : null;
      const participantsToSave = isLargeGroup
        ? hasFullGroupList
          ? newParticipants
          : newParticipants.slice(0, 1)
        : newParticipants;
      const clientPhone = (participantsToSave[0]?.telefono || formData.telefono_cliente).trim();
      if (!clientPhone) {
        setFormError("El teléfono del cliente es obligatorio.");
        return;
      }

      const idFecha = await getOrCreatePlanFecha(Number(formData.id_plan), formData.fecha_visita);
      const idHora = await getOrCreatePlanHora(Number(formData.id_plan), formData.hora_visita);
      const fechaReserva = `${formData.fecha_visita}T${formData.hora_visita}:00`;

      if (editing) {
        await updateReserva(editing.id_reserva, {
          telefono_cliente: clientPhone,
          id_plan: Number(formData.id_plan),
          id_fecha: idFecha,
          id_hora: idHora,
          fecha_reserva: fechaReserva,
          cantidad_personas: Number(formData.cantidad_personas),
          aprobado: formData.aprobado,
          fecha_aprobacion,
        });

        if (isLargeGroup && groupImportDirty) {
          const currentParticipants: Participante[] = await getParticipantesPorReserva(editing.id_reserva);
          for (const current of currentParticipants) await deleteParticipante(current.id_participante);
          for (let i = 0; i < participantsToSave.length; i++) {
            await createParticipante(participantPayload(participantsToSave[i], editing.id_reserva, clientPhone, i));
          }
        } else {
          for (let i = 0; i < participantsToSave.length; i++) {
            const p = participantsToSave[i];
            const payload = participantPayload(p, editing.id_reserva, clientPhone, i);
            if (p.id_participante) await updateParticipante(p.id_participante, payload);
            else await createParticipante(payload);
          }
        }
      } else {
        if (!clientes.some((c) => c.telefono === clientPhone)) {
          await createCliente({
            telefono: clientPhone,
            atencion_humana: true,
            etapaconversacion: "saludo",
            id_plan: Number(formData.id_plan),
          });
        }

        const created = await createReserva({
          telefono_cliente: clientPhone,
          id_plan: Number(formData.id_plan),
          id_fecha: idFecha,
          id_hora: idHora,
          fecha_reserva: fechaReserva,
          cantidad_personas: Number(formData.cantidad_personas),
          aprobado: formData.aprobado,
          fecha_aprobacion,
        });

        for (let i = 0; i < participantsToSave.length; i++) {
          await createParticipante(participantPayload(participantsToSave[i], created.id_reserva, clientPhone, i));
        }
      }

      setShowForm(false);
      setHasFullGroupList(false);
      setGroupImportFile("");
      setGroupImportDirty(false);
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      setFormError(e?.message || "No fue posible guardar la reserva.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Reserva) => {
    if (!confirm(`¿Eliminar la reserva ${r.codigo_reserva || `#${r.id_reserva}`}?`)) return;
    try {
      await deleteReserva(r.id_reserva);
      await fetchAll();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleApproved = (r: Reserva) => setApprovalTarget(r);

  const confirmApprovalChange = async () => {
    if (!approvalTarget || approvalSaving) return;
    const next = !approvalTarget.aprobado;
    setApprovalSaving(true);
    try {
      await updateReserva(approvalTarget.id_reserva, {
        aprobado: next,
        fecha_aprobacion: next
          ? approvalTarget.fecha_aprobacion ?? new Date().toISOString()
          : null,
      });
      setApprovalTarget(null);
      await fetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setApprovalSaving(false);
    }
  };

  const filtered = useMemo(
    () =>
      reservas.filter((r) => {
        const q = search.trim().toLowerCase();
        return (
          (!q ||
            [r.codigo_reserva, r.id_reserva, r.telefono_cliente, r.nombre_plan].some((v) =>
              String(v ?? "").toLowerCase().includes(q),
            )) &&
          (estadoFilter === "todos" ||
            (estadoFilter === "aprobado" ? !!r.aprobado : !r.aprobado))
        );
      }),
    [reservas, search, estadoFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPersonas = reservas.reduce((s, r) => s + (r.cantidad_personas ?? 0), 0);
  const aprobadas = reservas.filter((r) => r.aprobado).length;
  const pendientes = reservas.length - aprobadas;

  const EstadoBadge = ({ aprobado }: { aprobado?: boolean | null }) =>
    aprobado ? (
      <span className="rv-badge rv-badge-ok">
        <CheckCircle size={12} /> Aprobado
      </span>
    ) : (
      <span className="rv-badge rv-badge-pend">
        <Clock size={12} /> Pendiente
      </span>
    );

  const renderParticipantsForm = () => {
    const participantsToRender = isLargeGroup ? newParticipants.slice(0, 1) : newParticipants;
    return (
      <div style={{ marginTop: 22 }}>
        <h3 style={{ marginBottom: 6 }}>
          {isLargeGroup ? "Datos del encargado del grupo" : "Datos de participantes"}
        </h3>
        <p style={{ marginTop: 0, color: "#64748b", fontSize: 13 }}>
          {isLargeGroup
            ? hasFullGroupList
              ? "La primera persona de la lista importada es el encargado. Puedes corregir sus datos aquí; el resto se guardará desde el Excel."
              : "Para grupos grandes puedes guardar solo al encargado o importar la lista completa desde Excel."
            : editing
              ? "Puedes corregir los participantes existentes o aumentar la cantidad de personas para registrar los que faltan."
              : "El participante 1 corresponde también a los datos principales del cliente."}
        </p>

        {loadingEditParticipants ? (
          <p>Cargando participantes…</p>
        ) : (
          participantsToRender.map((p, index) => (
            <div
              key={p.id_participante ?? `new-${index}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 14,
                marginBottom: 14,
                background: "#fffbeb",
              }}
            >
              <strong>
                {isLargeGroup
                  ? "Encargado del grupo"
                  : `Participante ${index + 1}${index === 0 ? " · Cliente" : ""}${!p.id_participante && editing ? " · Nuevo" : ""}`}
              </strong>
              <div className="pt-form-row pt-form-row-2" style={{ marginTop: 10 }}>
                <div className="pt-form-group">
                  <label>Nombre completo *</label>
                  <input
                    value={p.nombre}
                    onChange={(e) => updateNewParticipant(index, "nombre", e.target.value)}
                  />
                </div>
                <div className="pt-form-group">
                  <label>Teléfono *</label>
                  <input
                    value={p.telefono}
                    onChange={(e) => updateNewParticipant(index, "telefono", e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-form-row" style={{ marginTop: 10 }}>
                <div className="pt-form-group">
                  <label>Edad</label>
                  <input
                    type="number"
                    min={0}
                    value={p.edad}
                    onChange={(e) => updateNewParticipant(index, "edad", e.target.value)}
                  />
                </div>
                <div className="pt-form-group">
                  <label>Nacionalidad *</label>
                  <input
                    value={p.nacionalidad}
                    onChange={(e) => updateNewParticipant(index, "nacionalidad", e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-form-row" style={{ marginTop: 10 }}>
                <div className="pt-form-group">
                  <label>Tipo documento</label>
                  <select
                    value={p.tipo_documento}
                    onChange={(e) => updateNewParticipant(index, "tipo_documento", e.target.value)}
                  >
                    <option value="CC">CC</option>
                    <option value="TI">TI</option>
                    <option value="CE">CE</option>
                    <option value="PASAPORTE">Pasaporte</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div className="pt-form-group">
                  <label>Número documento *</label>
                  <input
                    value={p.numero_documento}
                    onChange={(e) => updateNewParticipant(index, "numero_documento", e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-form-group" style={{ marginTop: 10 }}>
                <label>Correo</label>
                <input
                  type="email"
                  value={p.correo}
                  onChange={(e) => updateNewParticipant(index, "correo", e.target.value)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="rv-page">
      <div className="rv-header">
        <div>
          <h1 className="rv-title">Reservas</h1>
          <p className="rv-subtitle">Gestión de solicitudes, aprobaciones y participantes.</p>
        </div>
        <button className="rv-btn-new" onClick={openCreate}>
          <Plus size={16} /> Nueva reserva
        </button>
      </div>

      <div className="rv-kpis">
        <div className="rv-kpi line-blue">
          <div className="rv-kpi-icon rv-kpi-blue"><Calendar size={20} /></div>
          <div><div className="rv-kpi-label">Total reservas</div><div className="rv-kpi-value">{reservas.length}</div></div>
        </div>
        <div className="rv-kpi line-green">
          <div className="rv-kpi-icon rv-kpi-green"><CheckCircle size={20} /></div>
          <div><div className="rv-kpi-label">Aprobadas</div><div className="rv-kpi-value">{aprobadas}</div></div>
        </div>
        <div className="rv-kpi line-amber">
          <div className="rv-kpi-icon rv-kpi-amber"><Clock size={20} /></div>
          <div><div className="rv-kpi-label">Pendientes</div><div className="rv-kpi-value">{pendientes}</div></div>
        </div>
        <div className="rv-kpi line-violet">
          <div className="rv-kpi-icon rv-kpi-violet"><Users size={20} /></div>
          <div><div className="rv-kpi-label">Total personas</div><div className="rv-kpi-value">{totalPersonas}</div></div>
        </div>
      </div>

      <div className="rv-filter-bar">
        <div className="rv-search-wrap">
          <Search size={15} className="rv-search-icon" />
          <input
            className="rv-search-input"
            placeholder="Buscar código, teléfono o plan..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
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
        <button className="rv-clear-btn" onClick={() => { setSearch(""); setEstadoFilter("todos"); setPage(1); }}>
          <X size={14} /> Limpiar
        </button>
        <span className="rv-filter-label">Filas:</span>
        <select
          className="rv-filter-select"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>

      <div className="rv-table-wrap rv-desktop-only">
        <table className="rv-table">
          <thead>
            <tr>
              <th>Código</th><th>Fecha solicitud</th><th>Fecha aprobación</th><th>Fecha visita</th><th>Teléfono</th><th>Plan</th><th>Personas</th><th>Estado</th><th>Aprobar</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="rv-empty">Cargando...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={10} className="rv-empty">Sin resultados</td></tr>
            ) : (
              paginated.map((r) => (
                <tr key={r.id_reserva}>
                  <td><strong>{r.codigo_reserva || `#${r.id_reserva}`}</strong></td>
                  <td>{fmt(r.fecha_solicitud) ?? "—"}</td>
                  <td>{fmt(r.fecha_aprobacion) ?? "—"}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontWeight: 600, color: "#334155" }}>
                      <Calendar size={13} />{fmtReserva(r.fecha_reserva)}{r.hora_reserva ? ` · ${fmtHora(r.hora_reserva)}` : ""}
                    </span>
                  </td>
                  <td><span className="rv-phone"><Phone size={13} /> {r.telefono_cliente}</span></td>
                  <td>{r.nombre_plan || `#${r.id_plan}`}</td>
                  <td>{r.cantidad_personas ?? "—"}</td>
                  <td><EstadoBadge aprobado={r.aprobado} /></td>
                  <td>
                    <button type="button" role="switch" aria-checked={!!r.aprobado} className={`rv-switch ${r.aprobado ? "rv-switch-on" : ""}`} onClick={() => toggleApproved(r)}>
                      <span className="rv-switch-knob" />
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn action-ver" onClick={() => openView(r)}><Eye size={14} /> Ver</button>
                      <button className="action-btn action-editar" onClick={() => openEdit(r)}><Pencil size={14} /> Editar</button>
                      <button className="action-btn action-eliminar" onClick={() => handleDelete(r)}><Trash2 size={14} /> Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="rv-pagination">
          <span className="rv-pag-info">Mostrando {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}</span>
          <div className="rv-pag-controls">
            <button className="rv-pag-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={15} /> Anterior</button>
            <span className="rv-pag-current">Página {page} / {totalPages}</span>
            <button className="rv-pag-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente <ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {viewing && (
        <div className="rv-overlay" onClick={() => setViewing(null)}>
          <div className="rv-modal rv-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="rv-modal-header">
              <h2>Reserva {viewing.codigo_reserva || `#${viewing.id_reserva}`}</h2>
              <button className="rv-modal-close" onClick={() => setViewing(null)}><X size={20} /></button>
            </div>
            <div className="rv-modal-body">
              <div className="rv-detail-grid">
                <div className="rv-detail-field"><label>Teléfono</label><span>{viewing.telefono_cliente}</span></div>
                <div className="rv-detail-field"><label>Plan</label><span>{viewing.nombre_plan}</span></div>
                <div className="rv-detail-field"><label>Fecha que quiere reservar</label><span>{fmtReserva(viewing.fecha_reserva)}{viewing.hora_reserva ? ` · ${fmtHora(viewing.hora_reserva)}` : ""}</span></div>
                <div className="rv-detail-field"><label>Personas</label><span>{viewing.cantidad_personas}</span></div>
                <div className="rv-detail-field"><label>Estado</label><span><EstadoBadge aprobado={viewing.aprobado} /></span></div>
              </div>
              <div className="rv-parts">
                <div className="rv-parts-head">
                  <h3 className="rv-parts-title"><UserCheck size={15} /> {Number(viewing.cantidad_personas ?? 0) > 30 ? participantes.length > 1 ? "Participantes del grupo" : "Encargado del grupo" : "Participantes"}</h3>
                </div>
                {loadingParticipantes ? <p>Cargando…</p> : (
                  <div className="rv-parts-table-wrap">
                    <table className="rv-parts-table">
                      <thead><tr><th>Nombre</th><th>Edad</th><th>Nacionalidad</th><th>Documento</th><th>Teléfono</th></tr></thead>
                      <tbody>
                        {participantes.map((p) => (
                          <tr key={p.id_participante}>
                            <td>{p.nombre}</td><td>{p.edad ?? "—"}</td><td>{p.nacionalidad || "—"}</td><td>{`${p.tipo_documento || ""} ${p.numero_documento || ""}`.trim() || "—"}</td><td>{p.telefono_participante || p.telefono_cliente || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rv-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="rv-modal rv-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="rv-modal-header">
              <h2>{editing ? `Editar reserva ${editing.codigo_reserva || `#${editing.id_reserva}`}` : "Nueva reserva"}</h2>
              <button className="rv-modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="rv-modal-body">
              {formError && <div className="rv-field-error" style={{ marginBottom: 14 }}>{formError}</div>}

              <div className="rv-form-group">
                <label>Plan *</label>
                <select
                  value={formData.id_plan}
                  onChange={(e) => setFormData({ ...formData, id_plan: e.target.value ? Number(e.target.value) : "", id_fecha: "", id_hora: "" })}
                >
                  <option value="">Seleccionar plan</option>
                  {planes.map((p) => <option key={p.id_plan} value={p.id_plan}>#{p.id_plan} — {p.nombre_plan}</option>)}
                </select>
              </div>

              <div className="rv-form-group">
                <label>Fecha de la visita *</label>
                <input type="date" value={formData.fecha_visita} onChange={(e) => setFormData({ ...formData, fecha_visita: e.target.value, id_fecha: "" })} />
                <small style={{ color: "#64748b" }}>Selecciona directamente el día en que se realizará la visita.</small>
              </div>

              <div className="rv-form-group">
                <label>Hora de la visita *</label>
                <input type="time" list="rv-available-hours" value={formData.hora_visita} onChange={(e) => setFormData({ ...formData, hora_visita: e.target.value, id_hora: "" })} />
                {availableHours.length > 0 && (
                  <datalist id="rv-available-hours">{availableHours.map((h) => <option key={h.id_hora} value={fmtHora(h.hora)} />)}</datalist>
                )}
                <small style={{ color: "#64748b" }}>{availableHours.length > 0 ? "Puedes elegir uno de los horarios del plan o escribir otra hora." : "Selecciona la hora exacta de la visita."}</small>
              </div>

              <div style={{ border: "1px solid #dbe7f3", borderRadius: 12, padding: 14, marginBottom: 16, background: isLargeGroup ? "#f0f9ff" : "#f8fafc" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, cursor: "pointer" }}>
                  <input type="checkbox" checked={isLargeGroup} onChange={(e) => toggleLargeGroup(e.target.checked)} />
                  Grupo grande
                </label>
                <small style={{ display: "block", marginTop: 6, color: "#64748b" }}>
                  Actívalo para grupos numerosos. Puedes guardar solo al encargado o importar la lista completa de asistentes desde Excel.
                </small>
              </div>

              <div className="rv-form-group">
                <label>Cantidad de personas *</label>
                <input
                  type="number"
                  min={1}
                  max={isLargeGroup ? 1000 : 30}
                  value={formData.cantidad_personas}
                  disabled={isLargeGroup && hasFullGroupList}
                  onChange={(e) => syncParticipantCount(Number(e.target.value))}
                />
                <small style={{ color: "#64748b" }}>
                  {isLargeGroup
                    ? hasFullGroupList
                      ? `Cantidad definida automáticamente por el Excel: ${newParticipants.length} participantes.`
                      : "En Grupo grande puedes registrar hasta 1.000 personas sin crear un formulario por cada asistente."
                    : "Si aumentas esta cantidad, aparecerán formularios nuevos para registrar a las personas faltantes."}
                </small>
              </div>

              {isLargeGroup && (
                <>
                  <div style={{ border: "1px solid #bae6fd", borderRadius: 12, padding: 14, marginBottom: 16, background: "#f0f9ff" }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Resumen del grupo</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, fontSize: 13, color: "#334155" }}>
                      <div><strong>Plan:</strong> {selectedPlan?.nombre_plan || "Sin seleccionar"}</div>
                      <div><strong>Personas:</strong> {formData.cantidad_personas}</div>
                      <div><strong>Fecha:</strong> {formData.fecha_visita ? fmtReserva(formData.fecha_visita) : "Sin seleccionar"}</div>
                      <div><strong>Hora:</strong> {formData.hora_visita || "Sin seleccionar"}</div>
                      <div><strong>Lista:</strong> {hasFullGroupList ? `${newParticipants.length} participantes importados` : "Solo encargado"}</div>
                    </div>
                  </div>

                  <LargeGroupExcelImport
                    participants={hasFullGroupList ? newParticipants : []}
                    fileName={groupImportFile}
                    onImport={handleLargeGroupImport}
                    onClear={clearLargeGroupImport}
                    disabled={saving || loadingEditParticipants}
                  />
                </>
              )}

              <div className="rv-form-check">
                <input type="checkbox" id="aprobado-check" checked={formData.aprobado} onChange={(e) => setFormData({ ...formData, aprobado: e.target.checked })} />
                <label htmlFor="aprobado-check">Marcar como aprobada</label>
              </div>

              {renderParticipantsForm()}
            </div>
            <div className="rv-modal-footer">
              <button className="rv-btn-cancel" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button>
              <button className="rv-btn-save" onClick={handleSave} disabled={saving || loadingEditParticipants}>
                {saving
                  ? "Guardando..."
                  : editing
                    ? "Guardar reserva y participantes"
                    : isLargeGroup
                      ? hasFullGroupList
                        ? `Crear grupo con ${newParticipants.length} participantes`
                        : `Crear grupo de ${formData.cantidad_personas} personas`
                      : `Crear reserva con ${formData.cantidad_personas} participante${formData.cantidad_personas === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReservationApprovalModal
        open={!!approvalTarget}
        approving={approvalTarget ? !approvalTarget.aprobado : false}
        reservationCode={approvalTarget?.codigo_reserva || (approvalTarget ? `#${approvalTarget.id_reserva}` : null)}
        planName={approvalTarget?.nombre_plan}
        people={approvalTarget?.cantidad_personas}
        loading={approvalSaving}
        onCancel={() => !approvalSaving && setApprovalTarget(null)}
        onConfirm={confirmApprovalChange}
      />
    </div>
  );
}
