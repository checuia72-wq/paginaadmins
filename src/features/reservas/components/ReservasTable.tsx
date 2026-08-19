import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { cn } from "../../../lib/cn";
import type { ReservaApi, ReservaStatus } from "../types";
import {
  attachReceipt,
  getReservaMeta,
  markPaid,
  markPending,
  resolveEffectiveStatus,
  updateReservaStatus,
} from "../reservasMetaStorage";
import { useReservasUiStore } from "../reservasUiStore";
import {
  useClientesQuery,
  useCreateReservaMutation,
  useDeleteReservaMutation,
  usePlanesQuery,
  useReservasQuery,
  useUpdateReservaMutation,
} from "../queries";

type CreateOrEditForm = {
  telefono_cliente: string;
  id_plan: string;
  cantidad_personas: string;
};

const initialForm: CreateOrEditForm = {
  telefono_cliente: "",
  id_plan: "",
  cantidad_personas: "",
};

function formatMoneyCOP(value: number) {
  return Number(value).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO");
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-CO");
}

function normalizeForSearch(value: string) {
  return value.trim().toLowerCase();
}

function statusLabel(status: ReservaStatus) {
  switch (status) {
    case "pending":
      return "Pendiente (sin recibo)";
    case "receipt_received":
      return "Recibo recibido";
    case "paid_confirmed":
      return "Pagado / Confirmado";
    case "rejected":
      return "Rechazado";
    case "canceled":
      return "Cancelado";
    default:
      return status;
  }
}

