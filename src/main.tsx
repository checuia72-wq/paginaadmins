import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "./styles/control-operativo-table-polish.css";
import "./styles/control-operativo-table-readable.css";
import App from "./App.tsx";
import ControlOperativoExcelExport from "./components/admin/ControlOperativoExcelExport";
import { queryClient } from "./lib/queryClient";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ControlOperativoExcelExport />
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
