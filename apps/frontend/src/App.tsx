// App.tsx — Rutas principales
// Agrega la ruta index (/app) que carga OverviewPage

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import OverviewPage from "./pages/OverviewPage";      // ← NUEVO
import ReservasPage from "./pages/ReservasPage";
import PlanesPage from "./pages/PlanesPage";
import ClientesPage from "./pages/ClientesPage";
import ParticipantesPage from "./pages/ParticipantesPage";
import ProtectedRoute from "./components/ProtectedRoute";

// Importa los estilos globales del dashboard
import "./styles/dashboard.css";                       // ← NUEVO

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          {/* index → resumen general */}
          <Route index element={<OverviewPage />} />   {/* ← NUEVO */}

          <Route path="reservas"     element={<ReservasPage />} />
          <Route path="planes"       element={<PlanesPage />} />
          <Route path="clientes"     element={<ClientesPage />} />
          <Route path="participantes" element={<ParticipantesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}