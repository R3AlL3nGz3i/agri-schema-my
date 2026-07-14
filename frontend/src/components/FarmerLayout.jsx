import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Leaf, Search, History, Home, LogIn, LogOut,
  User, LayoutDashboard, Menu, X, Plus,
} from "lucide-react";

const NAV = [
  { to: "/farmer",         icon: Home,    label: "Home"    },
  { to: "/farmer/scan",    icon: Plus,    label: "New Scan" },
  { to: "/farmer/search",  icon: Search,  label: "Search"  },
  { to: "/farmer/history", icon: History, label: "History" },
];

export default function FarmerLayout({ children, title = "AgriScheme" }) {
  const { user, logout, isAdmin, isUser } = useApp();
  const navigate   = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false); // mobile sidebar toggle

  const handleLogout = () => { logout(); navigate("/"); };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full bg-gray-900 text-white
      ${mobile ? "w-72" : "w-64"}`}>

      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        <Link to="/" className="flex items-center gap-2">
          <Leaf size={20} className="text-accent" />
          <span className="font-bold text-lg">AgriScheme</span>
        </Link>
        {mobile && (
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      {/* New scan button */}
      <div className="px-3 pt-4 pb-2">
        <Link
          to="/farmer/scan"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 w-full bg-primary hover:bg-primary-dark text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Scan
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV.filter(n => n.to !== "/farmer/scan").map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${active
                  ? "bg-gray-700 text-white font-medium"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        {/* Admin shortcut */}
        {isAdmin && (
          <>
            <div className="border-t border-gray-700 my-2" />
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-amber-400 hover:bg-gray-800 transition-colors"
            >
              <LayoutDashboard size={16} />
              Admin Portal
            </Link>
          </>
        )}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-gray-700 p-3">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <User size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-colors"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <LogIn size={15} /> Sign in
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex flex-col">
            <Sidebar mobile />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — mobile only */}
        <header className="md:hidden bg-gray-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <button onClick={() => setOpen(true)} className="text-gray-300 hover:text-white">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Leaf size={18} className="text-accent" />
            <span className="font-bold">{title}</span>
          </div>
          <Link to="/farmer/scan" className="text-gray-300 hover:text-white">
            <Plus size={22} />
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
