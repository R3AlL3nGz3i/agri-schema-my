import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { RequireAdmin } from "./components/ProtectedRoute";

import Landing        from "./pages/Landing";
import Login          from "./pages/Login";
import FarmerHome     from "./pages/farmer/FarmerHome";
import FarmerSearch   from "./pages/farmer/FarmerSearch";
import FarmerHistory  from "./pages/farmer/FarmerHistory";
import ScanCrop       from "./pages/farmer/ScanCrop";
import AdminDashboard from "./pages/admin/Dashboard";
import EvidenceSearch from "./pages/admin/EvidenceSearch";
import KnowledgeBase  from "./pages/admin/KnowledgeBase";
import ReviewQueue    from "./pages/admin/ReviewQueue";
import Analytics      from "./pages/admin/Analytics";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"               element={<Landing />} />
          <Route path="/login"          element={<Login />} />
          <Route path="/farmer"         element={<FarmerHome />} />
          <Route path="/farmer/scan"    element={<ScanCrop />} />
          <Route path="/farmer/search"  element={<FarmerSearch />} />
          <Route path="/farmer/history" element={<FarmerHistory />} />

          {/* Admin only */}
          <Route path="/admin"              element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/search"       element={<RequireAdmin><EvidenceSearch /></RequireAdmin>} />
          <Route path="/admin/knowledge"    element={<RequireAdmin><KnowledgeBase /></RequireAdmin>} />
          <Route path="/admin/queue"        element={<RequireAdmin><ReviewQueue /></RequireAdmin>} />
          <Route path="/admin/analytics"    element={<RequireAdmin><Analytics /></RequireAdmin>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
