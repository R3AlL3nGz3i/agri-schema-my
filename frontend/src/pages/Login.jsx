import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Leaf, Eye, EyeOff, Loader, AlertCircle, LogIn, UserCircle } from "lucide-react";

const ADMIN_EMAIL = "admin@agrischeme.my";
const SELLER_EMAIL = "seller@agrischeme.my";
const RESEARCHER_EMAIL = "researcher@agrischeme.my";

const landingForRole = (role) => {
  if (role === "admin" || role === "researcher") return "/admin";
  if (role === "seller") return "/marketplace";
  return "/";
};

export default function Login() {
  const { login, user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from?.pathname;

  // Redirect already-logged-in users away from login page
  useEffect(() => {
    if (user) navigate(returnTo || landingForRole(user.role), { replace: true });
  }, [user, navigate, returnTo]);

  const [tab, setTab]           = useState("login");   // "login" | "signup"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loadingRole, setLoadingRole] = useState(null); // "login" | "signup"
  const [error, setError]       = useState("");

  // Demo role recognition. Production authentication must resolve this server-side.
  const handleLogin = () => {
    if (!email || !password) { setError("Please enter email and password."); return; }
    setError(""); setLoadingRole("login");

    const displayName = name || email.split("@")[0];
    const normalisedEmail = email.trim().toLowerCase();
    const role = normalisedEmail === ADMIN_EMAIL
      ? "admin"
      : normalisedEmail === SELLER_EMAIL
        ? "seller"
        : normalisedEmail === RESEARCHER_EMAIL ? "researcher" : "user";
    login({ name: displayName, email, role });
    navigate(returnTo || landingForRole(role), { replace: true });
    setLoadingRole(null);
  };

  // ── Signup (client-side only, always a farmer account) ──
  const handleSignup = (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPw) { setError("All fields are required."); return; }
    if (password !== confirmPw) { setError("Passwords do not match."); return; }
    if (password.length < 6)   { setError("Password must be at least 6 characters."); return; }
    setError(""); setLoadingRole("signup");

    login({ name, email, role: "user" });
    navigate(returnTo || "/", { replace: true });
    setLoadingRole(null);
  };

  const isLoading = loadingRole !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-primary-light flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-white mb-2">
            <Leaf size={32} className="text-accent" />
            <span className="text-3xl font-bold">AgriScheme</span>
          </div>
          <p className="text-green-200 text-sm">Evidence-Based Crop Disease Assistant</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b">
            {["login", "signup"].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors
                  ${tab === t
                    ? "text-primary border-b-2 border-primary bg-white"
                    : "text-gray-400 hover:text-gray-600 bg-gray-50"}`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* ── LOGIN TAB ── */}
            {tab === "login" && (
              <div className="space-y-4">
                <p className="text-gray-500 text-sm">
                  No account?{" "}
                  <button onClick={() => setTab("signup")} className="text-primary font-medium hover:underline">
                    Sign up free
                  </button>
                  {" · "}
                  <Link to="/" className="text-primary font-medium hover:underline">
                    Continue as guest
                  </Link>
                </p>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      placeholder="••••••••"
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                    <AlertCircle size={15} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  {loadingRole === "login"
                    ? <Loader size={16} className="animate-spin" />
                    : <LogIn size={17} />}
                  Sign In
                </button>

                {/* Demo hint */}
                <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-600">Demo credentials:</p>
                  <p>🛡️ Admin: <span className="font-mono">admin@agrischeme.my</span> / <span className="font-mono">admin123</span></p>
                  <p>🌾 Seller: <span className="font-mono">seller@agrischeme.my</span> / <span className="font-mono">seller123</span></p>
                  <p>🔬 Researcher: <span className="font-mono">researcher@agrischeme.my</span> / <span className="font-mono">researcher123</span></p>
                </div>
              </div>
            )}

            {/* ── SIGNUP TAB ── */}
            {tab === "signup" && (
              <form onSubmit={handleSignup} className="space-y-4">
                <p className="text-gray-500 text-sm">
                  Create a free farmer account. Already have one?{" "}
                  <button type="button" onClick={() => setTab("login")} className="text-primary font-medium hover:underline">
                    Sign in
                  </button>
                </p>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ahmad bin Ali"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Confirm Password</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                    <AlertCircle size={15} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  {loadingRole === "signup"
                    ? <Loader size={16} className="animate-spin" />
                    : <UserCircle size={17} />}
                  Create Account
                </button>

                <p className="text-xs text-gray-400 text-center">
                  New accounts are Farmer accounts.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
