import { useEffect, useState } from "react";
import AppLayout from "../../components/AppLayout";
import { getCrops, getDiseases } from "../../api";
import { MyStatusBadge, PathogenBadge, ConfidenceBar } from "../../components/Badges";
import { BookOpen, ChevronRight } from "lucide-react";

export default function KnowledgeBase() {
  const [crops, setCrops]     = useState([]);
  const [selected, setSelected] = useState("");
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    getCrops().then(r => setCrops(r.data.crops || [])).catch(() => {});
  }, []);

  const loadDiseases = async (crop) => {
    setSelected(crop); setLoading(true);
    try {
      const r = await getDiseases(crop);
      setDiseases(r.data.diseases || []);
    } catch { setDiseases([]); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout>
      <h2 className="text-xl font-bold mb-6">Knowledge Base</h2>
      <div className="grid md:grid-cols-4 gap-6">
        {/* Crop list */}
        <div className="card md:col-span-1">
          <h3 className="font-semibold mb-3 text-sm text-gray-500 uppercase tracking-wide">Crops</h3>
          <div className="space-y-1">
            {crops.map(crop => (
              <button
                key={crop}
                onClick={() => loadDiseases(crop)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between
                  ${selected === crop ? "bg-primary text-white" : "hover:bg-gray-50 text-gray-700"}`}
              >
                <span className="capitalize">{crop.replace("_"," ")}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* Disease list */}
        <div className="md:col-span-3">
          {selected ? (
            <>
              <h3 className="font-semibold mb-4 capitalize">{selected.replace("_"," ")} — Diseases</h3>
              {loading ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : diseases.length === 0 ? (
                <p className="text-gray-400 text-sm">No diseases found for this crop.</p>
              ) : (
                <div className="space-y-3">
                  {diseases.map((d, i) => (
                    <div key={i} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{d.name}</p>
                          {d.local_name && <p className="text-sm text-gray-400">{d.local_name}</p>}
                          <div className="flex gap-2 mt-2">
                            <PathogenBadge type={d.pathogen_type} />
                          </div>
                        </div>
                        <div className="text-right space-y-2 min-w-[130px]">
                          <MyStatusBadge status={
                            d.professor_verdict === "PASS" ? "MY_approved" :
                            d.professor_verdict === "FLAG" ? "MY_restricted" :
                            d.professor_verdict === "REJECT" ? "MY_banned" : "unknown"
                          } />
                          <ConfidenceBar value={d.confidence_score} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p>Select a crop to view its disease knowledge base.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
