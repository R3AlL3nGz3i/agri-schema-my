import { Link } from "react-router-dom";
import { Leaf, ArrowLeft } from "lucide-react";
import { MARKETPLACE_B64 } from "../marketplaceData";

// The marketplace is a self-contained HTML bundle (its own runtime + assets).
// We embed it as an opaque-origin iframe via a base64 data URL so the entire
// site ships as one standalone HTML file with no external requests.
const SRC = "data:text/html;charset=utf-8;base64," + MARKETPLACE_B64;

export default function Marketplace() {
  return (
    <div className="h-screen w-screen flex flex-col bg-primary-dark">
      {/* Slim brand bar to get back into the rest of the app */}
      <div className="flex-none flex items-center gap-3 px-4 h-11 text-white">
        <Link to="/" className="flex items-center gap-1.5 text-green-100 hover:text-white text-sm font-medium">
          <ArrowLeft size={16} /> Back to AgriScheme
        </Link>
        <span className="mx-1 text-white/30">|</span>
        <div className="flex items-center gap-1.5">
          <Leaf size={15} className="text-accent" />
          <span className="text-sm font-semibold">AgriScheme Marketplace</span>
        </div>
      </div>
      <iframe
        title="AgriScheme Marketplace"
        src={SRC}
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}
