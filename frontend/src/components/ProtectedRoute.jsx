import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

// Requires login (admin or user)
export function RequireAuth({ children }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// Requires admin role specifically
export function RequireAdmin({ children }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}
