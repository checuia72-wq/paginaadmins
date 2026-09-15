import { useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";

export type ImportedGroupParticipant = {
  nombre: string;
  edad: string;
  nacionalidad: string;
  tipo_documento: string;
  numero_documento: string;
  correo: string;
  telefono: string;
};

type Props = {
  participants: ImportedGroupParticipant[];
  fileName: string;
  onImport: (participants: ImportedGroupParticipant[], fileName: string) => void;
  onClear: () => void;
  disabled?: boolean;
};

const REQUIRED_HEADERS = [
  "NOMBRE",
  "EDAD",
  "NACIONALIDAD",
  "TIPO_DOCUMENTO",
  "NUMERO_DOCUMENTO",
  "TELEFONO",
  "CORREO",
];

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cell(row: Record<string, unknown>, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeKey(key))) return String(value ?? "").trim();
  }
  return "";
}

function normalizeDocumentType(value: string) {
  const key = normalizeKey(value);
  if (!key || key === "CC" || key.includes("CEDULA_DE_CIUDADANIA") || key === "CEDULA") return "CC";
  if (key === "TI" || key.includes("TARJETA_DE_IDENTIDAD")) return "TI";
  if (key === "CE" || key.includes("CEDULA_DE_EXTRANJERIA")) return "CE";
  if (key.includes("PASAPORTE")) return "PASAPORTE";
  return "OTRO";
}

function buildParticipant(row: Record<string, unknown>): ImportedGroupParticipant {
  return {
    nombre: cell(row, ["NOMBRE", "NOMBRE COMPLETO", "NOMBRE_COMPLETO"]),
    edad: cell(row, ["EDAD"]),
    nacionalidad: cell(row, ["NACIONALIDAD", "PAIS", "PAÍS"]),
    tipo_documento: normalizeDocumentType(cell(row, ["TIPO DOCUMENTO", "TIPO_DOCUMENTO", "TIPO DE DOCUMENTO"])),
    numero_documento: cell(row, ["NUMERO DOCUMENTO", "NÚMERO DOCUMENTO", "NUMERO_DOCUMENTO", "DOCUMENTO", "CEDULA", "CÉDULA"]),
    telefono: cell(row, ["TELEFONO", "TELÉFONO", "CELULAR", "CONTACTO"]),
    correo: cell(row, ["CORREO", "EMAIL", "E-MAIL"]),
  };
}

function validateParticipants(rows: ImportedGroupParticipant[]) {
  const errors: string[] = [];
  const documents = new Map<string, number>();

  rows.forEach((participant, index) => {
    const rowNumber = index + 2;
    if (!participant.nombre) errors.push(`Fila ${rowNumber}: falta el nombre.`);
    if (!participant.nacionalidad) errors.push(`Fila ${rowNumber}: falta la nacionalidad.`);
    if (!participant.numero_documento) errors.push(`Fila ${rowNumber}: falta el número de documento.`);
    if (!participant.telefono) errors.push(`Fila ${rowNumber}: falta el teléfono.`);

    if (participant.edad) {
      const age = Number(participant.edad);
      if (!Number.isFinite(age) || age < 0 || age > 120) {
        errors.push(`Fila ${rowNumber}: la edad no es válida.`);
      }
    }

    const doc = participant.numero_documento.replace(/\s+/g, "").toUpperCase();
    if (doc) {
      const previous = documents.get(doc);
      if (previous != null) errors.push(`Filas ${previous} y ${rowNumber}: documento duplicado ${participant.numero_documento}.`);
      else documents.set(doc, rowNumber);
    }
  });

  if (rows.length > 0 && rows.length < 31) {
    errors.push("La lista tiene menos de 31 personas. Para esa cantidad usa una reserva normal en lugar de Grupo grande.");
  }
  if (rows.length > 1000) errors.push("La lista supera el máximo de 1.000 participantes por grupo.");
  return errors;
}

function downloadTemplate() {
  const workbook = XLSX.utils.book_new();
  const participantsSheet = XLSX.utils.aoa_to_sheet([REQUIRED_HEADERS]);
  participantsSheet["!cols"] = [
    { wch: 28 },
    { wch: 8 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 18 },
    { wch: 30 },
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ["PLANTILLA DE PARTICIPANTES - GRUPO GRANDE"],
    ["La primera fila de datos será tomada como el encargado del grupo."],
    ["Registra una persona por fila. No dejes filas vacías entre participantes."],
    ["Obligatorios: NOMBRE, NACIONALIDAD, NUMERO_DOCUMENTO y TELEFONO."],
    ["Opcionales: EDAD y CORREO."],
    ["TIPO_DOCUMENTO puede ser CC, TI, CE, PASAPORTE u OTRO."],
    ["La cantidad de personas de la reserva se actualizará con el total de filas válidas importadas."],
  ]);
  instructionsSheet["!cols"] = [{ wch: 95 }];

  XLSX.utils.book_append_sheet(workbook, participantsSheet, "Participantes");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instrucciones");
  XLSX.writeFile(workbook, "Plantilla_Participantes_Grupo_Grande.xlsx");
}

