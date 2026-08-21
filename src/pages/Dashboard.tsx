import { useEffect, useRef, useState } from "react";
import "../styles/dashboard.css";
import "../styles/global.css";
import "../styles/responsive-admin.css";
import "../styles/desktop-admin-tuning.css";
import "../styles/sidebar-admin.css";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { logout } from "../services/auth.service";
import { getCurrentRole, type AppRole } from "../services/role.service";
import { CalendarDays, Package, Users, UserCheck, LogOut, Menu, X, LayoutDashboard, ClipboardList, ChevronLeft, ChevronRight, Settings2, Tags } from "lucide-react";

const SIDEBAR_KEY = "checua:sidebar_collapsed";
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;

const ALL_NAV_LINKS = [
  { to: "/app", label: "Resumen", icon: <LayoutDashboard size={16} />, end: true, roles: ["administrador"] as AppRole[] },
  { to: "/app/reservas", label: "Reservas", icon: <CalendarDays size={16} />, roles: ["administrador", "atencion"] as AppRole[] },
  { to: "/app/control-operativo", label: "Control Operativo", icon: <ClipboardList size={16} />, roles: ["administrador", "atencion"] as AppRole[] },
  { to: "/app/planes", label: "Planes", icon: <Package size={16} />, roles: ["administrador"] as AppRole[] },
  { to: "/app/clientes", label: "Clientes", icon: <Users size={16} />, roles: ["administrador"] as AppRole[] },
  { to: "/app/participantes", label: "Participantes", icon: <UserCheck size={16} />, roles: ["administrador"] as AppRole[] },
  { to: "/app/crear", label: "Crear", icon: <Settings2 size={16} />, roles: ["administrador"] as AppRole[] },
  { to: "/app/codigos-operativos", label: "Códigos operativos", icon: <Tags size={16} />, roles: ["administrador"] as AppRole[] },
];

function Dashboard() {
  const [userLabel, setUserLabel] = useState<string>("usuario");
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "true");
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navLinks = role ? ALL_NAV_LINKS.filter((link) => link.roles.includes(role)) : [];

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => { localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed)); }, [sidebarCollapsed]);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);
  useEffect(() => { document.body.style.overflow = menuOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [menuOpen]);

  const cerrarSesion = async (porInactividad = false) => { await logout(); navigate("/", { replace: true, state: porInactividad ? { motivo: "inactividad" } : undefined }); };
  const handleLogout = () => cerrarSesion(false);

  useEffect(() => {
    const reiniciar = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => cerrarSesion(true), INACTIVITY_LIMIT_MS);
    };
    const eventos: (keyof DocumentEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    eventos.forEach((ev) => document.addEventListener(ev, reiniciar, { passive: true }));
    reiniciar();
    return () => { eventos.forEach((ev) => document.removeEventListener(ev, reiniciar)); if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getCurrentRole().then((current) => {
      if (!current) { setRole(null); navigate("/", { replace: true }); return; }
      setRole(current.role); setUserLabel(current.email || "usuario");
      if (current.role === "atencion" && location.pathname === "/app") navigate("/app/reservas", { replace: true });
    }).catch(() => { setRole(null); navigate("/", { replace: true }); }).finally(() => setRoleLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) => ["dash-nav-link", isActive ? "active" : ""].join(" ");
  const sidebarLinkClass = ({ isActive }: { isActive: boolean }) => ["sidebar-link", isActive ? "active" : ""].join(" ");
  const roleLabel = role === "atencion" ? "Atención" : "Administrador";

  if (roleLoading) return <div className="grid min-h-screen place-items-center"><p>Cargando permisos…</p></div>;

  return <div className="dash-root"><div className="dash-shell">
    <aside className={`dash-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand"><div className="sidebar-brand-icon"><img src="/icono.png" alt="Icono Checua" /></div><div className="sidebar-brand-copy"><strong>Desierto de Checua</strong><span>Administración</span></div></div>
      <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Expandir menú" : "Contraer menú"} title={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}>{sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button>
      <nav className="sidebar-nav">{navLinks.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={sidebarLinkClass} title={sidebarCollapsed ? l.label : undefined}>{l.icon}<span className="sidebar-link-label">{l.label}</span></NavLink>)}</nav>
      <div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">{userLabel[0]?.toUpperCase() ?? "U"}</div><div className="sidebar-user-copy"><span>{roleLabel}</span><span>{userLabel}</span></div></div><button onClick={handleLogout} className="sidebar-logout" title="Cerrar sesión"><LogOut size={17} /><span>Cerrar sesión</span></button></div>
    </aside>

    <div className="dash-content"><header className="dash-header"><div className="dash-header-inner"><div className="dash-brand"><div className="dash-brand-icon"><img src="/icono.png" alt="Icono Checua" /></div><span className="dash-brand-name">Desierto de Checua</span></div><nav className="dash-nav-desktop">{navLinks.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.icon}{l.label}</NavLink>)}</nav><div className="dash-header-actions"><button onClick={handleLogout} className="dash-logout-btn dash-logout-desktop" title="Cerrar sesión"><LogOut size={16} /><span className="dash-logout-label">Cerrar sesión</span></button><button className="dash-hamburger" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={22} /></button></div></div></header>
      {menuOpen && <div className="drawer-backdrop" />}
      <div ref={drawerRef} className={`drawer ${menuOpen ? "drawer-open" : ""}`}><div className="drawer-top"><button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20} /></button></div><div className="drawer-user"><div className="drawer-avatar">{userLabel[0]?.toUpperCase() ?? "U"}</div><span className="drawer-email">{roleLabel} · {userLabel}</span></div><nav className="drawer-nav">{navLinks.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.icon}{l.label}</NavLink>)}</nav><button onClick={handleLogout} className="drawer-logout"><LogOut size={16} />Cerrar sesión</button></div>
      <main className="dash-main"><Outlet /></main>
    </div>
  </div></div>;
}

export default Dashboard;