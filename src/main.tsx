import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import { SimPanel } from "./pages/SimPanel";
import { JoinLeague } from "./pages/JoinLeague";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sim" element={<SimPanel />} />
          <Route path="/join/:code" element={<JoinLeague />} />
          <Route path="/league/:leagueId/:page" element={<App />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
