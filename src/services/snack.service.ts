import { supabase } from "../lib/supabase";
import { getCurrentRole } from "./role.service";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type SnackLocationCode = "taquilla_1" | "enclave";

export const SNACK_LOCATIONS: Array<{ code: SnackLocationCode; label: string }> = [
  { code: "taquilla_1", label: "Taquilla 1" },
  { code: "enclave", label: "Enclave" },
];

export function snackLocationLabel(code?: string | null) {
  return SNACK_LOCATIONS.find((item) => item.code === code)?.label ?? String(code || "Taquilla 1");
}

export type SnackProduct = {
  id_producto: number;
  numero_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SnackAdminProduct = SnackProduct & {
  precio_compra: number | null;
  cantidad_taquilla_1: number;
  cantidad_enclave: number;
  cantidad_total: number;
};

export type SnackExpiryLot = {
  id_lote_vencimiento: number;
  id_producto: number;
  numero_producto: string;
  nombre_producto: string;
  codigo_ubicacion: SnackLocationCode;
  fecha_vencimiento: string;
  cantidad_inicial: number;
  cantidad_actual: number;
  observacion: string;
  created_at: string;
  updated_at: string;
};

export type SnackInventoryVerificationRow = {
  id_producto: number;
  numero_producto: string;
  nombre_producto: string;
  codigo_ubicacion: SnackLocationCode;
  cantidad_sistema: number;
  ultima_verificacion_fecha: string | null;
  ultima_cantidad_sistema: number | null;
  ultima_cantidad_contada: number | null;
  ultima_coincide: boolean | null;
  ultima_observacion: string;
  ultima_verificado_email: string;
};

export type SnackAdminDashboardProduct = {
  id_producto: number | null;
  nombre_producto: string;
  unidades: number;
  ingresos: number;
  costo: number;
  ganancia: number;
  margen: number;
  lineas_sin_costo: number;
};

export type SnackLocationMetric = {
  ubicacion_codigo: string;
  ubicacion: string;
  ventas: number;
  unidades: number;
  ingresos: number;
};

export type SnackAdminDashboard = {
  ventas: number;
  ingresos: number;
  unidades: number;
  costo_vendido: number;
  ganancia_bruta: number;
  margen: number;
  ticket_promedio: number;
  lineas_sin_costo: number;
  costos_estimados: number;
  retiros_unidades: number;
  costo_retiros: number;
  productos_activos: number;
  stock_unidades: number;
  capital_invertido: number;
  valor_potencial_venta: number;
  ganancia_potencial: number;
  productos_sin_costo: number;
  top_productos: SnackAdminDashboardProduct[];
  metodos_pago: Array<{ medio_pago: string; ventas: number; total: number }>;
  ubicaciones: SnackLocationMetric[];
};

export type SnackSaleItem = {
  id_detalle: number;
  id_venta: number;
  id_producto: number | null;
  numero_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

export type SnackSalePayment = {
  id_pago: number | null;
  id_venta: number;
  medio_pago: string;
  monto: number;
  referencia_pago: string;
};

export type SnackSale = {
  id_venta: number;
  fecha_venta: string;
  medio_pago: string;
  referencia_pago: string;
  total: number;
  vendedor_user_id: string | null;
  vendedor_email: string;
  ubicacion_codigo: SnackLocationCode;
  items: SnackSaleItem[];
  pagos: SnackSalePayment[];
};

export type SnackSaleInput = {
  id_producto: number;
  cantidad: number;
};

export type SnackSalePaymentInput = {
  monto: number;
  medio_pago: string;
  referencia_pago?: string;
};

export type ReservationSnackSaleResult = {
  id_venta: number;
  total: number;
  nuevo_total: number;
  saldo_pendiente: number;
  medio_pago: string;
  ubicacion: SnackLocationCode;
  observacion: string;
};

export type ReservationSnackSaleCancellationResult = {
  id_venta: number;
  total_retirado: number;
  nuevo_total: number;
  saldo_pendiente: number;
  exceso_pagado: number;
  observacion: string;
};

export type SnackSaleDeletionResult = {
  id_venta: number;
  total_eliminado: number;
  ubicacion: SnackLocationCode;
  id_reserva: number | null;
  nuevo_total: number | null;
  saldo_pendiente: number | null;
  observacion: string;
};

export type SnackTransfer = {
  id_transferencia: number;
  id_producto: number;
  numero_producto: string;
  nombre_producto: string;
  origen_codigo: SnackLocationCode;
  destino_codigo: SnackLocationCode;
  cantidad: number;
  motivo: string;
  registrado_email: string;
  created_at: string;
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isMissingLocationSchema = (error: any) =>
  error?.code === "42P01" ||
  error?.code === "PGRST205" ||
  String(error?.message || "").includes("snack_inventario_ubicacion");

const isMissingSalePaymentSchema = (error: any) =>
  error?.code === "42P01" ||
  error?.code === "PGRST205" ||
  String(error?.message || "").includes("snack_venta_pago");

const isMissingMultiPaymentRpc = (error: any) =>
  error?.code === "PGRST202" ||
  error?.code === "42883" ||
  String(error?.message || "").includes("registrar_venta_snack_multi_pago");

async function requireAdmin() {
  const current = await getCurrentRole();
  if (current?.role !== "administrador") {
    throw new Error("Solo un administrador puede realizar esta acción.");
  }
  return current;
}

async function requireInventoryManager() {
  const current = await getCurrentRole();
  if (current?.role !== "administrador" && current?.role !== "coordinador") {
    throw new Error("Solo Administración o Coordinación pueden modificar el inventario de snacks.");
  }
  return current;
}

export async function getSnackProducts(
  includeInactive = false,
  ubicacion: SnackLocationCode = "taquilla_1",
): Promise<SnackProduct[]> {
  let query = client()
    .from("snack_producto")
    .select("id_producto,numero_producto,nombre_producto,cantidad,precio,activo,created_at,updated_at")
    .order("numero_producto", { ascending: true });

  if (!includeInactive) query = query.eq("activo", true);
  const { data: products, error: productError } = await query;
  if (productError) throw productError;

  const { data: stocks, error: stockError } = await client()
    .from("snack_inventario_ubicacion")
    .select("id_producto,cantidad")
    .eq("codigo_ubicacion", ubicacion);

  if (stockError && !isMissingLocationSchema(stockError)) throw stockError;

  const stockMap = new Map<number, number>();
  for (const row of stocks ?? []) stockMap.set(Number((row as any).id_producto), num((row as any).cantidad));

  return (products ?? []).map((row: any) => ({
    ...row,
    id_producto: Number(row.id_producto),
    cantidad: stockError
      ? (ubicacion === "taquilla_1" ? num(row.cantidad) : 0)
      : (stockMap.get(Number(row.id_producto)) ?? 0),
    precio: num(row.precio),
    activo: row.activo !== false,
  })) as SnackProduct[];
}

export async function getSnackProductsAdmin(includeInactive = true): Promise<SnackAdminProduct[]> {
  const current = await requireInventoryManager();
  const isAdmin = current.role === "administrador";

  let productQuery = client()
    .from("snack_producto")
    .select("id_producto,numero_producto,nombre_producto,cantidad,precio,activo,created_at,updated_at")
    .order("numero_producto", { ascending: true });

  if (!includeInactive) productQuery = productQuery.eq("activo", true);

  const productPromise = productQuery;
  const stockPromise = client()
    .from("snack_inventario_ubicacion")
    .select("id_producto,codigo_ubicacion,cantidad");

  const costPromise = isAdmin
    ? client().from("snack_producto_costo").select("id_producto,precio_compra")
    : Promise.resolve({ data: [], error: null } as any);

  const [
    { data: products, error: productError },
    { data: stocks, error: stockError },
    { data: costs, error: costError },
  ] = await Promise.all([productPromise, stockPromise, costPromise]);

  if (productError) throw productError;
  if (costError) throw costError;
  if (stockError && !isMissingLocationSchema(stockError)) throw stockError;

  const costMap = new Map<number, number>();
  for (const row of costs ?? []) {
    costMap.set(Number((row as any).id_producto), num((row as any).precio_compra));
  }

  const stockMap = new Map<string, number>();
  for (const row of stocks ?? []) {
    stockMap.set(`${Number((row as any).id_producto)}:${String((row as any).codigo_ubicacion)}`, num((row as any).cantidad));
  }

  return (products ?? []).map((row: any) => {
    const id = Number(row.id_producto);
    const taquilla = stockError ? num(row.cantidad) : (stockMap.get(`${id}:taquilla_1`) ?? 0);
    const enclave = stockError ? 0 : (stockMap.get(`${id}:enclave`) ?? 0);

    return {
      ...row,
      id_producto: id,
      cantidad: taquilla + enclave,
      cantidad_taquilla_1: taquilla,
      cantidad_enclave: enclave,
      cantidad_total: taquilla + enclave,
      precio: num(row.precio),
      activo: row.activo !== false,
      precio_compra: isAdmin && costMap.has(id) ? costMap.get(id)! : null,
    };
  }) as SnackAdminProduct[];
}

export async function getSnackExpiryLots(): Promise<SnackExpiryLot[]> {
  const current = await getCurrentRole();
  if (!current || !["administrador", "coordinador"].includes(current.role)) {
    throw new Error("Solo Administración o Coordinación pueden consultar vencimientos de snacks.");
  }

  const { data, error } = await client()
    .from("snack_lote_vencimiento")
    .select("id_lote_vencimiento,id_producto,codigo_ubicacion,fecha_vencimiento,cantidad_inicial,cantidad_actual,observacion,created_at,updated_at,producto:snack_producto(numero_producto,nombre_producto)")
    .gt("cantidad_actual", 0)
    .order("fecha_vencimiento", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id_lote_vencimiento: Number(row.id_lote_vencimiento),
    id_producto: Number(row.id_producto),
    numero_producto: String(row.producto?.numero_producto ?? ""),
    nombre_producto: String(row.producto?.nombre_producto ?? ""),
    codigo_ubicacion: String(row.codigo_ubicacion) as SnackLocationCode,
    fecha_vencimiento: String(row.fecha_vencimiento ?? "").slice(0, 10),
    cantidad_inicial: num(row.cantidad_inicial),
    cantidad_actual: num(row.cantidad_actual),
    observacion: String(row.observacion ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }));
}

export async function saveSnackExpiryLot(args: {
  id_lote_vencimiento?: number | null;
  id_producto: number;
  codigo_ubicacion: SnackLocationCode;
  fecha_vencimiento: string;
  cantidad_actual: number;
  observacion?: string;
}) {
  await requireAdmin();
  const quantity = Math.floor(num(args.cantidad_actual));
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("La cantidad del lote debe ser un entero mayor a cero.");
  }
  if (!args.fecha_vencimiento) throw new Error("Selecciona la fecha de vencimiento.");

  const { data, error } = await client().rpc("admin_guardar_lote_vencimiento_snack", {
    p_id_lote_vencimiento: args.id_lote_vencimiento ?? null,
    p_id_producto: Number(args.id_producto),
    p_ubicacion: args.codigo_ubicacion,
    p_fecha_vencimiento: args.fecha_vencimiento,
    p_cantidad_actual: quantity,
    p_observacion: args.observacion?.trim() || null,
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent("snack-expiry-changed"));
  return data;
}

export async function deleteSnackExpiryLot(idLote: number) {
  await requireAdmin();
  const { data, error } = await client().rpc("admin_eliminar_lote_vencimiento_snack", {
    p_id_lote_vencimiento: Number(idLote),
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent("snack-expiry-changed"));
  return data;
}

export async function getSnackInventoryVerificationSnapshot(
  ubicacion: SnackLocationCode,
): Promise<SnackInventoryVerificationRow[]> {
  const current = await getCurrentRole();
  if (!current || !["administrador", "coordinador", "guia"].includes(current.role)) {
    throw new Error("No tienes permiso para corroborar el inventario.");
  }

  const { data, error } = await client().rpc("obtener_snapshot_corrobacion_snacks", {
    p_ubicacion: ubicacion,
  });
  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((row: any) => ({
    id_producto: Number(row.id_producto),
    numero_producto: String(row.numero_producto ?? ""),
    nombre_producto: String(row.nombre_producto ?? ""),
    codigo_ubicacion: String(row.codigo_ubicacion ?? ubicacion) as SnackLocationCode,
    cantidad_sistema: num(row.cantidad_sistema),
    ultima_verificacion_fecha: row.ultima_verificacion_fecha ? String(row.ultima_verificacion_fecha) : null,
    ultima_cantidad_sistema: row.ultima_cantidad_sistema == null ? null : num(row.ultima_cantidad_sistema),
    ultima_cantidad_contada: row.ultima_cantidad_contada == null ? null : num(row.ultima_cantidad_contada),
    ultima_coincide: row.ultima_coincide == null ? null : Boolean(row.ultima_coincide),
    ultima_observacion: String(row.ultima_observacion ?? ""),
    ultima_verificado_email: String(row.ultima_verificado_email ?? ""),
  }));
}

export async function recordSnackInventoryVerification(args: {
  id_producto: number;
  codigo_ubicacion: SnackLocationCode;
  coincide: boolean;
  cantidad_contada?: number | null;
  observacion?: string;
}) {
  const current = await getCurrentRole();
  if (!current || !["coordinador", "guia"].includes(current.role)) {
    throw new Error("La corroboración de inventario está habilitada para Coordinación y Guías.");
  }

  const counted = args.coincide ? null : Math.floor(num(args.cantidad_contada));
  if (!args.coincide && (counted == null || !Number.isInteger(counted) || counted < 0)) {
    throw new Error("Indica cuántas unidades hay actualmente.");
  }
  if (!args.coincide && !args.observacion?.trim()) {
    throw new Error("La observación es obligatoria cuando reportas una diferencia.");
  }

  const { data, error } = await client().rpc("registrar_corrobacion_inventario_snack", {
    p_id_producto: Number(args.id_producto),
    p_ubicacion: args.codigo_ubicacion,
    p_coincide: args.coincide,
    p_cantidad_contada: args.coincide ? null : counted,
    p_observacion: args.coincide ? null : args.observacion!.trim(),
  });
  if (error) throw error;
  window.dispatchEvent(new CustomEvent("snack-inventory-verified"));
  return data;
}

export async function saveSnackPurchasePrice(idProducto: number, precioCompra: number) {
  await requireAdmin();
  const price = num(precioCompra);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("El precio de compra debe ser igual o mayor a cero.");
  }

  const { data, error } = await client().rpc("admin_guardar_costo_snack", {
    p_id_producto: Number(idProducto),
    p_precio_compra: price,
  });
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("snack-cost-changed"));
  return data;
}

export async function setSnackStockByLocation(
  idProducto: number,
  ubicacion: SnackLocationCode,
  cantidad: number,
  motivo = "Ajuste manual de inventario",
) {
  await requireInventoryManager();
  const cleanQuantity = Math.floor(num(cantidad));
  if (!Number.isInteger(cleanQuantity) || cleanQuantity < 0) {
    throw new Error("La cantidad debe ser un número entero igual o mayor a cero.");
  }

  const { data, error } = await client().rpc("admin_fijar_stock_snack", {
    p_id_producto: Number(idProducto),
    p_ubicacion: ubicacion,
    p_cantidad: cleanQuantity,
    p_motivo: motivo.trim() || "Ajuste manual de inventario",
  });
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("snack-stock-changed"));
  return data;
}

