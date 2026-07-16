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
    <div className={`sidebar-shell flex flex-col h-full
      ${mobile ? "w-72" : "w-64"}`}>

      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b sidebar-line">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/10">
            <Leaf size={17} className="text-accent" />
          </span>
          <span className="font-bold text-lg tracking-tight">AgriScheme</span>
        </Link>
        {mobile && (
          <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      {/* New scan button */}
      <div className="px-3 pt-4 pb-2">
        <Link
          to="/farmer/scan"
          onClick={() => setOpen(false)}
          className="btn-primary w-full"
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
              className={`nav-item ${active ? "nav-item-active" : ""}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        {/* Admin shortcut */}
        {isAdmin && (
          <>
            <div className="border-t sidebar-line my-2" />
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="nav-item text-accent hover:text-accent"
            >
              <LayoutDashboard size={16} />
              Admin Portal
            </Link>
          </>
        )}
      </nav>

      {/* User section at bottom */}
      <div className="border-t sidebar-line p-3">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/10 flex items-center justify-center shrink-0 text-accent">
                <User size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-white/50 capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
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
        <header className="sidebar-shell md:hidden text-white px-4 py-3 flex items-center justify-between shrink-0">
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
