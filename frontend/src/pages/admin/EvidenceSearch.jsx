import { useState } from "react";
import AppLayout from "../../components/AppLayout";
import { askDisease, diseaseImageUrl } from "../../api";
import { MyStatusBadge, PathogenBadge } from "../../components/Badges";
import { titleCaseDisease, cleanSymptoms } from "../../utils/format";
import { Search, Loader } from "lucide-react";

const CROPS = ["","paddy","durian","banana","chilli","tomato","rubber","oil_palm","cocoa"];

export default function EvidenceSearch() {
  const [crop, setCrop]       = useState("");
  const [symptom, setSymptom] = useState("");
  const [results, setResults] = useState([]);
  const [answer, setAnswer]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSearch = async () => {
    if (!crop && !symptom) { setError("Enter a crop or symptom."); return; }
    setError(""); setLoading(true); setAnswer("");
    // /ask needs a question; when only a crop is chosen, ask for its known diseases.
    const question = symptom || `Common diseases and treatments for ${crop.replace("_"," ")}`;
    try {
      const r = await askDisease({ crop: crop || undefined, question, n_results: 10 });
      setAnswer(r.data.answer || "");
      setResults(r.data.results || []);
    } catch {
      setError("Search failed. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <h2 className="text-xl font-bold mb-6">Evidence Search</h2>

      {/* Search bar */}
      <div className="card mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Crop</label>
            <select
              value={crop}
              onChange={e => setCrop(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {CROPS.map(c => (
                <option key={c} value={c}>{c ? c.replace("_"," ") : "All crops"}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Disease / Symptom / Keyword</label>
            <div className="flex gap-2">
              <input
                value={symptom}
                onChange={e => setSymptom(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="e.g. blast disease, Magnaporthe oryzae, leaf spot..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <button onClick={handleSearch} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                Search
              </button>
            </div>
          </div>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* AI evidence summary */}
      {answer && (
        <div className="card mb-6">
          <p className="text-sm text-gray-700 whitespace-pre-line">{answer}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{results.length} results found</p>
          {results.map((r, i) => (
            <div key={i} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <img
                  src={diseaseImageUrl(r.crop, r.disease_name)}
                  alt={`${r.crop} ${r.disease_name} example`}
                  loading="lazy"
                  onError={e => { e.currentTarget.style.display = "none"; }}
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-800">{titleCaseDisease(r.disease_name)}</span>
                    {r.local_name && <span className="text-gray-400 text-sm">({r.local_name})</span>}
                    <PathogenBadge type={r.pathogen_category} />
                  </div>
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">{cleanSymptoms(r.symptoms_summary)}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-2">
                    <span>🌿 {r.crop}</span>
                  </div>
                  {(r.authorities?.length > 0 || r.citations?.length > 0) && (
                    <div className="border-t border-gray-100 pt-2">
                      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Sources &amp; authorities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {r.authorities?.map((a, j) =>
                          a.url ? (
                            <a key={`a${j}`} href={a.url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                              {a.name}
                              {a.role && <span className="text-gray-400">· {a.role}</span>}
                            </a>
                          ) : (
                            <span key={`a${j}`} className="text-xs text-gray-500 bg-gray-50 border rounded-full px-2 py-0.5">
                              {a.name}{a.role && <span className="text-gray-400"> · {a.role}</span>}
                            </span>
                          )
                        )}
                        {r.citations?.map((c, j) => (
                          <span key={`c${j}`} className="text-xs text-gray-500 bg-gray-50 border rounded-full px-2 py-0.5 truncate max-w-xs">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right space-y-2 min-w-[120px]">
                  <MyStatusBadge status={r.professor_verdict === "PASS" ? "MY_approved" : "unknown"} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p>Search for crop diseases using the form above.</p>
        </div>
      )}
    </AppLayout>
  );
}