export async function getSnackAdminDashboard(
  fromDate?: string | null,
  toDate?: string | null,
): Promise<SnackAdminDashboard> {
  await requireAdmin();

  const { data, error } = await client().rpc("admin_resumen_snacks", {
    p_desde: fromDate || null,
    p_hasta: toDate || null,
  });
  if (error) throw error;

  const raw: any = data ?? {};
  let paymentMetrics = Array.isArray(raw.metodos_pago) ? raw.metodos_pago.map((row: any) => ({
    medio_pago: String(row.medio_pago ?? ""),
    ventas: num(row.ventas),
    total: num(row.total),
  })) : [];

  let paymentQuery = client()
    .from("snack_venta_pago")
    .select("id_venta,medio_pago,monto,venta:snack_venta!inner(fecha_venta)");

  if (fromDate) paymentQuery = paymentQuery.gte("venta.fecha_venta", `${fromDate}T00:00:00-05:00`);
  if (toDate) paymentQuery = paymentQuery.lt("venta.fecha_venta", `${nextDate(toDate)}T00:00:00-05:00`);

  const { data: splitPaymentData, error: splitPaymentError } = await paymentQuery;
  if (!splitPaymentError) {
    const methodMap = new Map<string, { ventas: Set<number>; total: number }>();
    for (const row of splitPaymentData ?? []) {
      const method = String((row as any).medio_pago ?? "");
      if (!method) continue;
      const current = methodMap.get(method) ?? { ventas: new Set<number>(), total: 0 };
      current.ventas.add(Number((row as any).id_venta));
      current.total += num((row as any).monto);
      methodMap.set(method, current);
    }
    paymentMetrics = [...methodMap.entries()]
      .map(([medio_pago, value]) => ({
        medio_pago,
        ventas: value.ventas.size,
        total: value.total,
      }))
      .sort((a, b) => b.total - a.total);
  } else if (!isMissingSalePaymentSchema(splitPaymentError)) {
    console.warn("No fue posible desglosar los métodos de pago de snacks.", splitPaymentError);
  }

  return {
    ventas: num(raw.ventas),
    ingresos: num(raw.ingresos),
    unidades: num(raw.unidades),
    costo_vendido: num(raw.costo_vendido),
    ganancia_bruta: num(raw.ganancia_bruta),
    margen: num(raw.margen),
    ticket_promedio: num(raw.ticket_promedio),
    lineas_sin_costo: num(raw.lineas_sin_costo),
    costos_estimados: num(raw.costos_estimados),
    retiros_unidades: num(raw.retiros_unidades),
    costo_retiros: num(raw.costo_retiros),
    productos_activos: num(raw.productos_activos),
    stock_unidades: num(raw.stock_unidades),
    capital_invertido: num(raw.capital_invertido),
    valor_potencial_venta: num(raw.valor_potencial_venta),
    ganancia_potencial: num(raw.ganancia_potencial),
    productos_sin_costo: num(raw.productos_sin_costo),
    top_productos: Array.isArray(raw.top_productos) ? raw.top_productos.map((row: any) => ({
      id_producto: row.id_producto == null ? null : Number(row.id_producto),
      nombre_producto: String(row.nombre_producto ?? ""),
      unidades: num(row.unidades),
      ingresos: num(row.ingresos),
      costo: num(row.costo),
      ganancia: num(row.ganancia),
      margen: num(row.margen),
      lineas_sin_costo: num(row.lineas_sin_costo),
    })) : [],
    metodos_pago: paymentMetrics,
    ubicaciones: Array.isArray(raw.ubicaciones) ? raw.ubicaciones.map((row: any) => ({
      ubicacion_codigo: String(row.ubicacion_codigo ?? ""),
      ubicacion: String(row.ubicacion ?? snackLocationLabel(row.ubicacion_codigo)),
      ventas: num(row.ventas),
      unidades: num(row.unidades),
      ingresos: num(row.ingresos),
    })) : [],
  };
}

