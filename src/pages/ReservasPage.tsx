import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import ReservasPdfGuard from "../components/admin/ReservasPdfGuard";
import UrgentReservationApprovalAlert from "../components/admin/UrgentReservationApprovalAlert";

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

function formatUpdateTime(date: Date) {
  return date.toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReservasPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const refreshReservations = useCallback((force = false) => {
    const hasOpenModal = Boolean(
      document.querySelector(".rv-overlay, [role='dialog'][aria-modal='true']"),
    );

    // Evita cerrar formularios o modales que el usuario esté utilizando.
    if (!force && hasOpenModal) return;

    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setLastUpdated(new Date());

    window.setTimeout(() => setRefreshing(false), 700);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshReservations(false);
    }, REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastUpdated.getTime() >= REFRESH_INTERVAL_MS) {
        refreshReservations(false);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [lastUpdated, refreshReservations]);

  return (
    <div className="p-4">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={() => refreshReservations(true)}
          title="Actualizar reservas ahora · actualización automática cada 2 minutos"
          aria-label="Actualizar reservas"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 38,
            padding: "0 13px",
            border: "1px solid #e6dccf",
            borderRadius: 999,
            background: "#fffdf9",
            color: "#62584c",
            boxShadow: "0 4px 14px rgba(54, 42, 25, 0.06)",
            cursor: refreshing ? "wait" : "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#79ad4c",
              boxShadow: "0 0 0 3px rgba(121, 173, 76, 0.10)",
            }}
          />
          <span>Datos en vivo</span>
          <span style={{ color: "#978a7c", fontWeight: 500 }}>
            {formatUpdateTime(lastUpdated)}
          </span>
          <RefreshCw
            size={15}
            aria-hidden="true"
            style={{
              opacity: refreshing ? 0.55 : 1,
              animation: refreshing ? "spin 0.7s linear infinite" : "none",
            }}
          />
        </button>
      </div>

      <div key={refreshKey}>
        <UrgentReservationApprovalAlert />
        <ReservasPdfGuard />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
