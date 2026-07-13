import { Link } from "react-router-dom";
import AppLayout from "../../components/AppLayout";
import { useApp } from "../../context/AppContext";
import { Camera, Clock, LogIn, Trash2 } from "lucide-react";

export default function FarmerHistory() {
  const { user, isGuest, chatHistory, clearHistory } = useApp();

  return (
    <AppLayout title="History">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-800">Scan History</h2>
          {chatHistory.length > 0 && (
            <button onClick={clearHistory}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>

        {isGuest ? (
          <div className="text-center py-16 text-gray-400">
            <Clock size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-600 mb-1">You're browsing as a guest</p>
            <p className="text-xs text-gray-400 mb-6 max-w-xs mx-auto">
              Guest sessions are temporary — history is not saved when you close the tab.
              Sign in to keep your scan history permanently.
            </p>
            <Link to="/login" className="btn-primary inline-flex items-center gap-2 text-sm">
              <LogIn size={15} /> Sign in or create account
            </Link>
          </div>
        ) : chatHistory.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Clock size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-600 mb-1">No scan history yet</p>
            <p className="text-xs text-gray-400 mb-6">Your previous diagnoses will appear here.</p>
            <Link to="/farmer/scan" className="btn-primary inline-flex items-center gap-2 text-sm">
              <Camera size={15} /> Start your first scan
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {chatHistory.map((h, i) => (
              <div key={i} className="card flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Camera size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{h.label}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(h.ts).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
