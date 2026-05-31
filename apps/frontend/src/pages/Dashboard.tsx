import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { logout } from "../services/auth.service";
import { supabase } from "../lib/supabase";
import {
  CalendarDays,
  Package,
  Users,
  UserCheck,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
} from "lucide-react";

const DEMO_SESSION_KEY = "forigua:demo_session";

const NAV_LINKS = [
  { to: "/app", label: "Resumen", icon: <LayoutDashboard size={16} />, end: true },
  { to: "/app/reservas", label: "Reservas", icon: <CalendarDays size={16} /> },
  { to: "/app/planes", label: "Planes", icon: <Package size={16} /> },
  { to: "/app/clientes", label: "Clientes", icon: <Users size={16} /> },
  { to: "/app/participantes", label: "Participantes", icon: <UserCheck size={16} /> },
];

function Dashboard() {
  const [userLabel, setUserLabel] = useState<string>("admin");
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);

  /* cierra el drawer al cambiar ruta */
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  /* cierra al click fuera */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  /* bloquea scroll del body cuando el drawer está abierto */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    const demoRaw = localStorage.getItem(DEMO_SESSION_KEY);
    if (demoRaw) {
      try {
        const parsed = JSON.parse(demoRaw) as { email?: string };
        setUserLabel(parsed.email?.trim() || "demo@forigua.local");
      } catch {
        setUserLabel("demo@forigua.local");
      }
      return;
    }
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.trim();
      if (email) setUserLabel(email);
    });
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    ["dash-nav-link", isActive ? "active" : ""].join(" ");

  return (
    <div className="dash-root">
      {/* ── HEADER ── */}
      <header className="dash-header">
        <div className="dash-header-inner">
          {/* Logo / brand */}
          <div className="dash-brand">
            <span className="dash-brand-icon">F</span>
          </div>

          {/* Nav desktop */}
          <nav className="dash-nav-desktop">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={linkClass}
              >
                {l.icon}
                {l.label}
              </NavLink>
            ))}
          </nav>

          {/* Acciones */}
          <div className="dash-header-actions">
            <button
              onClick={handleLogout}
              className="dash-logout-btn dash-logout-desktop"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
              <span className="dash-logout-label">Cerrar sesión</span>
            </button>

            {/* Hamburger (solo móvil) */}
            <button
              className="dash-hamburger"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE DRAWER ── */}
      {menuOpen && <div className="drawer-backdrop" />}

      <div
        ref={drawerRef}
        className={`drawer ${menuOpen ? "drawer-open" : ""}`}
      >
        <div className="drawer-top">
          <button
            className="drawer-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <div className="drawer-user">
          <div className="drawer-avatar">
            {userLabel[0]?.toUpperCase() ?? "A"}
          </div>
          <span className="drawer-email">{userLabel}</span>
        </div>

        <nav className="drawer-nav">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={linkClass}
            >
              {l.icon}
              {l.label}
            </NavLink>
          ))}
        </nav>

        <button onClick={handleLogout} className="drawer-logout">
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>

      {/* ── CONTENIDO ── */}
      <main className="dash-main">
        <Outlet />
      </main>
    </div>
  );
}

export default Dashboard;