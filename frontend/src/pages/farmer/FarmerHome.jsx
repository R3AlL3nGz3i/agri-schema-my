import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import AppLayout from "../../components/AppLayout";
import { Camera, Search, Leaf, Sprout } from "lucide-react";

const CROPS = ["Paddy","Durian","Banana","Chilli","Tomato","Rubber","Oil Palm","Cocoa"];

const SUGGESTIONS = [
  "My paddy leaves have brown spots",
  "Durian fruit is rotting from inside",
  "Chilli plants are wilting suddenly",
  "Banana leaves turning yellow",
  "White powder on rubber leaves",
];

export default function FarmerHome() {
  const { user, isUser } = useApp();

  return (
    <AppLayout title="Home">
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 max-w-2xl mx-auto">

        {/* Welcome */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 crop-tile ring-1 ring-[var(--line)]">
            <Sprout size={30} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-[var(--ink)]">
            {isUser ? `Welcome back, ${user.name}!` : "How can I help your crops today?"}
          </h1>
          <p className="text-sm max-w-md mx-auto text-[var(--ink-soft)]">
            Upload a crop photo or describe your symptoms to get evidence-based disease diagnosis
            validated against Malaysian agricultural regulations.
          </p>
        </div>

        {/* Main action cards */}
        <div className="grid grid-cols-2 gap-4 w-full mb-10">
          <Link
            to="/farmer/scan"
            className="card card-hover group flex flex-col items-center gap-3 transition-all hover:-translate-y-0.5 hover:border-[var(--brand-light)]"
          >
            <div className="w-12 h-12 crop-tile rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Camera size={22} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[var(--ink)] text-sm">Scan Crop</p>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">Upload a photo</p>
            </div>
          </Link>

          <Link
            to="/farmer/search"
            className="card card-hover group flex flex-col items-center gap-3 transition-all hover:-translate-y-0.5 hover:border-[var(--brand-light)]"
          >
            <div className="w-12 h-12 crop-tile rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Search size={22} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[var(--ink)] text-sm">Search Disease</p>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">By crop or symptom</p>
            </div>
          </Link>
        </div>

        {/* Suggestion prompts */}
        <div className="w-full mb-10">
          <p className="eyebrow mb-3">Try asking about</p>
          <div className="flex flex-col gap-2">
            {SUGGESTIONS.map((s, i) => (
              <Link
                key={i}
                to={`/farmer/search?symptom=${encodeURIComponent(s)}`}
                className="flex items-center gap-3 bg-white border border-[var(--line)] hover:border-[var(--brand-light)] hover:bg-[#f3f8f4] rounded-xl px-4 py-3 text-sm text-[var(--ink-soft)] hover:text-[var(--brand-dark)] transition-all group shadow-[var(--shadow-sm)]"
              >
                <Leaf size={14} className="text-[var(--brand-light)] opacity-40 group-hover:opacity-100 shrink-0 transition-opacity" />
                {s}
              </Link>
            ))}
          </div>
        </div>

        {/* Quick crop pills */}
        <div className="w-full">
          <p className="eyebrow mb-3">Browse by crop</p>
          <div className="flex flex-wrap gap-2">
            {CROPS.map(crop => (
              <Link
                key={crop}
                to={`/farmer/search?crop=${crop.toLowerCase().replace(" ","_")}`}
                className="bg-white border border-[var(--line-strong)] px-3.5 py-1.5 rounded-full text-sm font-medium text-[var(--ink-soft)] hover:border-[var(--brand-light)] hover:text-primary hover:bg-[#f3f8f4] transition-colors shadow-[var(--shadow-sm)]"
              >
                {crop}
              </Link>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-[var(--ink-soft)] text-center mt-10 max-w-sm flex items-start gap-1.5 justify-center">
          <span aria-hidden>⚠️</span>
          <span>AI-assisted screening only. Not a substitute for laboratory diagnosis.
          Always consult a certified agronomist.</span>
        </p>
      </div>
    </AppLayout>
  );
}