function statusBadgeClass(status: ReservaStatus) {
  switch (status) {
    case "paid_confirmed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "receipt_received":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "pending":
      return "bg-slate-50 text-slate-700 ring-slate-200";
    case "rejected":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "canceled":
      return "bg-zinc-50 text-zinc-700 ring-zinc-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export default function ReservasTable() {
  const reservasQuery = useReservasQuery();
  const clientesQuery = useClientesQuery();
  const planesQuery = usePlanesQuery();

  const createReservaMutation = useCreateReservaMutation();
  const updateReservaMutation = useUpdateReservaMutation();
  const deleteReservaMutation = useDeleteReservaMutation();

  const ui = useReservasUiStore();
  const [metaRevision, setMetaRevision] = useState(0);
  const [currentUserLabel, setCurrentUserLabel] = useState("admin");

  const [selected, setSelected] = useState<ReservaApi | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [form, setForm] = useState<CreateOrEditForm>(initialForm);

  const detailsDialogRef = useRef<HTMLDialogElement | null>(null);
  const createDialogRef = useRef<HTMLDialogElement | null>(null);
  const editDialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.trim();
      if (email) setCurrentUserLabel(email);
    });
  }, []);

  const reservas = reservasQuery.data ?? [];

  const enriched = useMemo(() => {
    // metaRevision se usa solo para forzar recomputación cuando cambie localStorage.
    void metaRevision;
    return reservas.map((r) => {
      const meta = getReservaMeta(r.id_reserva);
      const effectiveStatus = resolveEffectiveStatus(r, meta);
      const total = (r.precio_plan ?? 0) * (r.cantidad_personas ?? 0);
      return { reserva: r, meta, effectiveStatus, total };
    });
  }, [reservas, metaRevision]);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(ui.search);
    const from = ui.fechaDesde ? new Date(ui.fechaDesde) : null;
    const to = ui.fechaHasta ? new Date(ui.fechaHasta) : null;

    return enriched.filter(({ reserva, effectiveStatus }) => {
      if (ui.status !== "all" && effectiveStatus !== ui.status) return false;

      if (from || to) {
        const raw =
          ui.fechaCampo === "fecha_plan"
            ? reserva.fecha_plan
            : reserva.fecha_solicitud;
        if (raw) {
          const d = new Date(raw);
          if (from && d < from) return false;
          if (to) {
            const endOfDay = new Date(to);
            endOfDay.setHours(23, 59, 59, 999);
            if (d > endOfDay) return false;
          }
        }
      }

      if (!q) return true;

      const haystack = [
        String(reserva.id_reserva),
        reserva.telefono_cliente ?? "",
        reserva.nombre_cliente ?? "",
        reserva.nombre_plan ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [
    enriched,
    ui.search,
    ui.status,
    ui.fechaCampo,
    ui.fechaDesde,
    ui.fechaHasta,
  ]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ui.pageSize));
  const page = Math.min(ui.page, totalPages);
  const startIndex = (page - 1) * ui.pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + ui.pageSize);

  useEffect(() => {
    if (ui.page !== page) ui.setPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const openDetails = (r: ReservaApi) => {
    setSelected(r);
    detailsDialogRef.current?.showModal();
  };

  const openCreate = () => {
    setForm(initialForm);
    setIsCreateOpen(true);
    createDialogRef.current?.showModal();
  };

  const openEdit = (r: ReservaApi) => {
    setSelected(r);
    setForm({
      telefono_cliente: r.telefono_cliente ?? "",
      id_plan: String(r.id_plan ?? ""),
      cantidad_personas: String(r.cantidad_personas ?? ""),
    });
    setIsEditOpen(true);
    editDialogRef.current?.showModal();
  };

  const closeDialog = (ref: React.RefObject<HTMLDialogElement | null>) => {
    ref.current?.close();
  };

  const onChangeForm = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const telefono_cliente = form.telefono_cliente.trim();
    const id_plan = Number(form.id_plan);
    const cantidad_personas = Number(form.cantidad_personas);

    if (!telefono_cliente || !id_plan || !cantidad_personas) {
      alert("Todos los campos son obligatorios");
      return;
    }

    await createReservaMutation.mutateAsync({
      telefono_cliente,
      id_plan,
      cantidad_personas,
    });

    closeDialog(createDialogRef);
    setIsCreateOpen(false);
    setForm(initialForm);
  };

  const onEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    const telefono_cliente = form.telefono_cliente.trim();
    const id_plan = Number(form.id_plan);
    const cantidad_personas = Number(form.cantidad_personas);

    if (!telefono_cliente || !id_plan || !cantidad_personas) {
      alert("Todos los campos son obligatorios");
      return;
    }

    await updateReservaMutation.mutateAsync({
      id: selected.id_reserva,
      data: { telefono_cliente, id_plan, cantidad_personas },
    });

    closeDialog(editDialogRef);
    setIsEditOpen(false);
  };

  const onDelete = async (r: ReservaApi) => {
    const ok = confirm(`¿Eliminar la reserva #${r.id_reserva}?`);
    if (!ok) return;
    await deleteReservaMutation.mutateAsync(r.id_reserva);
  };

  const onUploadReceipt = async (r: ReservaApi, file: File) => {
    const dataUrl = await fileToDataUrl(file);
    attachReceipt({ idReserva: r.id_reserva, receiptDataUrl: dataUrl, by: currentUserLabel });

    const meta = getReservaMeta(r.id_reserva);
    const effective = resolveEffectiveStatus(r, meta);
    if (effective === "pending") {
      updateReservaStatus({
        idReserva: r.id_reserva,
        nextStatus: "receipt_received",
        by: currentUserLabel,
      });
    }

    setMetaRevision((x) => x + 1);
  };

  const onSetStatus = async (r: ReservaApi, next: ReservaStatus) => {
    updateReservaStatus({ idReserva: r.id_reserva, nextStatus: next, by: currentUserLabel });

    // Persistencia parcial con backend actual:
    // - Si confirmamos pago: aprobado = true
    // - Si cancelamos/rechazamos/pendiente/recibo: aprobado = false
    if (next === "paid_confirmed") {
      await updateReservaMutation.mutateAsync({
        id: r.id_reserva,
        data: { aprobado: true },
      });
      markPaid({ idReserva: r.id_reserva, by: currentUserLabel });
    } else {
      await updateReservaMutation.mutateAsync({
        id: r.id_reserva,
        data: { aprobado: false },
      });
      if (next === "pending") {
        markPending({ idReserva: r.id_reserva, by: currentUserLabel });
      }
    }

    setMetaRevision((x) => x + 1);
  };

  const isBusy =
    reservasQuery.isLoading ||
    createReservaMutation.isPending ||
    updateReservaMutation.isPending ||
    deleteReservaMutation.isPending;

  const selectedMeta = selected ? getReservaMeta(selected.id_reserva) : null;
  const selectedEffectiveStatus =
    selected && selectedMeta ? resolveEffectiveStatus(selected, selectedMeta) : null;

  return (
    <section className="w-full px-4 py-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-left text-xl font-semibold text-slate-900">
            Reservas
          </h2>
          <p className="text-left text-sm text-slate-600">
            Gestión de solicitudes de WhatsApp, pagos y estados.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={isBusy}
        >
          <Plus className="h-4 w-4" />
          Nueva reserva
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="lg:col-span-2">
          <span className="mb-1 block text-left text-xs font-medium text-slate-600">
            Buscar (ID / Teléfono / Nombre / Plan)
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={ui.search}
              onChange={(e) => ui.setSearch(e.target.value)}
              placeholder="Ej: 1023 o +57300..."
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </label>

        <label>
          <span className="mb-1 block text-left text-xs font-medium text-slate-600">
            Estado
          </span>
          <select
            value={ui.status}
            onChange={(e) => ui.setStatus(e.target.value as any)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="all">Todos</option>
            <option value="pending">{statusLabel("pending")}</option>
            <option value="receipt_received">{statusLabel("receipt_received")}</option>
            <option value="paid_confirmed">{statusLabel("paid_confirmed")}</option>
            <option value="rejected">{statusLabel("rejected")}</option>
            <option value="canceled">{statusLabel("canceled")}</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-left text-xs font-medium text-slate-600">
            Campo de fecha
          </span>
          <select
            value={ui.fechaCampo}
            onChange={(e) => ui.setFechaCampo(e.target.value as any)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="fecha_solicitud">Fecha de solicitud</option>
            <option value="fecha_plan">Fecha del tour</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1 block text-left text-xs font-medium text-slate-600">
              Desde
            </span>
            <input
              type="date"
              value={ui.fechaDesde}
              onChange={(e) => ui.setFechaDesde(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label>
            <span className="mb-1 block text-left text-xs font-medium text-slate-600">
              Hasta
            </span>
            <input
              type="date"
              value={ui.fechaHasta}
              onChange={(e) => ui.setFechaHasta(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </label>
        </div>

        <div className="flex items-end justify-between gap-2 lg:col-span-5">
          <button
            type="button"
            onClick={ui.resetFilters}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Limpiar
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Filas:</span>
            <select
              value={ui.pageSize}
              onChange={(e) => ui.setPageSize(Number(e.target.value) as any)}
              className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium text-slate-700">ID</th>
                <th className="px-3 py-2 font-medium text-slate-700">Cliente</th>
                <th className="px-3 py-2 font-medium text-slate-700">WhatsApp</th>
                <th className="px-3 py-2 font-medium text-slate-700">Plan</th>
                <th className="px-3 py-2 font-medium text-slate-700">Fecha tour</th>
                <th className="px-3 py-2 font-medium text-slate-700">Personas</th>
                <th className="px-3 py-2 font-medium text-slate-700">Total</th>
                <th className="px-3 py-2 font-medium text-slate-700">Estado</th>
                <th className="px-3 py-2 font-medium text-slate-700">Solicitud</th>
                <th className="px-3 py-2 font-medium text-slate-700">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {reservasQuery.isLoading ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                    Cargando reservas…
                  </td>
                </tr>
              ) : reservasQuery.isError ? (
                <tr>
                  <td className="px-3 py-6 text-center text-rose-600" colSpan={10}>
                    No se pudieron cargar las reservas.
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                    No hay resultados con los filtros actuales.
                  </td>
                </tr>
              ) : (
                pageItems.map(({ reserva, meta, effectiveStatus, total }) => (
                  <tr
                    key={reserva.id_reserva}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">
                      #{reserva.id_reserva}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {reserva.nombre_cliente?.trim() || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{reserva.telefono_cliente}</td>
                    <td className="px-3 py-2 text-slate-700">{reserva.nombre_plan}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatDateOnly(reserva.fecha_plan)}{" "}
                      <span className="text-xs text-slate-500">{reserva.hora_plan}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{reserva.cantidad_personas}</td>
                    <td className="px-3 py-2 text-slate-700">{formatMoneyCOP(total)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                          statusBadgeClass(effectiveStatus)
                        )}
                        title={meta.paidAt ? `Pagado: ${formatDateTime(meta.paidAt)}` : undefined}
                      >
                        {statusLabel(effectiveStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatDateTime(reserva.fecha_solicitud)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openDetails(reserva)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(reserva)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(reserva)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            {totalItems === 0
              ? "0 resultados"
              : `Mostrando ${startIndex + 1}–${Math.min(
                  startIndex + ui.pageSize,
                  totalItems
                )} de ${totalItems}`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
              onClick={() => ui.setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <div className="text-sm text-slate-700">
              Página <span className="font-medium">{page}</span> / {totalPages}
            </div>
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
              onClick={() => ui.setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* ===== Modal: Detalle ===== */}
      <dialog
        ref={detailsDialogRef}
        className="w-[min(900px,95vw)] rounded-lg border border-slate-200 p-0 backdrop:bg-black/40"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-left text-lg font-semibold text-slate-900">
                  Reserva #{selected.id_reserva}
                </h3>
                <p className="text-left text-sm text-slate-600">
                  {selected.nombre_plan} • {formatDateOnly(selected.fecha_plan)} {selected.hora_plan}
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeDialog(detailsDialogRef)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
              <div className="text-left text-sm">
                <div className="text-xs font-medium text-slate-500">Cliente</div>
                <div className="text-slate-900">{selected.nombre_cliente?.trim() || "—"}</div>
              </div>
              <div className="text-left text-sm">
                <div className="text-xs font-medium text-slate-500">WhatsApp</div>
                <div className="text-slate-900">{selected.telefono_cliente}</div>
              </div>
              <div className="text-left text-sm">
                <div className="text-xs font-medium text-slate-500">Solicitud</div>
                <div className="text-slate-900">{formatDateTime(selected.fecha_solicitud)}</div>
              </div>
              <div className="text-left text-sm">
                <div className="text-xs font-medium text-slate-500">Aprobación (backend)</div>
                <div className="text-slate-900">{formatDateTime(selected.fecha_aprobacion)}</div>
              </div>
              <div className="text-left text-sm">
                <div className="text-xs font-medium text-slate-500">Personas</div>
                <div className="text-slate-900">{selected.cantidad_personas}</div>
              </div>
              <div className="text-left text-sm">
                <div className="text-xs font-medium text-slate-500">Total</div>
                <div className="text-slate-900">
                  {formatMoneyCOP(selected.precio_plan * selected.cantidad_personas)}
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-left">
                    <div className="text-xs font-medium text-slate-500">Estado</div>
                    <div className="text-sm text-slate-900">
                      {selectedEffectiveStatus ? statusLabel(selectedEffectiveStatus) : "—"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedEffectiveStatus ?? "pending"}
                      onChange={(e) => onSetStatus(selected, e.target.value as ReservaStatus)}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="pending">{statusLabel("pending")}</option>
                      <option value="receipt_received">{statusLabel("receipt_received")}</option>
                      <option value="paid_confirmed">{statusLabel("paid_confirmed")}</option>
                      <option value="rejected">{statusLabel("rejected")}</option>
                      <option value="canceled">{statusLabel("canceled")}</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onSetStatus(selected, "paid_confirmed")}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                      disabled={updateReservaMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                      Marcar pagado
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 text-left text-sm font-medium text-slate-900">
                      Recibo
                    </div>
                    {selectedMeta?.receiptDataUrl ? (
                      <a
                        href={selectedMeta.receiptDataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-md border border-slate-200"
                      >
                        <img
                          src={selectedMeta.receiptDataUrl}
                          alt="Recibo"
                          className="max-h-[260px] w-full object-contain bg-slate-50"
                        />
                      </a>
                    ) : (
                      <div className="rounded-md border border-dashed border-slate-200 p-4 text-left text-sm text-slate-600">
                        Sin recibo adjunto.
                      </div>
                    )}

                    <div className="mt-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <Upload className="h-4 w-4" />
                        Subir recibo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            void onUploadReceipt(selected, file);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <p className="mt-1 text-left text-xs text-slate-500">
                        MVP: el recibo se guarda en el navegador (localStorage).
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 text-left text-sm font-medium text-slate-900">
                      Historial
                    </div>
                    <div className="max-h-[320px] space-y-2 overflow-auto">
                      {(selectedMeta?.history ?? []).length === 0 ? (
                        <div className="text-left text-sm text-slate-600">
                          Sin cambios registrados.
                        </div>
                      ) : (
                        (selectedMeta?.history ?? []).map((h) => (
                          <div
                            key={h.id}
                            className="rounded-md border border-slate-200 bg-white p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-left text-xs font-medium text-slate-700">
                                {h.by}
                              </div>
                              <div className="text-xs text-slate-500">
                                {formatDateTime(h.at)}
                              </div>
                            </div>
                            <div className="text-left text-sm text-slate-800">
                              {h.message}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>

      {/* ===== Modal: Crear ===== */}
      <dialog
        ref={createDialogRef}
        className="w-[min(640px,95vw)] rounded-lg border border-slate-200 p-0 backdrop:bg-black/40"
        onClose={() => setIsCreateOpen(false)}
      >
        {isCreateOpen ? (
          <form onSubmit={onCreate} className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-left text-lg font-semibold text-slate-900">
                  Nueva reserva
                </h3>
                <p className="text-left text-sm text-slate-600">
                  Crea una reserva manualmente (uso interno).
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeDialog(createDialogRef)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label>
                <span className="mb-1 block text-left text-xs font-medium text-slate-600">
                  Cliente (teléfono)
                </span>
                <select
                  name="telefono_cliente"
                  value={form.telefono_cliente}
                  onChange={onChangeForm}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">Selecciona un cliente</option>
                  {(clientesQuery.data ?? []).map((c) => (
                    <option key={c.telefono} value={c.telefono}>
                      {c.telefono}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-left text-xs font-medium text-slate-600">
                  Plan
                </span>
                <select
                  name="id_plan"
                  value={form.id_plan}
                  onChange={onChangeForm}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">Selecciona un plan</option>
                  {(planesQuery.data ?? []).map((p) => (
                    <option key={p.id_plan} value={p.id_plan}>
                      {p.nombre_plan} — {formatMoneyCOP(p.precio_plan)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-left text-xs font-medium text-slate-600">
                  Cantidad de personas
                </span>
                <input
                  type="number"
                  name="cantidad_personas"
                  value={form.cantidad_personas}
                  onChange={onChangeForm}
                  min={1}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeDialog(createDialogRef)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={createReservaMutation.isPending}
              >
                Crear
              </button>
            </div>
          </form>
        ) : null}
      </dialog>

      {/* ===== Modal: Editar ===== */}
      <dialog
        ref={editDialogRef}
        className="w-[min(640px,95vw)] rounded-lg border border-slate-200 p-0 backdrop:bg-black/40"
        onClose={() => setIsEditOpen(false)}
      >
        {isEditOpen && selected ? (
          <form onSubmit={onEdit} className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-left text-lg font-semibold text-slate-900">
                  Editar reserva #{selected.id_reserva}
                </h3>
                <p className="text-left text-sm text-slate-600">
                  Actualiza cliente, plan o cantidad.
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeDialog(editDialogRef)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label>
                <span className="mb-1 block text-left text-xs font-medium text-slate-600">
                  Cliente (teléfono)
                </span>
                <select
                  name="telefono_cliente"
                  value={form.telefono_cliente}
                  onChange={onChangeForm}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">Selecciona un cliente</option>
                  {(clientesQuery.data ?? []).map((c) => (
                    <option key={c.telefono} value={c.telefono}>
                      {c.telefono}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-left text-xs font-medium text-slate-600">
                  Plan
                </span>
                <select
                  name="id_plan"
                  value={form.id_plan}
                  onChange={onChangeForm}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">Selecciona un plan</option>
                  {(planesQuery.data ?? []).map((p) => (
                    <option key={p.id_plan} value={p.id_plan}>
                      {p.nombre_plan} — {formatMoneyCOP(p.precio_plan)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-left text-xs font-medium text-slate-600">
                  Cantidad de personas
                </span>
                <input
                  type="number"
                  name="cantidad_personas"
                  value={form.cantidad_personas}
                  onChange={onChangeForm}
                  min={1}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeDialog(editDialogRef)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={updateReservaMutation.isPending}
              >
                Guardar
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </section>
  );
}