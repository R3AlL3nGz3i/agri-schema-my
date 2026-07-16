import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

// Requires login (admin or user)
export function RequireAuth({ children }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// Research pages are available to approved researchers and the super admin.
export function RequireResearchAccess({ children }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!['admin', 'researcher'].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
