import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import { JoinLeague } from "./pages/JoinLeague";
import { AdminLayout } from "./admin/AdminLayout";
import { Overview } from "./admin/pages/Overview";
import { Leagues } from "./admin/pages/Leagues";
import { Users } from "./admin/pages/Users";
import { Simulator } from "./admin/pages/Simulator";
import { StatCorrections } from "./admin/pages/StatCorrections";
import { Reporting } from "./admin/pages/Reporting";
import { ApiIntegrations } from "./admin/pages/ApiIntegrations";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="leagues" element={<Leagues />} />
            <Route path="users" element={<Users />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="stat-corrections" element={<StatCorrections />} />
            <Route path="reporting" element={<Reporting />} />
            <Route path="api-integrations" element={<ApiIntegrations />} />
            <Route path="*" element={<Navigate to="overview" replace />} />
          </Route>
          {/* Old Sim Panel location — keep bookmarks working. */}
          <Route path="/sim" element={<Navigate to="/admin/simulator" replace />} />
          <Route path="/join/:code" element={<JoinLeague />} />
          <Route path="/league/:leagueId/:page" element={<App />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