export async function createSnackProduct(payload: {
  numero_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio: number;
}) {
  await requireInventoryManager();
  const clean = {
    numero_producto: payload.numero_producto.trim().toUpperCase(),
    nombre_producto: payload.nombre_producto.trim(),
    cantidad: Math.max(0, Math.floor(num(payload.cantidad))),
    precio: Math.max(0, num(payload.precio)),
    activo: true,
  };
  if (!clean.numero_producto || !clean.nombre_producto) {
    throw new Error("Número y nombre del producto son obligatorios.");
  }
  if (clean.precio <= 0) throw new Error("El precio debe ser mayor a cero.");

  const { data, error } = await client().from("snack_producto").insert(clean).select().single();
  if (error) throw error;
  return data;
}

export async function updateSnackProduct(
  idProducto: number,
  payload: Partial<Pick<SnackProduct, "numero_producto" | "nombre_producto" | "cantidad" | "precio" | "activo">>,
) {
  await requireInventoryManager();
  const clean: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
  if (typeof payload.numero_producto === "string") clean.numero_producto = payload.numero_producto.trim().toUpperCase();
  if (typeof payload.nombre_producto === "string") clean.nombre_producto = payload.nombre_producto.trim();
  if (payload.cantidad != null) clean.cantidad = Math.max(0, Math.floor(num(payload.cantidad)));
  if (payload.precio != null) clean.precio = Math.max(0, num(payload.precio));

  const { data, error } = await client()
    .from("snack_producto")
    .update(clean)
    .eq("id_producto", idProducto)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setSnackProductActive(idProducto: number, activo: boolean) {
  return updateSnackProduct(idProducto, { activo });
}

export async function withdrawSnackStock(
  idProducto: number,
  cantidad: number,
  motivo: string,
  ubicacion: SnackLocationCode = "taquilla_1",
) {
  await requireInventoryManager();
  const cleanQuantity = Math.floor(num(cantidad));
  const cleanReason = motivo.trim();

  if (!Number.isInteger(cleanQuantity) || cleanQuantity <= 0) {
    throw new Error("La cantidad a retirar debe ser mayor a cero.");
  }
  if (!cleanReason) throw new Error("Indica el motivo del retiro del inventario.");

  const { data, error } = await client().rpc("retirar_stock_snack", {
    p_id_producto: Number(idProducto),
    p_cantidad: cleanQuantity,
    p_motivo: cleanReason,
    p_ubicacion: ubicacion,
  });
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("snack-stock-changed"));
  return data;
}

