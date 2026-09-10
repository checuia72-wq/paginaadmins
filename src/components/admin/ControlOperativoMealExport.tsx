import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getControlOperativo, type ControlOperativoRow } from "../../services/controlOperativo.service";

const texto = (value: unknown) => String(value ?? "").trim();
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

const RESTAURANTES = ["Garden", "Colonial", "Rusticos"] as const;

type RestauranteExport = (typeof RESTAURANTES)[number];

function normalizarRestaurante(value: unknown): RestauranteExport | null {
  const raw = texto(value).toLowerCase();
  if (raw === "garden") return "Garden";
  if (raw === "colonial") return "Colonial";
  if (raw === "rusticos" || raw === "rústicos") return "Rusticos";
  return null;
}

function participantesAlmuerzoPorFecha(fechaSeleccionada: string, rows: ControlOperativoRow[]) {
  const unicos = new Map<string, ControlOperativoRow>();

  rows
    .filter((row) =>
      String(row.fecha || "").slice(0, 10) === fechaSeleccionada &&
      row.estado_operativo !== "cancelada" &&
      row.estado_operativo !== "no_asistio" &&
      !!row.incluye_almuerzo &&
      !!normalizarRestaurante(row.restaurante)
    )
    .forEach((row) => {
      const key = row.id_participante != null
        ? `p-${row.id_participante}`
        : `${row.id_reserva}-${texto(row.documento)}-${texto(row.nombre)}`;
      if (!unicos.has(key)) unicos.set(key, row);
    });

  return [...unicos.values()];
}

function exportarAlmuerzos(fechaSeleccionada: string, rows: ControlOperativoRow[]) {
  const participantes = participantesAlmuerzoPorFecha(fechaSeleccionada, rows);
  if (!participantes.length) {
    throw new Error("No hay participantes con almuerzo registrados para la fecha seleccionada.");
  }

  const workbook = XLSX.utils.book_new();

  for (const restaurante of RESTAURANTES) {
    const data = participantes
      .filter((row) => normalizarRestaurante(row.restaurante) === restaurante)
      .sort((a, b) => texto(a.nombre).localeCompare(texto(b.nombre), "es"))
      .map((row) => ({
        NOMBRE: texto(row.nombre),
        "CÉDULA": texto(row.documento),
        PLATO: texto(row.almuerzo) || "Sin plato asignado",
      }));

    const worksheet = data.length
      ? XLSX.utils.json_to_sheet(data)
      : XLSX.utils.aoa_to_sheet([["NOMBRE", "CÉDULA", "PLATO"]]);

    worksheet["!autofilter"] = { ref: `A1:C${Math.max(1, data.length + 1)}` };
    worksheet["!cols"] = [{ wch: 38 }, { wch: 24 }, { wch: 42 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, restaurante);
  }

  XLSX.writeFile(workbook, `Almuerzos_${fechaSeleccionada}.xlsx`, { compression: true });
}

export default function ControlOperativoMealExport() {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(hoy());
  const [rows, setRows] = useState<ControlOperativoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const participantes = useMemo(
    () => participantesAlmuerzoPorFecha(selectedDate, rows),
    [selectedDate, rows]
  );

  const conteo = useMemo(() => {
    const result: Record<RestauranteExport, number> = { Garden: 0, Colonial: 0, Rusticos: 0 };
    participantes.forEach((row) => {
      const restaurante = normalizarRestaurante(row.restaurante);
      if (restaurante) result[restaurante] += 1;
    });
    return result;
  }, [participantes]);

  useEffect(() => {
    const ensureButton = () => {
      if (!window.location.pathname.includes("/app/control-operativo")) return;
      if (document.querySelector('button[data-control-export="meals"]')) return;

      const mineButton = document.querySelector<HTMLButtonElement>('button[data-control-export="mines"]');
      const excelButton = document.querySelector<HTMLButtonElement>('button[data-control-export="excel"]');
      const base = mineButton ?? excelButton;
      if (!base) return;

      const button = base.cloneNode(true) as HTMLButtonElement;
      button.dataset.controlExport = "meals";
      button.removeAttribute("id");
      const textNode = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.nodeValue = " Exportar almuerzos";
      else button.append(" Exportar almuerzos");
      button.title = "Exportar nombre, cédula y plato por restaurante y fecha";
      button.style.marginLeft = "8px";
      base.insertAdjacentElement("afterend", button);
    };

    ensureButton();
    const observer = new MutationObserver(ensureButton);
    observer.observe(document.body, { childList: true, subtree: true });

    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button[data-control-export="meals"]') as HTMLButtonElement | null;
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      setError("");
      setOpen(true);
      setLoading(true);
      try {
        setRows(await getControlOperativo());
      } catch (e: any) {
        setError(e?.message || "No fue posible cargar los participantes.");
      } finally {
        setLoading(false);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.querySelector('button[data-control-export="meals"]')?.remove();
    };
  }, []);

  const handleExport = () => {
    setError("");
    setExporting(true);
    try {
      exportarAlmuerzos(selectedDate, rows);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "No fue posible generar el archivo Excel.");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15, 23, 42, .48)", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "min(560px, 100%)", background: "#fff", borderRadius: 18, boxShadow: "0 24px 70px rgba(15,23,42,.25)", overflow: "hidden" }}>
        <div style={{ padding: "22px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#b7791f", textTransform: "uppercase" }}>Exportación de almuerzos</div>
            <h2 style={{ margin: "6px 0 4px", fontSize: 22 }}>Listado por restaurante</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Genera un Excel con hojas separadas para Garden, Colonial y Rústicos.</p>
          </div>
          <button onClick={() => setOpen(false)} style={{ border: 0, background: "transparent", fontSize: 24, cursor: "pointer", color: "#64748b", alignSelf: "flex-start" }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Fecha de visita</label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: "100%", height: 44, border: "1px solid #d6b77a", borderRadius: 10, padding: "0 12px", fontSize: 15, boxSizing: "border-box" }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 18 }}>
            {RESTAURANTES.map((restaurante) => (
              <div key={restaurante} style={{ border: "1px solid #ead8b5", background: "#fffaf1", borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, color: "#7c6a50" }}>{restaurante}</div>
                <strong style={{ fontSize: 20 }}>{loading ? "…" : conteo[restaurante]}</strong>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>participantes</div>
              </div>
            ))}
          </div>

          {error && <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#fff1f2", color: "#be123c", fontSize: 13 }}>{error}</div>}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={() => setOpen(false)} style={{ height: 42, padding: "0 18px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>Cancelar</button>
          <button onClick={handleExport} disabled={loading || exporting || !selectedDate} style={{ height: 42, padding: "0 18px", borderRadius: 10, border: 0, background: "#c58b2b", color: "#111827", fontWeight: 700, cursor: "pointer", opacity: loading || exporting ? .65 : 1 }}>
            {exporting ? "Generando…" : `Exportar ${participantes.length} participantes`}
          </button>
        </div>
      </div>
    </div>
  );
}
