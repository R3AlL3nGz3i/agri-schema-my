import { useLocation, useNavigate } from "react-router-dom";
import { MyStatusBadge, PathogenBadge, ConfidenceBar } from "../../components/Badges";
import { ArrowLeft, AlertTriangle, CheckCircle, BookOpen } from "lucide-react";

const IMMEDIATE_ACTIONS = [
  "Remove heavily infected leaves, fruits, or stems.",
  "Avoid overhead watering — water at the base.",
  "Improve plant spacing and ventilation.",
  "Do not reuse infected plant material as compost.",
  "Wash hands and tools after handling infected plants.",
];

export default function DiagnosisResult() {
  const navigate     = useNavigate();
  const { state }    = useLocation();

  if (!state?.results) {
    navigate("/farmer");
    return null;
  }

  const { results, preview } = state;
  const top = results[0];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-primary text-white px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <span className="font-semibold">Diagnosis Result</span>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-5">
        {preview && (
          <img src={preview} alt="crop" className="w-full max-h-48 object-cover rounded-2xl" />
        )}

        {/* Top result */}
        {top && (
          <div className="card border-l-4 border-primary">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{top.disease_name}</h2>
                {top.local_name && <p className="text-sm text-gray-400">{top.local_name}</p>}
              </div>
              <PathogenBadge type={top.pathogen_category} />
            </div>
            <ConfidenceBar value={top.relevance_score} />
            <p className="text-xs text-gray-400 mt-1">Relevance score</p>
          </div>
        )}

        {/* Other possibilities */}
        {results.length > 1 && (
          <div className="card">
            <h3 className="font-semibold text-sm mb-3 text-gray-600">Other possibilities</h3>
            <div className="space-y-2">
              {results.slice(1, 3).map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PathogenBadge type={r.pathogen_category} />
                    <span className="text-sm text-gray-700">{r.disease_name}</span>
                  </div>
                  <ConfidenceBar value={r.relevance_score} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Immediate actions */}
        <div className="card">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500" />
            Immediate Non-Chemical Actions
          </h3>
          <ul className="space-y-2">
            {IMMEDIATE_ACTIONS.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-primary font-bold mt-0.5">•</span>
                {a}
              </li>
            ))}
          </ul>
        </div>

        {/* Evidence papers */}
        {top?.citations?.length > 0 && (
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BookOpen size={16} className="text-primary" />
              Scientific Evidence ({top.citations.length} papers)
            </h3>
            <div className="space-y-2">
              {top.citations.map((c, i) => (
                <p key={i} className="text-xs text-gray-500 bg-gray-50 rounded p-2">{c}</p>
              ))}
            </div>
          </div>
        )}

        {/* MY Status */}
        <div className="card">
          <h3 className="font-semibold mb-3">Malaysia Validation</h3>
          <div className="flex items-center gap-3">
            <MyStatusBadge status={
              top?.professor_verdict === "PASS"   ? "MY_approved"   :
              top?.professor_verdict === "FLAG"   ? "MY_restricted" :
              top?.professor_verdict === "REJECT" ? "MY_banned"     : "unknown"
            } />
            <p className="text-xs text-gray-500">
              Treatment recommendation status based on Malaysia DOA/LRMP data.
            </p>
          </div>
        </div>

        {/* Safety note */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle size={18} className="text-orange-500 mt-0.5 shrink-0" />
          <p className="text-xs text-orange-800">
            Use only registered products for your crop. Follow label rate, timing, PPE,
            and pre-harvest interval. This is AI-assisted screening — consult a certified
            agronomist for confirmation.
          </p>
        </div>
      </main>
    </div>
  );
}