export async function transferSnackStock(
  idProducto: number,
  cantidad: number,
  origen: SnackLocationCode,
  destino: SnackLocationCode,
  motivo = "Traslado de inventario",
) {
  await requireInventoryManager();
  const cleanQuantity = Math.floor(num(cantidad));
  if (origen === destino) throw new Error("El origen y el destino deben ser diferentes.");
  if (!Number.isInteger(cleanQuantity) || cleanQuantity <= 0) {
    throw new Error("La cantidad a transferir debe ser mayor a cero.");
  }

  const { data, error } = await client().rpc("transferir_stock_snack", {
    p_id_producto: Number(idProducto),
    p_cantidad: cleanQuantity,
    p_origen: origen,
    p_destino: destino,
    p_motivo: motivo.trim() || "Traslado de inventario",
  });
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("snack-stock-changed"));
  window.dispatchEvent(new CustomEvent("snack-transfer-recorded"));
  return data;
}

export async function getSnackTransfers(limit = 50): Promise<SnackTransfer[]> {
  await requireAdmin();

  const { data, error } = await client()
    .from("snack_transferencia")
    .select("id_transferencia,id_producto,numero_producto,nombre_producto,origen_codigo,destino_codigo,cantidad,motivo,registrado_email,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, Math.floor(limit))));
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id_transferencia: Number(row.id_transferencia),
    id_producto: Number(row.id_producto),
    numero_producto: String(row.numero_producto ?? ""),
    nombre_producto: String(row.nombre_producto ?? ""),
    origen_codigo: String(row.origen_codigo) as SnackLocationCode,
    destino_codigo: String(row.destino_codigo) as SnackLocationCode,
    cantidad: num(row.cantidad),
    motivo: String(row.motivo ?? ""),
    registrado_email: String(row.registrado_email ?? ""),
    created_at: String(row.created_at ?? ""),
  }));
}

