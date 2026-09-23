import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, RefreshCw } from "lucide-react";
import {
  getSnackProductsAdmin,
  getSnackTransfers,
  snackLocationLabel,
  transferSnackStock,
  type SnackAdminProduct,
  type SnackLocationCode,
  type SnackTransfer,
} from "../services/snack.service";
import "../styles/snacks.css";

const timeBogota = (value: string) => new Date(value).toLocaleString("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "short",
  timeStyle: "short",
});

export default function TransferenciaSnacksPage() {
  const [products, setProducts] = useState<SnackAdminProduct[]>([]);
  const [history, setHistory] = useState<SnackTransfer[]>([]);
  const [productId, setProductId] = useState<number | "">("");
  const [origin, setOrigin] = useState<SnackLocationCode>("taquilla_1");
  const [destination, setDestination] = useState<SnackLocationCode>("enclave");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("Traslado de inventario");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [productData, transferData] = await Promise.all([
        getSnackProductsAdmin(false),
        getSnackTransfers(60),
      ]);
      setProducts(productData);
      setHistory(transferData);
      if (productData.length && productId === "") setProductId(productData[0].id_producto);
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar las transferencias de snacks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productId]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(
    () => products.find((item) => item.id_producto === productId) ?? null,
    [products, productId],
  );

  const originStock = selected
    ? (origin === "taquilla_1" ? selected.cantidad_taquilla_1 : selected.cantidad_enclave)
    : 0;

  const destinationStock = selected
    ? (destination === "taquilla_1" ? selected.cantidad_taquilla_1 : selected.cantidad_enclave)
    : 0;

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    setQuantity("1");
    setError("");
    setSuccess("");
  };

  const submit = async () => {
    if (!selected) {
      setError("Selecciona un producto.");
      return;
    }
    const qty = Number(quantity || 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      setError("La cantidad debe ser un número entero mayor a cero.");
      return;
    }
    if (origin === destination) {
      setError("El origen y el destino deben ser diferentes.");
      return;
    }
    if (qty > originStock) {
      setError("No hay suficiente inventario en " + snackLocationLabel(origin) + ". Disponible: " + originStock + ".");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await transferSnackStock(selected.id_producto, qty, origin, destination, reason);
      setSuccess(
        qty + " unidad" + (qty === 1 ? "" : "es") + " de " + selected.nombre_producto +
        " transferida" + (qty === 1 ? "" : "s") + " de " + snackLocationLabel(origin) +
        " a " + snackLocationLabel(destination) + ".",
      );
      setQuantity("1");
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible realizar la transferencia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="snack-page">
      <div className="snack-page-head">
        <div>
          <h1>Transferencia de productos</h1>
          <p>Mueve existencias entre Taquilla 1 y Enclave sin alterar el total general del inventario.</p>
        </div>
        <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="snack-alert error">{error}</div>}
      {success && <div className="snack-alert success">{success}</div>}

      <section className="snack-card">
        <div className="snack-card-title">
          <div><ArrowRightLeft size={18} /><strong>Nueva transferencia</strong></div>
          <span>{loading ? "Cargando…" : products.length + " productos activos"}</span>
        </div>

        <div className="snack-product-form">
          <label>
            Producto *
            <select value={productId} onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Seleccionar producto</option>
              {products.map((product) => (
                <option key={product.id_producto} value={product.id_producto}>
                  {product.numero_producto} · {product.nombre_producto}
                </option>
              ))}
            </select>
          </label>

          <label>
            Origen *
            <select value={origin} onChange={(e) => {
              const next = e.target.value as SnackLocationCode;
              setOrigin(next);
              if (next === destination) setDestination(next === "taquilla_1" ? "enclave" : "taquilla_1");
              setQuantity("1");
            }}>
              <option value="taquilla_1">Taquilla 1</option>
              <option value="enclave">Enclave</option>
            </select>
          </label>

          <label>
            Destino *
            <select value={destination} onChange={(e) => {
              const next = e.target.value as SnackLocationCode;
              setDestination(next);
              if (next === origin) setOrigin(next === "taquilla_1" ? "enclave" : "taquilla_1");
              setQuantity("1");
            }}>
              <option value="taquilla_1">Taquilla 1</option>
              <option value="enclave">Enclave</option>
            </select>
          </label>

          <label>
            Cantidad *
            <input type="number" min={1} max={originStock} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>

          <label>
            Motivo
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Reposición Enclave" />
          </label>

          <button className="snack-btn primary" onClick={submit} disabled={saving || !selected || originStock <= 0}>
            <ArrowRightLeft size={16} />
            {saving ? "Transfiriendo…" : "Transferir"}
          </button>
        </div>

        {selected && (
          <div className="snack-transfer-preview">
            <div>
              <span>{snackLocationLabel(origin)}</span>
              <strong>{originStock}</strong>
              <small>Quedaría en {Math.max(0, originStock - Number(quantity || 0))}</small>
            </div>
            <ArrowRightLeft size={20} />
            <div>
              <span>{snackLocationLabel(destination)}</span>
              <strong>{destinationStock}</strong>
              <small>Quedaría en {destinationStock + Math.max(0, Number(quantity || 0))}</small>
            </div>
            <button className="snack-btn secondary" onClick={swap}>Invertir sentido</button>
          </div>
        )}
      </section>

      <section className="snack-card">
        <div className="snack-card-title">
          <div><strong>Historial de transferencias</strong></div>
          <span>Últimos {history.length}</span>
        </div>
        <div className="snack-table-wrap">
          <table className="snack-table">
            <thead>
              <tr><th>Fecha</th><th>Producto</th><th>Origen</th><th>Destino</th><th>Cantidad</th><th>Motivo</th><th>Responsable</th></tr>
            </thead>
            <tbody>
              {!history.length ? (
                <tr><td colSpan={7} className="snack-empty">Aún no hay transferencias registradas.</td></tr>
              ) : history.map((item) => (
                <tr key={item.id_transferencia}>
                  <td>{timeBogota(item.created_at)}</td>
                  <td><strong>{item.numero_producto}</strong> · {item.nombre_producto}</td>
                  <td>{snackLocationLabel(item.origen_codigo)}</td>
                  <td>{snackLocationLabel(item.destino_codigo)}</td>
                  <td><strong>{item.cantidad}</strong></td>
                  <td>{item.motivo || "—"}</td>
                  <td>{item.registrado_email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
