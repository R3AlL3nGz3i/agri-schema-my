import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Leaf, LayoutDashboard, Search, ClipboardCheck, BookOpen, BarChart2, LogOut, User } from "lucide-react";

const navItems = [
  { to: "/admin",            icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/search",     icon: Search,          label: "Evidence Search" },
  { to: "/admin/queue",      icon: ClipboardCheck,  label: "Review Queue" },
  { to: "/admin/knowledge",  icon: BookOpen,        label: "Knowledge Base" },
  { to: "/admin/analytics",  icon: BarChart2,       label: "Analytics" },
];

export default function AdminLayout({ children }) {
  const { pathname } = useLocation();
  const { user, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-primary-dark text-white flex flex-col">
        <div className="p-5 flex items-center gap-2 border-b border-primary">
          <Leaf size={22} className="text-accent" />
          <span className="font-bold text-lg">AgriScheme</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${pathname === to
                  ? "bg-primary text-white font-medium"
                  : "text-green-100 hover:bg-primary"}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-primary space-y-2">
          <div className="flex items-center gap-2 text-green-200 text-xs">
            <User size={13} />
            <span className="truncate">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <Link to="/farmer" className="text-xs text-green-300 hover:text-white">← Farmer View</Link>
            <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-green-300 hover:text-white">
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <h1 className="text-sm font-medium text-gray-500">Admin / Researcher Portal</h1>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