function nextDate(fecha: string) {
  const [year, month, day] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function getSnackSalesByDate(
  fecha: string,
  ubicacion?: SnackLocationCode | null,
): Promise<SnackSale[]> {
  const from = `${fecha}T00:00:00-05:00`;
  const to = `${nextDate(fecha)}T00:00:00-05:00`;

  let query = client()
    .from("snack_venta")
    .select("id_venta,fecha_venta,medio_pago,referencia_pago,total,vendedor_user_id,vendedor_email,ubicacion_codigo")
    .gte("fecha_venta", from)
    .lt("fecha_venta", to)
    .order("fecha_venta", { ascending: false });

  if (ubicacion) query = query.eq("ubicacion_codigo", ubicacion);

  const { data: salesData, error: salesError } = await query;
  if (salesError) throw salesError;

  const sales = salesData ?? [];
  const ids = sales.map((row: any) => Number(row.id_venta));
  if (!ids.length) return [];

  const [
    { data: detailData, error: detailError },
    { data: paymentData, error: paymentError },
  ] = await Promise.all([
    client()
      .from("snack_venta_detalle")
      .select("id_detalle,id_venta,id_producto,numero_producto,nombre_producto,cantidad,precio_unitario,subtotal")
      .in("id_venta", ids)
      .order("id_detalle", { ascending: true }),
    client()
      .from("snack_venta_pago")
      .select("id_pago,id_venta,medio_pago,monto,referencia_pago")
      .in("id_venta", ids)
      .order("id_pago", { ascending: true }),
  ]);
  if (detailError) throw detailError;
  if (paymentError && !isMissingSalePaymentSchema(paymentError)) throw paymentError;

  const grouped = new Map<number, SnackSaleItem[]>();
  for (const row of detailData ?? []) {
    const item: SnackSaleItem = {
      id_detalle: Number((row as any).id_detalle),
      id_venta: Number((row as any).id_venta),
      id_producto: (row as any).id_producto == null ? null : Number((row as any).id_producto),
      numero_producto: String((row as any).numero_producto ?? ""),
      nombre_producto: String((row as any).nombre_producto ?? ""),
      cantidad: num((row as any).cantidad),
      precio_unitario: num((row as any).precio_unitario),
      subtotal: num((row as any).subtotal),
    };
    const list = grouped.get(item.id_venta) ?? [];
    list.push(item);
    grouped.set(item.id_venta, list);
  }

  const payments = new Map<number, SnackSalePayment[]>();
  for (const row of paymentData ?? []) {
    const payment: SnackSalePayment = {
      id_pago: Number((row as any).id_pago),
      id_venta: Number((row as any).id_venta),
      medio_pago: String((row as any).medio_pago ?? ""),
      monto: num((row as any).monto),
      referencia_pago: String((row as any).referencia_pago ?? ""),
    };
    const list = payments.get(payment.id_venta) ?? [];
    list.push(payment);
    payments.set(payment.id_venta, list);
  }

  return sales.map((row: any) => {
    const idVenta = Number(row.id_venta);
    const salePayments = payments.get(idVenta) ?? [{
      id_pago: null,
      id_venta: idVenta,
      medio_pago: String(row.medio_pago ?? ""),
      monto: num(row.total),
      referencia_pago: String(row.referencia_pago ?? ""),
    }];

    return {
      id_venta: idVenta,
      fecha_venta: String(row.fecha_venta),
      medio_pago: String(row.medio_pago ?? ""),
      referencia_pago: String(row.referencia_pago ?? ""),
      total: num(row.total),
      vendedor_user_id: row.vendedor_user_id ? String(row.vendedor_user_id) : null,
      vendedor_email: String(row.vendedor_email ?? ""),
      ubicacion_codigo: String(row.ubicacion_codigo || "taquilla_1") as SnackLocationCode,
      items: grouped.get(idVenta) ?? [],
      pagos: salePayments,
    };
  });
}

export async function registerSnackSale(
  items: SnackSaleInput[],
  pagos: SnackSalePaymentInput[],
  ubicacion: SnackLocationCode = "taquilla_1",
) {
  const current = await getCurrentRole();
  if (!current) throw new Error("No fue posible identificar el usuario que registra la venta.");

  const cleanItems = items
    .map((item) => ({
      id_producto: Number(item.id_producto),
      cantidad: Math.floor(num(item.cantidad)),
    }))
    .filter((item) => item.id_producto > 0 && item.cantidad > 0);

  const cleanPayments = pagos
    .map((payment) => ({
      monto: Math.round(num(payment.monto) * 100) / 100,
      medio_pago: String(payment.medio_pago ?? "").trim(),
      referencia_pago: String(payment.referencia_pago ?? "").replace(/\D/g, "").slice(0, 4),
    }))
    .filter((payment) => payment.monto > 0 || payment.medio_pago || payment.referencia_pago);

  if (!cleanItems.length) throw new Error("Agrega al menos un producto a la venta.");
  if (!cleanPayments.length) throw new Error("Agrega al menos un método de pago.");

  for (const payment of cleanPayments) {
    if (payment.monto <= 0 || !payment.medio_pago) {
      throw new Error("Cada método de pago debe tener un valor mayor a cero y un medio seleccionado.");
    }
    if (payment.referencia_pago && payment.referencia_pago.length !== 4) {
      throw new Error("Cada referencia de pago debe tener exactamente los últimos 4 dígitos.");
    }
  }

  const { data, error } = await client().rpc("registrar_venta_snack_multi_pago", {
    p_items: cleanItems,
    p_pagos: cleanPayments,
    p_ubicacion: ubicacion,
  });

  if (error) {
    if (cleanPayments.length === 1 && isMissingMultiPaymentRpc(error)) {
      const payment = cleanPayments[0];
      const fallback = await client().rpc("registrar_venta_snack", {
        p_items: cleanItems,
        p_medio_pago: payment.medio_pago,
        p_ubicacion: ubicacion,
        p_referencia_pago: payment.referencia_pago || null,
      });
      if (fallback.error) throw fallback.error;
      window.dispatchEvent(new CustomEvent("snack-sale-recorded"));
      window.dispatchEvent(new CustomEvent("snack-stock-changed"));
      return fallback.data;
    }
    throw error;
  }

  window.dispatchEvent(new CustomEvent("snack-sale-recorded"));
  window.dispatchEvent(new CustomEvent("snack-stock-changed"));
  return data;
}

export async function updateSnackSalePaymentReference(
  idVenta: number,
  referenciaPago: string,
  idPago?: number | null,
): Promise<string> {
  const cleanReference = referenciaPago.replace(/\D/g, "").slice(0, 4);
  if (cleanReference && cleanReference.length !== 4) {
    throw new Error("La referencia de pago debe tener exactamente 4 dígitos.");
  }

  const request = idPago
    ? client().rpc("actualizar_referencia_pago_venta_snack_pago", {
        p_id_pago: Number(idPago),
        p_referencia_pago: cleanReference || null,
      })
    : client().rpc("actualizar_referencia_pago_venta_snack", {
        p_id_venta: Number(idVenta),
        p_referencia_pago: cleanReference || null,
      });

  const { data, error } = await request;
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("snack-sale-recorded"));
  return String((data as any)?.referencia_pago ?? cleanReference);
}

