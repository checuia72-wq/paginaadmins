import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  getControlOperativo,
  getDevolucionesControlOperativo,
  getPagosControlOperativo,
  type ControlOperativoRow,
  type ReservaDevolucion,
  type ReservaPago,
} from "../../services/controlOperativo.service";

const fecha = (value?: string | null) => {
  const raw = String(value ?? "").slice(0, 10);
  if (!raw) return "";
  const [year, month, day] = raw.split("-");
  return year && month && day ? `${day}/${month}/${year}` : raw;
};

const hora = (value?: string | null) => String(value ?? "").slice(0, 5);
const texto = (value: unknown) => String(value ?? "").trim();
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

const estadoLabel = (value: string) => ({
  programada: "Programada",
  asistio: "Asistió",
  no_asistio: "No asistió",
  reprogramada: "Reprogramada",
  cancelada: "Cancelada",
}[value] ?? value);

function agruparPorReserva(rows: ControlOperativoRow[]) {
  const map = new Map<number, ControlOperativoRow[]>();
  for (const row of rows) {
    const current = map.get(row.id_reserva) ?? [];
    current.push(row);
    map.set(row.id_reserva, current);
  }
  return [...map.values()];
}

function pagosPorReserva(pagos: ReservaPago[]) {
  const map = new Map<number, ReservaPago[]>();
  for (const pago of pagos) {
    const current = map.get(pago.id_reserva) ?? [];
    current.push(pago);
    map.set(pago.id_reserva, current);
  }
  return map;
}

function devolucionesPorReserva(devoluciones: ReservaDevolucion[]) {
  const map = new Map<number, ReservaDevolucion[]>();
  for (const devolucion of devoluciones) {
    const current = map.get(devolucion.id_reserva) ?? [];
    current.push(devolucion);
    map.set(devolucion.id_reserva, current);
  }
  return map;
}

