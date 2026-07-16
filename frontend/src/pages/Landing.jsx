import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Leaf, Camera, FlaskConical, Globe, LogIn, LogOut, User, LayoutDashboard, Store } from "lucide-react";

export default function Landing() {
  const { user, logout, isAdmin, isUser } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 85% -10%, rgba(45,158,95,.35), transparent 55%)," +
          "radial-gradient(90% 70% at 0% 110%, rgba(232,184,75,.16), transparent 55%)," +
          "linear-gradient(160deg, #0a3a20 0%, #0f4a28 45%, #114f2c 100%)",
      }}
    >
      {/* subtle grain / vignette */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[.5]"
        style={{ background: "radial-gradient(140% 120% at 50% 0%, transparent 60%, rgba(0,0,0,.35))" }}
      />
      {/* Header */}
      <header className="relative flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2 text-white">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 ring-1 ring-white/15">
            <Leaf size={20} className="text-accent" />
          </span>
          <span className="text-xl font-bold tracking-tight">AgriScheme</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2 bg-white/10 text-white px-3 py-1.5 rounded-full text-sm">
                <User size={14} />
                <span>{user.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                  ${isAdmin ? "bg-accent text-primary-dark" : "bg-white/20 text-white"}`}>
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-green-200 hover:text-white text-sm transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <LogIn size={15} /> Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center justify-center text-center px-6 gap-9 py-10">
        <div className="space-y-5 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/10 ring-1 ring-white/15 text-accent px-4 py-1.5 rounded-full text-[13px] font-semibold tracking-wide">
            <Globe size={14} /> Evidence-Based · Malaysia Validated
          </div>
          <h1 className="text-5xl md:text-[68px] font-bold text-white leading-[1.02] tracking-[-.02em]">
            Crop Disease Assistant
            <span className="block bg-gradient-to-r from-[#f5d07a] to-[#e8b84b] bg-clip-text text-transparent">for Malaysia</span>
          </h1>
          <p className="text-green-50/80 text-lg max-w-xl mx-auto leading-relaxed">
            From a single crop photo to a science-backed action plan — cross-checked against Malaysian agricultural regulations.
          </p>
        </div>

        {/* Role cards — change based on login state */}
        <div className="grid md:grid-cols-2 gap-5 w-full max-w-2xl">

          {/* Farmer card — premium white */}
          <Link
            to="/farmer"
            className="relative bg-white rounded-2xl p-7 text-left transition-all duration-200 group hover:-translate-y-1 shadow-[var(--shadow-lg)] hover:shadow-[0_24px_48px_-16px_rgba(0,0,0,.4)] ring-1 ring-black/5"
          >
            <div className="w-12 h-12 rounded-xl crop-tile flex items-center justify-center mb-4 ring-1 ring-[var(--line)] group-hover:scale-105 transition-transform">
              <Camera size={24} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-[var(--ink)] mb-1.5">
              {isUser ? `Welcome, ${user.name}` : "I am a Farmer"}
            </h2>
            <p className="text-[var(--ink-soft)] text-sm leading-relaxed">
              {isUser
                ? "Continue to your crop disease assistant."
                : "Upload a crop photo and get an evidence-based action plan. No login required."}
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-primary font-semibold text-sm group-hover:gap-2 transition-all">
              {isUser ? "Go to home" : "Scan crop"} <span aria-hidden>→</span>
            </span>
          </Link>

          {/* Admin card — dark glass */}
          {isAdmin ? (
            <Link
              to="/admin"
              className="relative rounded-2xl p-7 text-left transition-all duration-200 group hover:-translate-y-1 bg-white/[.06] backdrop-blur-sm ring-1 ring-white/15 hover:ring-accent/40 hover:bg-white/[.09]"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/15 ring-1 ring-accent/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <LayoutDashboard size={24} className="text-accent" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1.5">Admin Portal</h2>
              <p className="text-green-50/70 text-sm leading-relaxed">
                You are signed in as admin. Go to your dashboard.
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-accent font-semibold text-sm group-hover:gap-2 transition-all">
                Open dashboard <span aria-hidden>→</span>
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="relative rounded-2xl p-7 text-left transition-all duration-200 group hover:-translate-y-1 bg-white/[.06] backdrop-blur-sm ring-1 ring-white/15 hover:ring-accent/40 hover:bg-white/[.09]"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/15 ring-1 ring-accent/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <FlaskConical size={24} className="text-accent" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1.5">Researcher / Admin</h2>
              <p className="text-green-50/70 text-sm leading-relaxed">
                Build and validate the crop disease knowledge base. Login required.
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-accent font-semibold text-sm group-hover:gap-2 transition-all">
                Sign in to access <span aria-hidden>→</span>
              </span>
            </Link>
          )}
        </div>

        {/* Marketplace — buyer & seller portal (embedded route) */}
        <Link
          to="/marketplace"
          className="w-full max-w-2xl bg-white/[.06] hover:bg-white/[.1] ring-1 ring-white/12 hover:ring-accent/30 rounded-2xl p-5 flex items-center gap-4 text-left transition-all group"
        >
          <div className="flex-none w-12 h-12 rounded-xl bg-accent/15 ring-1 ring-accent/20 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Store size={24} className="text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">AgriScheme Marketplace</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/15 px-1.5 py-0.5 rounded">New</span>
            </div>
            <p className="text-green-50/70 text-sm mt-0.5">
              Buy fresh produce direct from Malaysian farms, or sell your harvest — the buyer &amp; seller portal.
            </p>
          </div>
          <span className="text-accent font-semibold text-sm inline-flex items-center gap-1 group-hover:gap-2 transition-all shrink-0">Open <span aria-hidden>→</span></span>
        </Link>

        <p className="text-green-50/50 text-xs max-w-md leading-relaxed">
          AgriScheme uses open scholarly APIs (Crossref, Semantic Scholar) and Malaysia DOA/LRMP regulatory data.
          AI-assisted screening only — not a substitute for laboratory diagnosis.
        </p>
      </main>
    </div>
  );
}
