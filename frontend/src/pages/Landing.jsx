import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Leaf, Camera, FlaskConical, LogIn, LogOut, User, LayoutDashboard,
  Store, Upload, ScanLine, ClipboardCheck, ShieldCheck, ArrowRight, Sprout,
} from "lucide-react";

const STEPS = [
  { icon: Upload,          title: "Snap or upload",  body: "Photograph the affected leaf, fruit, or stem. No login, no app install." },
  { icon: ScanLine,        title: "AI screening",    body: "Symptoms are matched against a validated Malaysian crop-disease knowledge base." },
  { icon: ClipboardCheck,  title: "Action plan",     body: "Get treatments cross-checked against DOA / LRMP regulations, with source citations." },
];

const STATS = [
  { value: "23",   label: "Diseases catalogued" },
  { value: "8",    label: "Crops covered" },
  { value: "100%", label: "Professor-reviewed" },
  { value: "Free", label: "Every scan" },
];

export default function Landing() {
  const { user, logout, isAdmin, isUser } = useApp();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div className="min-h-screen bg-[var(--surface)]">

      {/* ── Hero (deep-green, product mockup on the right) ─────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 80% at 88% -10%, rgba(45,158,95,.35), transparent 55%)," +
            "radial-gradient(90% 70% at 0% 120%, rgba(232,184,75,.14), transparent 55%)," +
            "linear-gradient(160deg, #0a3a20 0%, #0f4a28 48%, #114f2c 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(140% 120% at 50% 0%, transparent 62%, rgba(0,0,0,.35))" }}
        />

        {/* Nav */}
        <header className="relative max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-white">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 ring-1 ring-white/15">
              <Leaf size={20} className="text-accent" />
            </span>
            <span className="text-xl font-bold tracking-tight">AgriScheme</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 bg-white/10 text-white px-3 py-1.5 rounded-full text-sm">
                  <User size={14} />
                  <span>{user.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                    ${isAdmin ? "bg-accent text-primary-dark" : "bg-white/20 text-white"}`}>
                    {user.role}
                  </span>
                </div>
                <button onClick={handleLogout}
                  className="flex items-center gap-1.5 text-green-200 hover:text-white text-sm transition-colors">
                  <LogOut size={15} /> Sign out
                </button>
              </>
            ) : (
              <Link to="/login"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <LogIn size={15} /> Sign in
              </Link>
            )}
          </div>
        </header>

        {/* Hero body */}
        <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-20 md:pt-16 md:pb-28 grid md:grid-cols-2 gap-14 items-center">
          {/* Copy */}
          <div className="text-left">
            <div className="inline-flex items-center gap-2 bg-white/10 ring-1 ring-white/15 text-accent px-4 py-1.5 rounded-full text-[13px] font-semibold tracking-wide">
              <ShieldCheck size={14} /> Evidence-based · Malaysia validated
            </div>
            <h1 className="mt-5 text-[42px] md:text-[60px] font-bold text-white leading-[1.03] tracking-[-.02em]">
              Crop disease answers,
              <span className="block bg-gradient-to-r from-[#f5d07a] to-[#e8b84b] bg-clip-text text-transparent">
                built for Malaysian farms
              </span>
            </h1>
            <p className="mt-5 text-green-50/80 text-lg max-w-md leading-relaxed">
              From a single crop photo to a science-backed action plan — cross-checked
              against Malaysian agricultural regulations.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/farmer"
                className="inline-flex items-center gap-2 bg-white text-[var(--brand-dark)] font-semibold px-5 py-3 rounded-xl shadow-[var(--shadow-lg)] hover:-translate-y-0.5 transition-transform">
                <Camera size={18} /> {isUser ? "Go to your assistant" : "Scan a crop"}
              </Link>
              <Link to="/marketplace"
                className="inline-flex items-center gap-2 text-white/90 hover:text-white font-semibold px-5 py-3 rounded-xl ring-1 ring-white/20 hover:ring-white/40 transition-colors">
                <Store size={18} /> Explore marketplace
              </Link>
            </div>
            <p className="mt-4 text-green-50/50 text-xs">No login required to scan.</p>
          </div>

          {/* Product mockup */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-accent/10 blur-2xl" />
            <div className="relative bg-[var(--surface-card)] rounded-2xl shadow-[0_28px_60px_-20px_rgba(0,0,0,.55)] ring-1 ring-black/5 p-4 rotate-[-1deg]">
              <div className="crop-tile rounded-xl h-40 mb-3 relative">
                <Sprout size={40} className="text-[var(--brand-light)]" />
                <span className="absolute bottom-2 left-3 text-[11px] font-medium text-[var(--ink-soft)] bg-white/70 px-2 py-0.5 rounded-md">
                  durian_leaf.jpg
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-[var(--ink)] leading-tight">Durian Root Rot</p>
                  <span className="text-xs text-[var(--ink-soft)] italic">Busuk Akar</span>
                </div>
                <span className="badge-approved">MY approved</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge-oomycete">Oomycete</span>
                <span className="text-xs font-medium text-[var(--ink-soft)] capitalize">durian</span>
              </div>
              <div className="pt-3 border-t border-[var(--line)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)]">Match confidence</span>
                  <span className="text-xs font-semibold text-[var(--brand)] tabular-nums">92%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-sunk)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: "92%", background: "linear-gradient(90deg, var(--brand-light), var(--brand))" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-[var(--ink)] tracking-tight">
            Photo to action plan in three steps
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <div key={i} className="card card-hover relative">
              <span className="absolute top-5 right-5 text-5xl font-bold text-[var(--line)] leading-none select-none">
                {i + 1}
              </span>
              <div className="w-12 h-12 rounded-xl crop-tile ring-1 ring-[var(--line)] mb-4">
                <s.icon size={22} className="text-[var(--brand)]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--ink)] mb-1.5">{s.title}</h3>
              <p className="text-[var(--ink-soft)] text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Evidence stats band ───────────────────────────────────────── */}
      <section className="border-y border-[var(--line)] bg-[var(--surface-card)]">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-[var(--brand)] tracking-tight tabular-nums">{s.value}</p>
              <p className="mt-1.5 text-sm text-[var(--ink-soft)]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Role entry ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="eyebrow">Get started</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-[var(--ink)] tracking-tight">
            Choose how you want to begin
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Farmer */}
          <Link to="/farmer" className="card card-hover group text-left flex flex-col">
            <div className="w-12 h-12 rounded-xl crop-tile ring-1 ring-[var(--line)] mb-4 group-hover:scale-105 transition-transform">
              <Camera size={22} className="text-[var(--brand)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--ink)] mb-1.5">
              {isUser ? `Welcome, ${user.name}` : "I am a Farmer"}
            </h3>
            <p className="text-[var(--ink-soft)] text-sm leading-relaxed flex-1">
              {isUser ? "Continue to your crop disease assistant."
                      : "Upload a crop photo and get an evidence-based action plan. No login required."}
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-[var(--brand)] font-semibold text-sm group-hover:gap-2 transition-all">
              {isUser ? "Go to home" : "Scan crop"} <ArrowRight size={15} />
            </span>
          </Link>

          {/* Admin / Researcher */}
          <Link to={isAdmin ? "/admin" : "/login"} className="card card-hover group text-left flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-sunk)] ring-1 ring-[var(--line)] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              {isAdmin ? <LayoutDashboard size={22} className="text-[var(--brand)]" />
                       : <FlaskConical size={22} className="text-[var(--brand)]" />}
            </div>
            <h3 className="text-xl font-bold text-[var(--ink)] mb-1.5">
              {isAdmin ? "Admin Portal" : "Researcher / Admin"}
            </h3>
            <p className="text-[var(--ink-soft)] text-sm leading-relaxed flex-1">
              {isAdmin ? "You are signed in as admin. Open your dashboard."
                       : "Build and validate the crop disease knowledge base. Login required."}
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-[var(--brand)] font-semibold text-sm group-hover:gap-2 transition-all">
              {isAdmin ? "Open dashboard" : "Sign in to access"} <ArrowRight size={15} />
            </span>
          </Link>

          {/* Marketplace */}
          <Link to="/marketplace" className="card card-hover group text-left flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-sunk)] ring-1 ring-[var(--line)] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Store size={22} className="text-[var(--brand)]" />
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-xl font-bold text-[var(--ink)]">Marketplace</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand)] bg-[#e9f4ec] px-1.5 py-0.5 rounded">New</span>
            </div>
            <p className="text-[var(--ink-soft)] text-sm leading-relaxed flex-1">
              Buy fresh produce direct from Malaysian farms, or sell your harvest.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-[var(--brand)] font-semibold text-sm group-hover:gap-2 transition-all">
              Open marketplace <ArrowRight size={15} />
            </span>
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--line)] bg-[var(--surface-card)]">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--ink)]">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--brand)]">
              <Leaf size={16} className="text-white" />
            </span>
            <span className="font-bold tracking-tight">AgriScheme</span>
          </div>
          <p className="text-[var(--ink-soft)] text-xs max-w-lg leading-relaxed">
            Uses open scholarly APIs (Crossref, Semantic Scholar) and Malaysia DOA / LRMP
            regulatory data. AI-assisted screening only — not a substitute for laboratory diagnosis.
          </p>
        </div>
      </footer>
    </div>
  );
}