export default function LargeGroupExcelImport({ participants, fileName, onImport, onClear, disabled = false }: Props) {
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setReading(true);
    setErrors([]);

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("El archivo no contiene hojas para importar.");

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
        defval: "",
        raw: false,
      });

      const parsed = rawRows
        .map(buildParticipant)
        .filter((row) => Object.values(row).some((value) => String(value).trim() !== ""));

      if (!parsed.length) throw new Error("No se encontraron participantes. Verifica que la primera fila contenga los encabezados de la plantilla.");

      const validationErrors = validateParticipants(parsed);
      if (validationErrors.length) {
        setErrors(validationErrors);
        return;
      }

      onImport(parsed, file.name);
    } catch (error: any) {
      setErrors([error?.message || "No fue posible leer el archivo Excel."]);
    } finally {
      setReading(false);
    }
  };

  const imported = participants.length > 1;

  return (
    <div style={{ border: "1px solid #cfe5d8", borderRadius: 14, padding: 14, marginBottom: 16, background: "#f7fcf9" }}>
      <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#245a42" }}>
            <FileSpreadsheet size={18} /> Lista de participantes en Excel
          </div>
          <p style={{ margin: "6px 0 0", color: "#607568", fontSize: 13, lineHeight: 1.45 }}>
            Descarga la plantilla o carga un .xlsx/.xls. La primera fila de datos será el encargado y la cantidad del grupo se ajustará automáticamente.
          </p>
        </div>
        <button type="button" onClick={downloadTemplate} disabled={disabled} className="rv-btn-cancel" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Download size={15} /> Descargar plantilla
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        <label className="rv-btn-save" style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: disabled || reading ? "wait" : "pointer", margin: 0 }}>
          <Upload size={15} /> {reading ? "Leyendo Excel..." : imported ? "Reemplazar Excel" : "Importar participantes"}
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={disabled || reading}
            style={{ display: "none" }}
            onChange={(event) => {
              const input = event.currentTarget;
              void handleFile(input.files?.[0] ?? null).finally(() => { input.value = ""; });
            }}
          />
        </label>

        {imported && (
          <button type="button" onClick={onClear} disabled={disabled} className="rv-btn-cancel" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <X size={14} /> Quitar lista
          </button>
        )}

        {fileName && <span style={{ fontSize: 12, color: "#64748b" }}>{fileName}</span>}
      </div>

      {errors.length > 0 && (
        <div style={{ marginTop: 12, border: "1px solid #fecaca", borderRadius: 10, padding: 10, background: "#fff7f7", color: "#9f2d2d", fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, marginBottom: 5 }}><AlertTriangle size={15} /> Corrige el Excel antes de importarlo</div>
          {errors.slice(0, 8).map((error, index) => <div key={`${error}-${index}`}>• {error}</div>)}
          {errors.length > 8 && <div>• ...y {errors.length - 8} errores más.</div>}
        </div>
      )}

      {imported && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <strong style={{ color: "#245a42" }}>{participants.length} participantes listos para guardar</strong>
            <span style={{ fontSize: 12, color: "#64748b" }}>Encargado: {participants[0]?.nombre || "—"}</span>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #dce9e1", borderRadius: 10, background: "white" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#edf7f1", textAlign: "left" }}>
                  <th style={{ padding: 8 }}>#</th><th style={{ padding: 8 }}>Nombre</th><th style={{ padding: 8 }}>Documento</th><th style={{ padding: 8 }}>Teléfono</th><th style={{ padding: 8 }}>Nacionalidad</th>
                </tr>
              </thead>
              <tbody>
                {participants.slice(0, 8).map((participant, index) => (
                  <tr key={`${participant.numero_documento}-${index}`} style={{ borderTop: "1px solid #eef2ef" }}>
                    <td style={{ padding: 8 }}>{index + 1}</td>
                    <td style={{ padding: 8 }}>{participant.nombre}{index === 0 ? " · Encargado" : ""}</td>
                    <td style={{ padding: 8 }}>{participant.tipo_documento} {participant.numero_documento}</td>
                    <td style={{ padding: 8 }}>{participant.telefono}</td>
                    <td style={{ padding: 8 }}>{participant.nacionalidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {participants.length > 8 && <div style={{ marginTop: 7, fontSize: 12, color: "#64748b" }}>Vista previa: 8 de {participants.length} participantes.</div>}
        </div>
      )}
    </div>
  );
}
