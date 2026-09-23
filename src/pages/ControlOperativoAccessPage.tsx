import { useEffect, useState } from "react";
import { getCurrentRole, type AppRole } from "../services/role.service";
import ControlOperativoPage from "./ControlOperativoPage";
import ControlOperativoCoordinadorPage from "./ControlOperativoCoordinadorPage";

export default function ControlOperativoAccessPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentRole()
      .then((current) => setRole(current?.role ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid min-h-[40vh] place-items-center"><p>Cargando permisos…</p></div>;
  if (role === "coordinador") return <ControlOperativoCoordinadorPage />;
  return <ControlOperativoPage />;
}
