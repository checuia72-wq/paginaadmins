// App.tsx — Rutas principales

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import RoleHomePage from "./pages/RoleHomePage";
import ReservasPage from "./pages/ReservasPage";
import PlanesPage from "./pages/PlanesPage";
import ClientesPage from "./pages/ClientesPage";
import ParticipantesPage from "./pages/ParticipantesPage";
import ControlOperativoAccessPage from "./pages/ControlOperativoAccessPage";
import CrearPage from "./pages/CrearPage";
import CodigosOperativosPage from "./pages/CodigosOperativosPage";
import AdicionalesPage from "./pages/AdicionalesPage";
import InventarioSnacksPage from "./pages/InventarioSnacksPage";
import VentasSnacksPage from "./pages/VentasSnacksPage";
import TransferenciaSnacksPage from "./pages/TransferenciaSnacksPage";
import AccesosGuiasPage from "./pages/AccesosGuiasPage";
import EntregaEfectivoPage from "./pages/EntregaEfectivoPage";
import SalesAccessRoute from "./components/SalesAccessRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import GlobalAlertModal from "./components/common/GlobalAlertModal";
import ControlOperativoAdvancedOptions from "./components/admin/ControlOperativoAdvancedOptions";
import ControlOperativoReprogramPenalty from "./components/admin/ControlOperativoReprogramPenalty";
import ControlOperativoMealSelector from "./components/admin/ControlOperativoMealSelector";
import ControlOperativoMealExport from "./components/admin/ControlOperativoMealExport";
import ControlOperativoSnackSales from "./components/admin/ControlOperativoSnackSales";

import "./styles/dashboard.css";

export default function App() {
  return (
    <BrowserRouter>
      <GlobalAlertModal />
      <ControlOperativoAdvancedOptions />
      <ControlOperativoReprogramPenalty />
      <ControlOperativoMealSelector />
      <ControlOperativoMealExport />
      <ControlOperativoSnackSales />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
          <Route index element={<RoleHomePage />} />
          <Route path="reservas" element={<RoleRoute allow={["administrador", "atencion"]}><ReservasPage /></RoleRoute>} />
          <Route path="control-operativo" element={<RoleRoute allow={["administrador", "atencion", "coordinador"]}><ControlOperativoAccessPage /></RoleRoute>} />
          <Route path="ventas-snacks" element={<RoleRoute allow={["administrador", "atencion", "guia"]}><SalesAccessRoute location="taquilla_1"><VentasSnacksPage ubicacion="taquilla_1" titulo="Ventas Taquilla 1" /></SalesAccessRoute></RoleRoute>} />
          <Route path="ventas-snacks-enclave" element={<RoleRoute allow={["administrador", "atencion", "guia"]}><SalesAccessRoute location="enclave"><VentasSnacksPage ubicacion="enclave" titulo="Ventas Enclave" /></SalesAccessRoute></RoleRoute>} />
          <Route path="inventario-snacks" element={<RoleRoute allow={["administrador", "coordinador"]}><InventarioSnacksPage /></RoleRoute>} />
          <Route path="transferencias-snacks" element={<RoleRoute allow={["administrador"]}><TransferenciaSnacksPage /></RoleRoute>} />
          <Route path="accesos-guias" element={<RoleRoute allow={["administrador", "coordinador"]}><AccesosGuiasPage /></RoleRoute>} />
          <Route path="entrega-efectivo" element={<RoleRoute allow={["administrador", "coordinador", "guia"]}><EntregaEfectivoPage /></RoleRoute>} />
          <Route path="planes" element={<RoleRoute allow={["administrador"]}><PlanesPage /></RoleRoute>} />
          <Route path="clientes" element={<RoleRoute allow={["administrador"]}><ClientesPage /></RoleRoute>} />
          <Route path="participantes" element={<RoleRoute allow={["administrador"]}><ParticipantesPage /></RoleRoute>} />
          <Route path="crear" element={<RoleRoute allow={["administrador"]}><CrearPage /></RoleRoute>} />
          <Route path="codigos-operativos" element={<RoleRoute allow={["administrador"]}><CodigosOperativosPage /></RoleRoute>} />
          <Route path="adicionales" element={<RoleRoute allow={["administrador"]}><AdicionalesPage /></RoleRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
