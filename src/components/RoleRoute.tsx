import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentRole, type AppRole } from "../services/role.service";

type Props = {
  allow: AppRole[];
  children: React.ReactNode;
};

export default function RoleRoute({ allow, children }: Props) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    getCurrentRole()
      .then((data) => setRole(data?.role ?? null))
      .catch(() => setRole(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center"><p>Cargando permisos…</p></div>;
  }

  if (!role) return <Navigate to="/" replace />;
  if (!allow.includes(role)) return <Navigate to="/app/reservas" replace />;

  return <>{children}</>;
}
