import { useState } from "react";
import { logout } from "../services/auth.service";

import PlanesAdmin from "../components/admin/PlanesAdmin";
import ClientesAdmin from "../components/admin/ClientesAdmin";
import ReservasAdmin from "../components/admin/ReservasAdmin";
import ParticipantesAdmin from "../components/admin/ParticipantesAdmin";

type Section = "planes" | "clientes" | "reservas" | "participantes";

function Dashboard() {
  const [activeSection, setActiveSection] = useState<Section>("planes");

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const renderSection = () => {
    switch (activeSection) {
      case "planes":
        return <PlanesAdmin />;

      case "clientes":
        return <ClientesAdmin />;

      case "reservas":
        return <ReservasAdmin />;

      case "participantes":
        return <ParticipantesAdmin />;

      default:
        return <PlanesAdmin />;
    }
  };

  return (
    <main>
      <header>
        <h1>Panel Administrativo Forigua</h1>
        <p>Gestión general del sistema</p>

        <button onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <nav>
        <button onClick={() => setActiveSection("planes")}>
          Planes
        </button>

        <button onClick={() => setActiveSection("clientes")}>
          Clientes
        </button>

        <button onClick={() => setActiveSection("reservas")}>
          Reservas
        </button>

        <button onClick={() => setActiveSection("participantes")}>
          Participantes
        </button>
      </nav>

      <hr />

      {renderSection()}
    </main>
  );
}

export default Dashboard;