export async function getSnackSalesForReservation(idReserva: number): Promise<SnackSale[]> {
  const id = Number(idReserva);
  if (!Number.isInteger(id) || id <= 0) return [];

  const { data: salesData, error: salesError } = await client()
    .from("snack_venta")
    .select("id_venta,fecha_venta,medio_pago,referencia_pago,total,vendedor_user_id,vendedor_email,ubicacion_codigo")
    .eq("id_reserva", id)
    .order("fecha_venta", { ascending: false });
  if (salesError) throw salesError;

  const sales = salesData ?? [];
  const ids = sales.map((row: any) => Number(row.id_venta));
  if (!ids.length) return [];

  const [
    { data: detailData, error: detailError },
    { data: paymentData, error: paymentError },
  ] = await Promise.all([
    client()
      .from("snack_venta_detalle")
      .select("id_detalle,id_venta,id_producto,numero_producto,nombre_producto,cantidad,precio_unitario,subtotal")
      .in("id_venta", ids)
      .order("id_detalle", { ascending: true }),
    client()
      .from("snack_venta_pago")
      .select("id_pago,id_venta,medio_pago,monto,referencia_pago")
      .in("id_venta", ids)
      .order("id_pago", { ascending: true }),
  ]);
  if (detailError) throw detailError;
  if (paymentError && !isMissingSalePaymentSchema(paymentError)) throw paymentError;

  const grouped = new Map<number, SnackSaleItem[]>();
  for (const row of detailData ?? []) {
    const item: SnackSaleItem = {
      id_detalle: Number((row as any).id_detalle),
      id_venta: Number((row as any).id_venta),
      id_producto: (row as any).id_producto == null ? null : Number((row as any).id_producto),
      numero_producto: String((row as any).numero_producto ?? ""),
      nombre_producto: String((row as any).nombre_producto ?? ""),
      cantidad: num((row as any).cantidad),
      precio_unitario: num((row as any).precio_unitario),
      subtotal: num((row as any).subtotal),
    };
    const list = grouped.get(item.id_venta) ?? [];
    list.push(item);
    grouped.set(item.id_venta, list);
  }

  const payments = new Map<number, SnackSalePayment[]>();
  for (const row of paymentData ?? []) {
    const payment: SnackSalePayment = {
      id_pago: Number((row as any).id_pago),
      id_venta: Number((row as any).id_venta),
      medio_pago: String((row as any).medio_pago ?? ""),
      monto: num((row as any).monto),
      referencia_pago: String((row as any).referencia_pago ?? ""),
    };
    const list = payments.get(payment.id_venta) ?? [];
    list.push(payment);
    payments.set(payment.id_venta, list);
  }

  return sales.map((row: any) => {
    const idVenta = Number(row.id_venta);
    const salePayments = payments.get(idVenta) ?? [{
      id_pago: null,
      id_venta: idVenta,
      medio_pago: String(row.medio_pago ?? ""),
      monto: num(row.total),
      referencia_pago: String(row.referencia_pago ?? ""),
    }];

    return {
      id_venta: idVenta,
      fecha_venta: String(row.fecha_venta),
      medio_pago: String(row.medio_pago ?? ""),
      referencia_pago: String(row.referencia_pago ?? ""),
      total: num(row.total),
      vendedor_user_id: row.vendedor_user_id ? String(row.vendedor_user_id) : null,
      vendedor_email: String(row.vendedor_email ?? ""),
      ubicacion_codigo: String(row.ubicacion_codigo || "taquilla_1") as SnackLocationCode,
      items: grouped.get(idVenta) ?? [],
      pagos: salePayments,
    };
  });
}

