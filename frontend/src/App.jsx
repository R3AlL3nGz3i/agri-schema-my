import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { RequireAuth, RequireResearchAccess } from "./components/ProtectedRoute";

import Login          from "./pages/Login";
import Marketplace    from "./pages/Marketplace";
import Community      from "./pages/Community";
import ChatAssistant  from "./pages/farmer/ChatAssistant";
import FarmerHistory  from "./pages/farmer/FarmerHistory";
import AdminDashboard from "./pages/admin/Dashboard";
import EvidenceSearch from "./pages/admin/EvidenceSearch";
import KnowledgeBase  from "./pages/admin/KnowledgeBase";
import ReviewQueue    from "./pages/admin/ReviewQueue";
import Analytics      from "./pages/admin/Analytics";

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          {/* Text search and photo scan share one conversation workspace. */}
          <Route path="/"               element={<ChatAssistant />} />
          <Route path="/chat/:chatId"   element={<ChatAssistant />} />
          <Route path="/login"          element={<Login />} />
          <Route path="/farmer"         element={<Navigate to="/" replace />} />
          <Route path="/farmer/scan"    element={<Navigate to="/" replace />} />
          <Route path="/farmer/search"  element={<Navigate to="/" replace />} />

          {/* Visible to guests in navigation, but sign-in is required to use. */}
          <Route path="/marketplace"    element={<RequireAuth><Marketplace /></RequireAuth>} />
          <Route path="/community"      element={<RequireAuth><Community /></RequireAuth>} />
          <Route path="/farmer/history" element={<RequireAuth><FarmerHistory /></RequireAuth>} />

          {/* Research portal — approved researchers and the super admin. */}
          <Route path="/admin"              element={<RequireResearchAccess><AdminDashboard /></RequireResearchAccess>} />
          <Route path="/admin/search"       element={<RequireResearchAccess><EvidenceSearch /></RequireResearchAccess>} />
          <Route path="/admin/knowledge"    element={<RequireResearchAccess><KnowledgeBase /></RequireResearchAccess>} />
          <Route path="/admin/queue"        element={<RequireResearchAccess><ReviewQueue /></RequireResearchAccess>} />
          <Route path="/admin/analytics"    element={<RequireResearchAccess><Analytics /></RequireResearchAccess>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
