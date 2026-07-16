import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Leaf, Search, History, Home, LogIn, LogOut, User,
  LayoutDashboard, Menu, X, Plus, ClipboardCheck,
  BookOpen, BarChart2, Camera,
} from "lucide-react";

// ── Nav definitions per role ──────────────────────────────

const FARMER_NAV = [
  { to: "/farmer",         icon: Home,    label: "Home"     },
  { to: "/farmer/search",  icon: Search,  label: "Search"   },
  { to: "/farmer/history", icon: History, label: "History"  },
];

const ADMIN_NAV = [
  { to: "/admin",           icon: LayoutDashboard, label: "Dashboard"      },
  { to: "/admin/search",    icon: Search,          label: "Evidence Search" },
  { to: "/admin/queue",     icon: ClipboardCheck,  label: "Review Queue"   },
  { to: "/admin/knowledge", icon: BookOpen,        label: "Knowledge Base" },
  { to: "/admin/analytics", icon: BarChart2,       label: "Query Analytics" },
];

export default function AppLayout({ children, title = "AgriScheme" }) {
  const { user, logout, isAdmin, isUser, isGuest, chatHistory } = useApp();
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); navigate("/"); };
  const close = () => setOpen(false);

  const isAdminPage = pathname.startsWith("/admin");

  // ── Sidebar content ───────────────────────────────────────
  const SidebarContent = () => (
    <div className="sidebar-shell flex flex-col h-full w-64">

      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b sidebar-line shrink-0">
        <Link to="/" onClick={close} className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/10">
            <Leaf size={17} className="text-accent" />
          </span>
          <span className="font-bold text-base tracking-tight">AgriScheme</span>
        </Link>
        <button onClick={close} className="md:hidden text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">

        {/* ── FARMER section (always shown) ── */}
        {!isAdmin && (
          <div className="px-3 pb-2 pt-1">
            <Link
              to="/farmer/scan"
              onClick={close}
              className="btn-primary w-full mb-3"
            >
              <Plus size={15} /> New Scan
            </Link>
          </div>
        )}

        {/* ── ADMIN PORTAL section ── */}
        {isAdmin && (
          <>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-[.14em] px-3 pb-2 pt-1">Admin Portal</p>
            {ADMIN_NAV.map(({ to, icon: Icon, label }) => {
              const active = pathname === to;
              return (
                <Link key={to} to={to} onClick={close}
                  className={`nav-item ${active ? "nav-item-active" : ""}`}>
                  <Icon size={15} />
                  {label}
                </Link>
              );
            })}
            <div className="border-t sidebar-line my-3" />
          </>
        )}

        {/* ── FARMER PORTAL section (admin sees this too) ── */}
        {isAdmin && (
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-[.14em] px-3 pb-2">Farmer Portal</p>
        )}
        {!isAdmin && (
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-[.14em] px-3 pb-2">Farmer Assistant</p>
        )}

        {FARMER_NAV.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} onClick={close}
              className={`nav-item ${active ? "nav-item-active" : ""}`}>
              <Icon size={15} />
              {label}
            </Link>
          );
        })}

        {/* Admin: New Scan button under farmer section */}
        {isAdmin && (
          <Link to="/farmer/scan" onClick={close} className="nav-item">
            <Plus size={15} /> New Scan
          </Link>
        )}

        {/* Guest history note */}
        {isGuest && pathname === "/farmer/history" && (
          <div className="mx-3 mt-2 p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60">
            Sign in to save history permanently.
          </div>
        )}

        {/* Recent history in sidebar — logged-in users */}
        {(isUser || isAdmin) && chatHistory.length > 0 && pathname !== "/farmer/history" && (
          <>
            <div className="border-t sidebar-line my-3" />
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-[.14em] px-3 pb-1">Recent</p>
            {chatHistory.slice(0, 5).map((h, i) => (
              <div key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/50 hover:bg-white/5 hover:text-white/80 cursor-default transition-colors">
                <Camera size={12} className="shrink-0" />
                <span className="truncate">{h.label}</span>
              </div>
            ))}
          </>
        )}
      </nav>

      {/* Bottom user section */}
      <div className="border-t sidebar-line p-3 shrink-0">
        {user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/10 ring-1 ring-white/10 flex items-center justify-center shrink-0 text-accent">
                <User size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-white/50 capitalize">{user.role}</p>
              </div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <Link to="/login" onClick={close}
            className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors">
            <LogIn size={14} /> Sign in
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface)" }}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <SidebarContent />
          <div className="flex-1 bg-black/50" onClick={close} />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="sidebar-shell md:hidden text-white px-4 py-3 flex items-center justify-between shrink-0">
          <button onClick={() => setOpen(true)} className="text-gray-300 hover:text-white">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Leaf size={17} className="text-accent" />
            <span className="font-bold text-sm">{title}</span>
          </div>
          {!isAdmin && (
            <Link to="/farmer/scan" className="text-gray-300 hover:text-white">
              <Plus size={22} />
            </Link>
          )}
          {isAdmin && <div className="w-6" />}
        </header>

        {/* Admin top bar — desktop */}
        {isAdminPage && (
          <header className="hidden md:flex px-6 py-3 items-center justify-between shrink-0 bg-white/70 backdrop-blur border-b" style={{ borderColor: "var(--line)" }}>
            <h1 className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>Admin / Researcher Portal</h1>
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">
              {user?.name}
            </span>
          </header>
        )}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