export async function registerSnackSaleForReservation(
  idReserva: number,
  items: SnackSaleInput[],
  medioPago: string,
  ubicacion: SnackLocationCode = "taquilla_1",
): Promise<ReservationSnackSaleResult> {
  const current = await getCurrentRole();
  if (!current || !["administrador", "atencion"].includes(current.role)) {
    throw new Error("Solo Administración o Atención pueden vincular una venta de snacks a una reserva.");
  }

  const cleanItems = items
    .map((item) => ({
      id_producto: Number(item.id_producto),
      cantidad: Math.floor(num(item.cantidad)),
    }))
    .filter((item) => item.id_producto > 0 && item.cantidad > 0);

  if (!Number.isInteger(Number(idReserva)) || Number(idReserva) <= 0) {
    throw new Error("No fue posible identificar la reserva.");
  }
  if (!cleanItems.length) throw new Error("Agrega al menos un producto a la venta.");
  if (!medioPago.trim()) throw new Error("Selecciona el método de pago.");

  const { data, error } = await client().rpc("registrar_venta_snack_reserva", {
    p_id_reserva: Number(idReserva),
    p_items: cleanItems,
    p_medio_pago: medioPago.trim(),
    p_ubicacion: ubicacion,
  });
  if (error) throw error;

  const raw: any = data ?? {};
  const result: ReservationSnackSaleResult = {
    id_venta: Number(raw.id_venta ?? 0),
    total: num(raw.total),
    nuevo_total: num(raw.nuevo_total),
    saldo_pendiente: num(raw.saldo_pendiente),
    medio_pago: String(raw.medio_pago ?? medioPago),
    ubicacion: String(raw.ubicacion ?? ubicacion) as SnackLocationCode,
    observacion: String(raw.observacion ?? ""),
  };

  window.dispatchEvent(new CustomEvent("snack-sale-recorded"));
  window.dispatchEvent(new CustomEvent("snack-stock-changed"));
  window.dispatchEvent(new CustomEvent("control-operativo-reserva-updated", {
    detail: {
      id_reserva: Number(idReserva),
      total: result.nuevo_total,
      saldo_pendiente: result.saldo_pendiente,
      observacion: result.observacion,
    },
  }));
  return result;
}

