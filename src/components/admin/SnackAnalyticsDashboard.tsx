import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Package, RefreshCw, ShoppingCart, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { getSnackAdminDashboard, type SnackAdminDashboard } from "../../services/snack.service";

type Props = {
  fromDate?: string;
  toDate?: string;
};

const EMPTY: SnackAdminDashboard = {
  ventas: 0,
  ingresos: 0,
  unidades: 0,
  costo_vendido: 0,
  ganancia_bruta: 0,
  margen: 0,
  ticket_promedio: 0,
  lineas_sin_costo: 0,
  costos_estimados: 0,
  retiros_unidades: 0,
  costo_retiros: 0,
  productos_activos: 0,
  stock_unidades: 0,
  capital_invertido: 0,
  valor_potencial_venta: 0,
  ganancia_potencial: 0,
  productos_sin_costo: 0,
  top_productos: [],
  metodos_pago: [],
  ubicaciones: [],
};

const money = (value: number) => `$${Math.round(Number(value || 0)).toLocaleString("es-CO")}`;
const pct = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const methodLabel = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

function Metric({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: "gold" | "green" | "red" | "blue" | "violet" | "teal";
}) {
  return (
    <div className={`crm-kpi crm-kpi-${tone}`}>
      <div className="crm-kpi-top">
        <div className="crm-kpi-icon">{icon}</div>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

export default function SnackAnalyticsDashboard({ fromDate = "", toDate = "" }: Props) {
  const [data, setData] = useState<SnackAdminDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setData(await getSnackAdminDashboard(fromDate || null, toDate || null));
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar la analítica de snacks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30_000);
    const refresh = () => void load(true);

    window.addEventListener("snack-sale-recorded", refresh);
    window.addEventListener("snack-cost-changed", refresh);
    window.addEventListener("snack-stock-changed", refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("snack-sale-recorded", refresh);
      window.removeEventListener("snack-cost-changed", refresh);
      window.removeEventListener("snack-stock-changed", refresh);
    };
  }, [load]);

  const mostProfitable = useMemo(
    () => [...data.top_productos].sort((a, b) => b.ganancia - a.ganancia)[0] ?? null,
    [data.top_productos],
  );

  const periodLabel = fromDate || toDate
    ? `${fromDate || "inicio"} a ${toDate || "hoy"}`
    : "Todo el histórico";

  return (
    <section className="crm-card crm-ranking-card">
      <div className="crm-card-head">
        <div>
          <span className="crm-card-kicker">Snacks · inteligencia comercial</span>
          <h2>Rentabilidad y desempeño de snacks</h2>
          <p>Ingresos, costos, margen, rotación, inventario y merma · {periodLabel}</p>
        </div>
        <button className="crm-filter-clear" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "spin-icon" : ""} />
          {refreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && <div className="crm-error" style={{ margin: 16 }}>{error}</div>}

      {loading ? (
        <div className="crm-empty">Cargando métricas de snacks…</div>
      ) : (
        <>
          {(data.lineas_sin_costo > 0 || data.productos_sin_costo > 0) && (
            <div className="crm-error" style={{ margin: "16px 18px 0" }}>
              Hay {data.productos_sin_costo} producto(s) sin precio de compra y {data.lineas_sin_costo} línea(s) de venta sin costo histórico.
              La ganancia puede estar incompleta hasta configurar esos costos.
            </div>
          )}

          <div className="crm-kpis" style={{ padding: "16px 18px" }}>
            <Metric icon={<ShoppingCart size={20} />} label="Ventas snacks" value={money(data.ingresos)} helper={`${data.ventas} ventas · ${data.unidades} unidades`} tone="green" />
            <Metric icon={<TrendingUp size={20} />} label="Ganancia bruta" value={money(data.ganancia_bruta)} helper={`${money(data.costo_vendido)} costo vendido`} tone="gold" />
            <Metric icon={<TrendingUp size={20} />} label="Margen" value={pct(data.margen)} helper={data.costos_estimados ? `${data.costos_estimados} costos históricos estimados` : "Costos históricos registrados"} tone="blue" />
            <Metric icon={<Banknote size={20} />} label="Ticket promedio" value={money(data.ticket_promedio)} helper="Por venta de snacks" tone="violet" />
            <Metric icon={<Package size={20} />} label="Capital invertido" value={money(data.capital_invertido)} helper={`${data.stock_unidades} unidades en inventario`} tone="teal" />
            <Metric icon={<TrendingUp size={20} />} label="Ganancia potencial" value={money(data.ganancia_potencial)} helper={`${money(data.valor_potencial_venta)} venta potencial`} tone="green" />
            <Metric icon={<TrendingDown size={20} />} label="Merma por retiros" value={money(data.costo_retiros)} helper={`${data.retiros_unidades} unidades retiradas`} tone="red" />
            <Metric icon={<Package size={20} />} label="Productos activos" value={String(data.productos_activos)} helper={`${data.productos_sin_costo} sin costo configurado`} tone="gold" />
          </div>

          <div className="crm-decision-strip" style={{ margin: "0 18px 16px" }}>
            <div className="crm-decision-item">
              <Trophy size={18} />
              <div>
                <span>Snack más vendido</span>
                <strong>{data.top_productos[0]?.nombre_producto || "Sin ventas"}</strong>
                <small>{data.top_productos[0] ? `${data.top_productos[0].unidades} unidades · ${money(data.top_productos[0].ingresos)}` : "Sin resultados"}</small>
              </div>
            </div>
            <div className="crm-decision-item">
              <TrendingUp size={18} />
              <div>
                <span>Snack más rentable</span>
                <strong>{mostProfitable?.nombre_producto || "Sin ventas"}</strong>
                <small>{mostProfitable ? `${money(mostProfitable.ganancia)} · ${pct(mostProfitable.margen)} margen` : "Sin resultados"}</small>
              </div>
            </div>
            <div className="crm-decision-item">
              <Package size={18} />
              <div>
                <span>Stock disponible</span>
                <strong>{data.stock_unidades} unidades</strong>
                <small>{money(data.capital_invertido)} en inventario</small>
              </div>
            </div>
            <div className="crm-decision-item">
              <TrendingDown size={18} />
              <div>
                <span>Merma</span>
                <strong>{money(data.costo_retiros)}</strong>
                <small>Vencidos, dañados u otros retiros</small>
              </div>
            </div>
          </div>

          <div className="crm-ranking-table">
            <div className="crm-ranking-row header">
              <span>Snack</span>
              <span>Unidades</span>
              <span>Ingresos</span>
              <span>Costo</span>
              <span>Ganancia</span>
              <span>Margen</span>
            </div>

            {data.top_productos.length === 0 ? (
              <div className="crm-empty">Aún no hay ventas de snacks en este periodo.</div>
            ) : data.top_productos.slice(0, 10).map((item, index) => (
              <div className="crm-ranking-row" key={item.id_producto ?? item.nombre_producto}>
                <div className="crm-plan-name">
                  <span className={`crm-rank ${index < 3 ? `top-${index + 1}` : ""}`}>{index + 1}</span>
                  <div>
                    <strong>{item.nombre_producto}</strong>
                    {item.lineas_sin_costo > 0 && (
                      <span style={{ display: "block", fontSize: 10, color: "#b45309", marginTop: 2 }}>
                        {item.lineas_sin_costo} línea(s) sin costo
                      </span>
                    )}
                  </div>
                </div>
                <strong>{item.unidades}</strong>
                <strong>{money(item.ingresos)}</strong>
                <span>{money(item.costo)}</span>
                <strong>{money(item.ganancia)}</strong>
                <span>{pct(item.margen)}</span>
              </div>
            ))}
          </div>

          <div className="crm-card-head" style={{ borderTop: "1px solid #f0ece5" }}>
            <div>
              <span className="crm-card-kicker">Puntos de venta</span>
              <h2>Taquilla 1 vs. Enclave</h2>
              <p>Compara qué punto vende más y dónde rota mejor el inventario.</p>
            </div>
            <ShoppingCart size={20} />
          </div>

          <div className="crm-ranking-table">
            <div className="crm-ranking-row header" style={{ gridTemplateColumns: "2fr repeat(3,1fr)", minWidth: 650 }}>
              <span>Punto</span>
              <span>Ventas</span>
              <span>Unidades</span>
              <span>Ingresos</span>
            </div>

            {data.ubicaciones.length === 0 ? (
              <div className="crm-empty">Aún no hay ventas separadas por punto.</div>
            ) : data.ubicaciones.map((item) => (
              <div
                className="crm-ranking-row"
                style={{ gridTemplateColumns: "2fr repeat(3,1fr)", minWidth: 650 }}
                key={item.ubicacion_codigo}
              >
                <strong>{item.ubicacion}</strong>
                <span>{item.ventas}</span>
                <span>{item.unidades}</span>
                <strong>{money(item.ingresos)}</strong>
              </div>
            ))}
          </div>

          <div className="crm-card-head" style={{ borderTop: "1px solid #f0ece5" }}>
            <div>
              <span className="crm-card-kicker">Caja snacks</span>
              <h2>Ventas por método de pago</h2>
              <p>Distribución del recaudo generado por snacks.</p>
            </div>
            <Banknote size={20} />
          </div>

          <div className="crm-ranking-table">
            <div className="crm-ranking-row header" style={{ gridTemplateColumns: "2fr repeat(3,1fr)", minWidth: 650 }}>
              <span>Método</span>
              <span>Ventas</span>
              <span>Recaudo</span>
              <span>Participación</span>
            </div>

            {data.metodos_pago.length === 0 ? (
              <div className="crm-empty">Sin ventas registradas.</div>
            ) : data.metodos_pago.map((item) => (
              <div
                className="crm-ranking-row"
                style={{ gridTemplateColumns: "2fr repeat(3,1fr)", minWidth: 650 }}
                key={item.medio_pago}
              >
                <strong>{methodLabel(item.medio_pago)}</strong>
                <span>{item.ventas}</span>
                <strong>{money(item.total)}</strong>
                <span>{pct(data.ingresos ? item.total / data.ingresos * 100 : 0)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
