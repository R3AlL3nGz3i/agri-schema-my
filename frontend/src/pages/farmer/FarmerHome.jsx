import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import AppLayout from "../../components/AppLayout";
import { Camera, Search, Leaf, Sprout, Store, MessageCircle, Lock } from "lucide-react";

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
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sprout size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {isUser ? `Welcome back, ${user.name}!` : "How can I help your crops today?"}
          </h1>
          <p className="text-gray-500 text-sm max-w-md">
            Upload a crop photo or describe your symptoms to get evidence-based disease diagnosis
            validated against Malaysian agricultural regulations.
          </p>
        </div>

        {/* Main action cards */}
        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <Link
            to="/farmer/scan"
            className="group bg-white border border-gray-200 hover:border-primary hover:shadow-md rounded-2xl p-5 flex flex-col items-center gap-3 transition-all"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Camera size={24} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800 text-sm">Scan Crop</p>
              <p className="text-xs text-gray-400 mt-0.5">Upload a photo</p>
            </div>
          </Link>

          <Link
            to="/farmer/search"
            className="group bg-white border border-gray-200 hover:border-primary hover:shadow-md rounded-2xl p-5 flex flex-col items-center gap-3 transition-all"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Search size={24} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800 text-sm">Search Disease</p>
              <p className="text-xs text-gray-400 mt-0.5">By crop or symptom</p>
            </div>
          </Link>
        </div>

        {/* Member spaces are visible in guest mode but require sign-in. */}
        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <MemberCard to="/marketplace" icon={Store} title="Marketplace" description="Buy agricultural products from trusted sellers" locked={!user} />
          <MemberCard to="/community" icon={MessageCircle} title="Community" description="Ask questions and share solutions" locked={!user} />
        </div>

        {/* Suggestion prompts */}
        <div className="w-full mb-8">
          <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">Try asking about</p>
          <div className="flex flex-col gap-2">
            {SUGGESTIONS.map((s, i) => (
              <Link
                key={i}
                to={`/farmer/search?symptom=${encodeURIComponent(s)}`}
                className="flex items-center gap-3 bg-white border border-gray-100 hover:border-primary hover:bg-primary/5 rounded-xl px-4 py-3 text-sm text-gray-600 hover:text-primary transition-all group"
              >
                <Leaf size={14} className="text-gray-300 group-hover:text-primary shrink-0" />
                {s}
              </Link>
            ))}
          </div>
        </div>

        {/* Quick crop pills */}
        <div className="w-full">
          <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">Browse by crop</p>
          <div className="flex flex-wrap gap-2">
            {CROPS.map(crop => (
              <Link
                key={crop}
                to={`/farmer/search?crop=${crop.toLowerCase().replace(" ","_")}`}
                className="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-sm text-gray-600 hover:border-primary hover:text-primary transition-colors"
              >
                {crop}
              </Link>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-gray-400 text-center mt-8 max-w-sm">
          ⚠️ AI-assisted screening only. Not a substitute for laboratory diagnosis.
          Always consult a certified agronomist.
        </p>
      </div>
    </AppLayout>
  );
}

function MemberCard({ to, icon: Icon, title, description, locked }) {
  return (
    <Link to={to} className="group relative bg-white border border-gray-200 hover:border-primary hover:shadow-md rounded-2xl p-4 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"><Icon size={20} className="text-primary" /></div>
        {locked && <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-full"><Lock size={10} /> Sign in</span>}
      </div>
      <p className="font-semibold text-gray-800 text-sm">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </Link>
  );
}
