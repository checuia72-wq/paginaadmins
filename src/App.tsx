// App.tsx — Rutas principales

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import OverviewPage from "./pages/OverviewPage";
import ReservasPage from "./pages/ReservasPage";
import PlanesPage from "./pages/PlanesPage";
import ClientesPage from "./pages/ClientesPage";
import ParticipantesPage from "./pages/ParticipantesPage";
import ControlOperativoPage from "./pages/ControlOperativoPage";
import CrearPage from "./pages/CrearPage";
import CodigosOperativosPage from "./pages/CodigosOperativosPage";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

import "./styles/dashboard.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
          <Route index element={<RoleRoute allow={["administrador"]}><OverviewPage /></RoleRoute>} />
          <Route path="reservas" element={<RoleRoute allow={["administrador", "atencion"]}><ReservasPage /></RoleRoute>} />
          <Route path="control-operativo" element={<RoleRoute allow={["administrador", "atencion"]}><ControlOperativoPage /></RoleRoute>} />
          <Route path="planes" element={<RoleRoute allow={["administrador"]}><PlanesPage /></RoleRoute>} />
          <Route path="clientes" element={<RoleRoute allow={["administrador"]}><ClientesPage /></RoleRoute>} />
          <Route path="participantes" element={<RoleRoute allow={["administrador"]}><ParticipantesPage /></RoleRoute>} />
          <Route path="crear" element={<RoleRoute allow={["administrador"]}><CrearPage /></RoleRoute>} />
          <Route path="codigos-operativos" element={<RoleRoute allow={["administrador"]}><CodigosOperativosPage /></RoleRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
