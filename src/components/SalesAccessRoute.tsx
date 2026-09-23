import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentRole } from "../services/role.service";
import { getMyGuideSalesPermissions } from "../services/guideSalesAccess.service";
import type { SnackLocationCode } from "../services/snack.service";

type Props = {
  location: SnackLocationCode;
  children: React.ReactNode;
};

export default function SalesAccessRoute({ location, children }: Props) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const current = await getCurrentRole();
        if (!current) {
          if (active) setAllowed(false);
          return;
        }

        if (current.role === "administrador" || current.role === "atencion") {
          if (active) setAllowed(true);
          return;
        }

        if (current.role !== "guia") {
          if (active) setAllowed(false);
          return;
        }

        const permissions = await getMyGuideSalesPermissions();
        if (active) setAllowed(location === "taquilla_1" ? permissions.taquilla_1 : permissions.enclave);
      } catch {
        if (active) setAllowed(false);
      } finally {
        if (active) setLoading(false);
      }
    };

    void verify();

    const refresh = () => void verify();
    const timer = window.setInterval(() => void verify(), 15000);
    window.addEventListener("guide-sales-access-changed", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("guide-sales-access-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [location]);

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center"><p>Verificando acceso de ventas…</p></div>;
  }

  if (!allowed) return <Navigate to="/app" replace />;

  return <>{children}</>;
}