async function exportarControlOperativoExcel() {
  const [rows, pagos, devoluciones] = await Promise.all([
    getControlOperativo(),
    getPagosControlOperativo(),
    getDevolucionesControlOperativo(),
  ]);

  const grupos = agruparPorReserva(rows);
  const pagosMap = pagosPorReserva(pagos);
  const devolucionesMap = devolucionesPorReserva(devoluciones);

  const headers = [
    "Código", "Estado operativo", "Motivo estado", "Plan", "Fecha reserva", "Hora",
    "Cantidad personas", "Participantes", "Edades", "Nacionalidades", "Tipos documento",
    "Documentos", "Contactos participantes", "Contacto cliente", "Mina", "Refrigerio",
    "Restaurante", "Incluye almuerzo", "Tipos de almuerzo", "Valor total", "Abono",
    "Medio abono", "Pago saldo", "Medio saldo", "Total recaudado", "Devuelto",
    "Neto caja", "Saldo pendiente", "Observación",
  ];

  const data = grupos.map((grupo) => {
    const principal = grupo[0];
    const pagosReserva = pagosMap.get(principal.id_reserva) ?? [];
    const devolucionesReserva = devolucionesMap.get(principal.id_reserva) ?? [];
    const recaudado = pagosReserva.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
    const devuelto = devolucionesReserva.reduce((sum, item) => sum + Number(item.monto || 0), 0);
    const join = (selector: (row: ControlOperativoRow) => unknown) =>
      grupo.map(selector).map(texto).filter(Boolean).join(" | ");
    const mediosSaldo = pagosReserva
      .filter((pago) => pago.tipo_pago === "saldo")
      .map((pago) => pago.medio_pago)
      .filter(Boolean);

    return [
      principal.reserva_codigo, estadoLabel(principal.estado_operativo), principal.motivo_estado_operativo,
      principal.plan, fecha(principal.fecha), hora(principal.hora), Number(principal.cantidad || grupo.length || 0),
      join((row) => row.nombre), join((row) => row.edad), join((row) => row.nacionalidad),
      join((row) => row.tipo_documento), join((row) => row.documento), join((row) => row.contacto),
      principal.contacto_cliente, principal.mina ? "Sí" : "No", principal.refrigerio ? "Sí" : "No",
      principal.restaurante || "", principal.incluye_almuerzo ? "Sí" : "No", join((row) => row.almuerzo),
      Number(principal.total || 0), Number(principal.abono || 0), principal.medio_abono || "",
      Number(principal.pago_saldo || 0), [...new Set(mediosSaldo)].join(" | ") || principal.medio_saldo || "",
      recaudado, devuelto, Math.max(0, recaudado - devuelto), Number(principal.saldo_pendiente || 0),
      principal.observacion || "",
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  worksheet["!autofilter"] = { ref: `A1:AC${Math.max(1, data.length + 1)}` };
  worksheet["!cols"] = [18,18,28,42,15,10,15,38,18,28,28,30,32,20,10,12,20,18,30,16,16,20,16,24,18,16,16,18,40].map((wch) => ({ wch }));

  const moneyColumns = new Set([19, 20, 22, 24, 25, 26, 27]);
  for (let row = 1; row <= data.length; row += 1) {
    for (const col of moneyColumns) {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[ref]) worksheet[ref].z = "$#,##0";
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reservas");

  const pagosSheet = XLSX.utils.json_to_sheet(pagos.map((pago) => ({
    Reserva: rows.find((row) => row.id_reserva === pago.id_reserva)?.reserva_codigo ?? `#${pago.id_reserva}`,
    Tipo: pago.tipo_pago === "saldo" ? "Saldo" : "Abono",
    Valor: Number(pago.monto || 0),
    "Medio de pago": pago.medio_pago,
    "Fecha de pago": pago.fecha_pago ? new Date(pago.fecha_pago).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "",
    Observación: pago.observacion ?? "",
  })));
  pagosSheet["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(workbook, pagosSheet, "Pagos");

  const devolucionesSheet = XLSX.utils.json_to_sheet(devoluciones.map((item) => ({
    Reserva: rows.find((row) => row.id_reserva === item.id_reserva)?.reserva_codigo ?? `#${item.id_reserva}`,
    Valor: Number(item.monto || 0), Medio: item.medio_pago, Tipo: item.tipo_devolucion,
    Motivo: item.motivo ?? "", Observación: item.observacion ?? "",
    Fecha: item.fecha_devolucion ? new Date(item.fecha_devolucion).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "",
  })));
  devolucionesSheet["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 30 }, { wch: 36 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, devolucionesSheet, "Devoluciones");

  XLSX.writeFile(workbook, `Control_Operativo_Todas_Las_Reservas_${hoy()}.xlsx`, { compression: true });
}

function exportarPolizas(fechaSeleccionada: string, rows: ControlOperativoRow[]) {
  const activos = rows.filter((row) =>
    String(row.fecha || "").slice(0, 10) === fechaSeleccionada &&
    row.estado_operativo !== "cancelada" &&
    row.estado_operativo !== "no_asistio"
  );

  const unicos = new Map<string, ControlOperativoRow>();
  activos.forEach((row) => {
    const key = row.id_participante != null
      ? `p-${row.id_participante}`
      : `${row.id_reserva}-${texto(row.documento)}-${texto(row.nombre)}`;
    if (!unicos.has(key)) unicos.set(key, row);
  });

  const asistentes = [...unicos.values()]
    .filter((row) => texto(row.nombre) || texto(row.documento))
    .sort((a, b) => texto(a.nombre).localeCompare(texto(b.nombre), "es"));

  if (!asistentes.length) throw new Error("No hay asistentes activos registrados para la fecha seleccionada.");

  const data = asistentes.map((row) => ({
    NOMBRE: texto(row.nombre),
    "CÉDULA": texto(row.documento),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet["!autofilter"] = { ref: `A1:B${data.length + 1}` };
  worksheet["!cols"] = [{ wch: 38 }, { wch: 24 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Asistentes");
  XLSX.writeFile(workbook, `Polizas_Asistentes_${fechaSeleccionada}.xlsx`, { compression: true });
}

export default function ControlOperativoExcelExport() {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(hoy());
  const [rows, setRows] = useState<ControlOperativoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const asistentesCount = useMemo(() => {
    const keys = new Set<string>();
    rows
      .filter((row) => String(row.fecha || "").slice(0, 10) === selectedDate && row.estado_operativo !== "cancelada" && row.estado_operativo !== "no_asistio")
      .forEach((row) => keys.add(row.id_participante != null ? `p-${row.id_participante}` : `${row.id_reserva}-${texto(row.documento)}-${texto(row.nombre)}`));
    return keys.size;
  }, [rows, selectedDate]);

  useEffect(() => {
    const ensureExportButtons = () => {
      if (!window.location.pathname.includes("/app/control-operativo")) return;

      const existingExcel = document.querySelector<HTMLButtonElement>('button[data-control-export="excel"]');
      const existingPolicies = document.querySelector<HTMLButtonElement>('button[data-control-export="policies"]');
      if (existingExcel && existingPolicies) return;

      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
      const base = buttons.find((button) => {
        const label = (button.textContent ?? "").trim();
        return /^exportar$/i.test(label) || /^exportar excel$/i.test(label) || /^exportar pólizas$/i.test(label);
      });
      if (!base) return;

      base.dataset.controlExport = "excel";
      const baseText = Array.from(base.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
      if (baseText) baseText.nodeValue = " Exportar Excel";
      else base.append(" Exportar Excel");
      base.title = "Exportar todas las reservas a Excel";

      if (!existingPolicies) {
        const policyButton = base.cloneNode(true) as HTMLButtonElement;
        policyButton.dataset.controlExport = "policies";
        policyButton.removeAttribute("id");
        const policyText = Array.from(policyButton.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
        if (policyText) policyText.nodeValue = " Exportar pólizas";
        else policyButton.append(" Exportar pólizas");
        policyButton.title = "Exportar nombres y cédulas por fecha";
        policyButton.style.marginLeft = "8px";
        base.insertAdjacentElement("afterend", policyButton);
      }
    };

    ensureExportButtons();
    const observer = new MutationObserver(ensureExportButtons);
    observer.observe(document.body, { childList: true, subtree: true });

    const onClick = async (event: MouseEvent) => {
      if (!window.location.pathname.includes("/app/control-operativo")) return;
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      const mode = button?.dataset.controlExport;
      if (!button || (mode !== "excel" && mode !== "policies")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (mode === "excel") {
        const original = button.innerHTML;
        button.disabled = true;
        button.textContent = "Generando Excel…";
        try {
          await exportarControlOperativoExcel();
        } catch (e) {
          console.error("No fue posible exportar el control operativo a Excel:", e);
          window.alert("No fue posible generar el archivo Excel. Intenta nuevamente.");
        } finally {
          button.disabled = false;
          button.innerHTML = original;
        }
        return;
      }

      const pageDate = (document.querySelector('.op-filters input[type="date"]') as HTMLInputElement | null)?.value;
      setSelectedDate(pageDate || hoy());
      setOpen(true);
      setError("");
      setLoading(true);
      try {
        setRows(await getControlOperativo());
      } catch (e: any) {
        setError(e?.message || "No fue posible cargar las reservas para exportar pólizas.");
      } finally {
        setLoading(false);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.querySelector('button[data-control-export="policies"]')?.remove();
    };
  }, []);

  const exportPolicies = async () => {
    setError("");
    setExporting(true);
    try {
      const latest = await getControlOperativo();
      setRows(latest);
      exportarPolizas(selectedDate, latest);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "No fue posible generar el archivo de pólizas.");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:99999, background:"rgba(16,13,10,.58)", backdropFilter:"blur(4px)", display:"grid", placeItems:"center", padding:20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="policy-export-title" style={{ width:"min(520px,100%)", background:"#fffdf9", border:"1px solid #e8d7bd", borderRadius:20, boxShadow:"0 28px 80px rgba(40,27,9,.28)", overflow:"hidden" }}>
        <div style={{ padding:"24px 26px 18px", borderBottom:"1px solid #eee2d2", display:"flex", justifyContent:"space-between", gap:16 }}>
          <div>
            <div style={{ color:"#b67b24", fontSize:12, fontWeight:800, letterSpacing:1, textTransform:"uppercase" }}>Control operativo</div>
            <h2 id="policy-export-title" style={{ margin:"5px 0 4px", fontSize:24, color:"#211a12" }}>Exportar pólizas</h2>
            <p style={{ margin:0, color:"#786b5d", fontSize:14 }}>Selecciona la fecha de visita. El Excel incluirá únicamente nombre y cédula de los asistentes activos de ese día.</p>
          </div>
          <button type="button" onClick={() => !exporting && setOpen(false)} disabled={exporting} aria-label="Cerrar" style={{ width:36, height:36, borderRadius:10, border:"1px solid #e5d5be", background:"white", cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:"24px 26px" }}>
          <label style={{ display:"grid", gap:8, color:"#4f4438", fontSize:13, fontWeight:700 }}>
            Fecha de visita
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setError(""); }} style={{ width:"100%", boxSizing:"border-box", height:48, border:"1px solid #d9c4a6", borderRadius:12, padding:"0 14px", fontSize:16, color:"#2f271e", background:"#fff" }} />
          </label>

          <div style={{ marginTop:16, padding:"14px 16px", borderRadius:12, background:"#f8f2e8", border:"1px solid #ead9bf", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
            <span style={{ color:"#6d5d49", fontSize:14 }}>{loading ? "Consultando reservas…" : "Asistentes encontrados"}</span>
            <strong style={{ color:"#9b661b", fontSize:18 }}>{loading ? "…" : asistentesCount}</strong>
          </div>

          {error && <div style={{ marginTop:14, padding:"12px 14px", borderRadius:10, background:"#fff1f0", border:"1px solid #f0c7c3", color:"#a33a31", fontSize:13 }}>{error}</div>}
        </div>

        <div style={{ padding:"16px 26px 22px", borderTop:"1px solid #eee2d2", display:"flex", justifyContent:"flex-end", gap:10 }}>
          <button type="button" onClick={() => setOpen(false)} disabled={exporting} style={{ height:44, padding:"0 16px", borderRadius:11, border:"1px solid #ddd0bd", background:"#fff", color:"#5d5145", fontWeight:700, cursor:"pointer" }}>Cancelar</button>
          <button type="button" onClick={exportPolicies} disabled={loading || exporting || !selectedDate || asistentesCount === 0} style={{ height:44, padding:"0 18px", borderRadius:11, border:0, background:"#c58b31", color:"#fff", fontWeight:800, cursor:"pointer", opacity:(loading || exporting || !selectedDate || asistentesCount === 0) ? .55 : 1 }}>{exporting ? "Generando…" : "Exportar pólizas"}</button>
        </div>
      </div>
    </div>
  );
}