export async function deleteSnackSaleAdmin(
  idVenta: number,
): Promise<SnackSaleDeletionResult> {
  await requireAdmin();

  const saleId = Number(idVenta);
  if (!Number.isInteger(saleId) || saleId <= 0) {
    throw new Error("No fue posible identificar la venta.");
  }

  const { data, error } = await client().rpc("admin_eliminar_venta_snack", {
    p_id_venta: saleId,
  });
  if (error) throw error;

  const raw: any = data ?? {};
  const idReserva = raw.id_reserva == null ? null : Number(raw.id_reserva);
  const result: SnackSaleDeletionResult = {
    id_venta: Number(raw.id_venta ?? saleId),
    total_eliminado: num(raw.total_eliminado),
    ubicacion: String(raw.ubicacion ?? "taquilla_1") as SnackLocationCode,
    id_reserva: Number.isInteger(idReserva) && Number(idReserva) > 0 ? Number(idReserva) : null,
    nuevo_total: raw.nuevo_total == null ? null : num(raw.nuevo_total),
    saldo_pendiente: raw.saldo_pendiente == null ? null : num(raw.saldo_pendiente),
    observacion: String(raw.observacion ?? ""),
  };

  window.dispatchEvent(new CustomEvent("snack-sale-recorded"));
  window.dispatchEvent(new CustomEvent("snack-stock-changed"));

  if (result.id_reserva) {
    window.dispatchEvent(new CustomEvent("control-operativo-reserva-updated", {
      detail: {
        id_reserva: result.id_reserva,
        total: result.nuevo_total,
        saldo_pendiente: result.saldo_pendiente,
        observacion: result.observacion,
      },
    }));
  }

  return result;
}

export async function cancelSnackSaleForReservation(
  idReserva: number,
  idVenta: number,
  motivo = "Cliente desistió de la compra",
): Promise<ReservationSnackSaleCancellationResult> {
  const current = await getCurrentRole();
  if (!current || !["administrador", "atencion"].includes(current.role)) {
    throw new Error("Solo Administración o Atención pueden retirar una venta de snacks de una reserva.");
  }

  const { data, error } = await client().rpc("anular_venta_snack_reserva", {
    p_id_reserva: Number(idReserva),
    p_id_venta: Number(idVenta),
    p_motivo: motivo.trim() || "Cliente desistió de la compra",
  });
  if (error) throw error;

  const raw: any = data ?? {};
  const result: ReservationSnackSaleCancellationResult = {
    id_venta: Number(raw.id_venta ?? idVenta),
    total_retirado: num(raw.total_retirado),
    nuevo_total: num(raw.nuevo_total),
    saldo_pendiente: num(raw.saldo_pendiente),
    exceso_pagado: num(raw.exceso_pagado),
    observacion: String(raw.observacion ?? ""),
  };

  window.dispatchEvent(new CustomEvent("snack-sale-recorded"));
  window.dispatchEvent(new CustomEvent("snack-stock-changed"));
  window.dispatchEvent(new CustomEvent("control-operativo-reserva-updated", {
    detail: {
      id_reserva: Number(idReserva),
      total: result.nuevo_total,
      saldo_pendiente: result.saldo_pendiente,
      observacion: result.observacion,
    },
  }));
  return result;
}

