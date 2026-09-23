import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { getCurrentRole, type AppRole } from "../services/role.service";
import { getMyGuideSalesPermissions, type GuideSalesPermissions } from "../services/guideSalesAccess.service";
import OverviewPage from "./OverviewPage";
import "../styles/snacks.css";

export default function RoleHomePage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<GuideSalesPermissions>({ taquilla_1: false, enclave: false });

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const load = async () => {
      try {
        const current = await getCurrentRole();
        if (!active) return;
        setRole(current?.role ?? null);

        if (current?.role === "guia") {
          const access = await getMyGuideSalesPermissions();
          if (active) setPermissions(access);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    timer = window.setInterval(() => void load(), 15000);
    window.addEventListener("focus", load);

    return () => {
      active = false;
      if (timer != null) window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  if (loading) return <div className="grid min-h-[40vh] place-items-center"><p>Cargando perfil…</p></div>;
  if (!role) return <Navigate to="/" replace />;

  if (role === "administrador") return <OverviewPage />;
  if (role === "atencion") return <Navigate to="/app/reservas" replace />;
  if (role === "coordinador") return <Navigate to="/app/control-operativo" replace />;

  if (permissions.taquilla_1) return <Navigate to="/app/ventas-snacks" replace />;
  if (permissions.enclave) return <Navigate to="/app/ventas-snacks-enclave" replace />;

  return (
    <div className="snack-page">
      <section className="snack-card" style={{ maxWidth: 720, margin: "40px auto" }}>
        <div className="snack-card-title">
          <div><LockKeyhole size={18} /><strong>Ventas todavía no habilitadas</strong></div>
        </div>
        <div className="snack-empty" style={{ padding: 28 }}>
          Tu perfil de guía está activo, pero el coordinador todavía no te ha habilitado ventas en Taquilla 1 ni Enclave.
          Cuando te habiliten un punto, aparecerá automáticamente en tu menú.
        </div>
      </section>
    </div>
  );
}
