import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Leaf, Camera, FlaskConical, Globe, LogIn, LogOut, User, LayoutDashboard, Store } from "lucide-react";

export default function Landing() {
  const { user, logout, isAdmin, isUser } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-primary-light flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2 text-white">
          <Leaf size={26} className="text-accent" />
          <span className="text-xl font-bold">AgriScheme</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2 bg-white/10 text-white px-3 py-1.5 rounded-full text-sm">
                <User size={14} />
                <span>{user.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                  ${isAdmin ? "bg-accent text-primary-dark" : "bg-white/20 text-white"}`}>
                  {user.role === "user" ? "Farmer" : user.role}
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
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 text-accent px-4 py-1.5 rounded-full text-sm font-medium">
            <Globe size={14} /> Evidence-Based · Malaysia Validated
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Crop Disease Assistant<br />
            <span className="text-accent">for Malaysia</span>
          </h1>
          <p className="text-green-100 text-lg max-w-xl mx-auto">
            From crop photo to science-backed solution — validated against Malaysian agricultural regulations.
          </p>
        </div>

        {/* Role cards — change based on login state */}
        <div className="grid md:grid-cols-2 gap-5 w-full max-w-2xl">

          {/* Farmer card */}
          <Link
            to="/farmer"
            className="bg-white rounded-2xl p-7 text-left hover:shadow-xl transition-shadow group"
          >
            <Camera size={32} className="text-primary mb-3 group-hover:scale-110 transition-transform" />
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              {isUser ? `Welcome, ${user.name}` : "I am a Farmer"}
            </h2>
            <p className="text-gray-500 text-sm">
              {isUser
                ? "Continue to your crop disease assistant."
                : "Upload a crop photo and get an evidence-based action plan. No login required."}
            </p>
            <span className="mt-4 inline-block text-primary font-medium text-sm">
              {isUser ? "Go to home →" : "Scan crop →"}
            </span>
          </Link>

          {/* Admin card */}
          {isAdmin ? (
            <Link
              to="/admin"
              className="bg-primary-dark rounded-2xl p-7 text-left hover:shadow-xl transition-shadow group border border-primary"
            >
              <LayoutDashboard size={32} className="text-accent mb-3 group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-bold text-white mb-1">Admin Portal</h2>
              <p className="text-green-200 text-sm">
                You are signed in as admin. Go to your dashboard.
              </p>
              <span className="mt-4 inline-block text-accent font-medium text-sm">
                Open dashboard →
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="bg-primary-dark rounded-2xl p-7 text-left hover:shadow-xl transition-shadow group border border-primary"
            >
              <FlaskConical size={32} className="text-accent mb-3 group-hover:scale-110 transition-transform" />
              <h2 className="text-xl font-bold text-white mb-1">Researcher / Admin</h2>
              <p className="text-green-200 text-sm">
                Build and validate the crop disease knowledge base. Login required.
              </p>
              <span className="mt-4 inline-block text-accent font-medium text-sm">
                Sign in to access →
              </span>
            </Link>
          )}
        </div>

        {/* Marketplace — Farmer accounts use the buyer shopping view. */}
        <Link
          to="/marketplace"
          className="w-full max-w-2xl bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl p-5 flex items-center gap-4 text-left transition-colors group"
        >
          <div className="flex-none w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <Store size={24} className="text-accent" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">AgriScheme Marketplace</h2>
            <p className="text-green-100 text-sm">
              Shop for fresh produce and agricultural products from Malaysian sellers.
            </p>
          </div>
          <span className="text-accent font-medium text-sm group-hover:translate-x-0.5 transition-transform">Open →</span>
        </Link>

        <p className="text-green-200 text-xs max-w-md">
          AgriScheme uses open scholarly APIs (Crossref, Semantic Scholar) and Malaysia DOA/LRMP regulatory data.
          AI-assisted screening only — not a substitute for laboratory diagnosis.
        </p>
      </main>
    </div>
  );
}
