import { useState, useRef, useEffect } from "react";
import AppLayout from "../../components/AppLayout";
import { useApp } from "../../context/AppContext";
import { queryDisease } from "../../api";
import { MyStatusBadge, PathogenBadge, ConfidenceBar } from "../../components/Badges";
import { Camera, Upload, Send, Loader, ImagePlus, Plus } from "lucide-react";

const CROPS     = ["paddy","durian","banana","chilli","tomato","rubber","oil_palm","cocoa"];
const PARTS     = ["Leaf","Fruit","Stem","Root","Whole plant"];
const DURATIONS = ["1–3 days","1 week","More than 2 weeks"];
const ACTIONS   = [
  "Remove heavily infected leaves, fruits, or stems.",
  "Avoid overhead watering — water at the base.",
  "Improve plant spacing and ventilation.",
  "Do not reuse infected plant material as compost.",
  "Wash hands and tools after handling infected plants.",
];

export default function ScanCrop() {
  const { addHistory } = useApp();
  const fileRef   = useRef();
  const bottomRef = useRef();

  const [messages,  setMessages]  = useState([{
    role: "assistant",
    content: "Hello! Upload a photo of your crop and I'll help identify any diseases. You can also describe the symptoms.",
  }]);
  const [preview,  setPreview]  = useState(null);
  const [crop,     setCrop]     = useState("");
  const [part,     setPart]     = useState("");
  const [duration, setDuration] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState("idle"); // idle | details | done

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const push = (role, content, extra = {}) =>
    setMessages(prev => [...prev, { role, content, ...extra }]);

  const handleFile = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStep("details");
    push("user", null, { image: url });
    push("assistant", "Great! Now tell me which crop this is and describe the symptoms so I can give a better diagnosis.");
  };

  const handleAnalyse = async () => {
    if (!crop) { push("assistant", "Please select which crop this is first."); return; }
    const userMsg = [
      `Crop: ${crop.replace("_"," ")}`,
      part && `Affected part: ${part}`,
      duration && `Duration: ${duration}`,
    ].filter(Boolean).join(" · ");

    push("user", userMsg);
    setLoading(true); setStep("done");

    try {
      const symptom = [part, duration].filter(Boolean).join(", ");
      const r = await queryDisease({ crop, symptom: symptom || undefined, n_results: 5 });
      if (r.data.length === 0) {
        push("assistant", "No matching disease found. Try a different crop or symptom.");
      } else {
        push("assistant", null, { results: r.data });
        addHistory({ label: `${crop.replace("_"," ")} — ${r.data[0].disease_name}`, ts: Date.now() });
      }
    } catch {
      push("assistant", "Could not connect to the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([{ role: "assistant", content: "Hello! Upload a photo of your crop and I'll help identify any diseases." }]);
    setPreview(null); setCrop(""); setPart(""); setDuration(""); setStep("idle");
  };

  return (
    <AppLayout title="Scan Crop">
      <div className="flex flex-col h-full">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 max-w-2xl mx-auto w-full">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Camera size={14} className="text-white" />
                </div>
              )}
              <div className={`max-w-[80%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.content && (
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${msg.role === "user"
                      ? "bg-primary text-white rounded-tr-sm shadow-[var(--shadow-sm)]"
                      : "bg-white border border-[var(--line)] text-[var(--ink)] rounded-tl-sm shadow-[var(--shadow-sm)]"}`}>
                    {msg.content}
                  </div>
                )}
                {msg.image && (
                  <img src={msg.image} alt="crop" className="max-h-52 rounded-2xl rounded-tr-sm object-cover border border-[var(--line)] shadow-[var(--shadow-md)]" />
                )}
                {msg.results && (
                  <div className="bg-white border border-[var(--line)] rounded-2xl rounded-tl-sm shadow-[var(--shadow-md)] p-4 space-y-4 w-full max-w-sm">
                    <p className="eyebrow">Here's what I found</p>
                    {/* Primary diagnosis */}
                    <div className="rounded-xl crop-tile ring-1 ring-[var(--line)] p-3.5">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-bold text-[var(--ink)] text-[15px]">{msg.results[0].disease_name}</span>
                        <PathogenBadge type={msg.results[0].pathogen_category} />
                      </div>
                      <ConfidenceBar value={msg.results[0].relevance_score} />
                      <p className="text-xs text-[var(--ink-soft)] mt-2 line-clamp-2 leading-relaxed">{msg.results[0].symptoms_summary}</p>
                    </div>
                    {msg.results.length > 1 && (
                      <div>
                        <p className="eyebrow mb-2">Other possibilities</p>
                        <div className="space-y-1.5">
                          {msg.results.slice(1, 3).map((r, j) => (
                            <div key={j} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-2.5 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <PathogenBadge type={r.pathogen_category} />
                                <span className="text-xs text-[var(--ink)] truncate">{r.disease_name}</span>
                              </div>
                              <div className="w-20 shrink-0"><ConfidenceBar value={r.relevance_score} /></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--line)]">
                      <span className="text-xs font-medium text-[var(--ink-soft)]">Malaysia status:</span>
                      <MyStatusBadge status={
                        msg.results[0].professor_verdict === "PASS"   ? "MY_approved"   :
                        msg.results[0].professor_verdict === "FLAG"   ? "MY_restricted" :
                        msg.results[0].professor_verdict === "REJECT" ? "MY_banned"     : "unknown"
                      } />
                    </div>
                    <div className="rounded-xl p-3 border border-green-200 bg-green-50">
                      <p className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Immediate actions
                      </p>
                      <ul className="space-y-1.5">
                        {ACTIONS.slice(0, 3).map((a, j) => (
                          <li key={j} className="text-xs text-green-800/90 flex gap-2 leading-relaxed">
                            <span className="text-green-500 mt-px">›</span>{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                      ⚠️ AI-assisted screening only. Consult a certified agronomist for confirmation.
                    </p>
                    <button onClick={handleReset} className="btn-outline w-full">
                      <Plus size={14} /> New scan
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Camera size={14} className="text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-4">
                  {[0,150,300].map(d => (
                    <span key={d} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {step !== "done" && (
          <div className="border-t border-[var(--line)] bg-white/80 backdrop-blur px-4 py-4 max-w-2xl mx-auto w-full shrink-0">
            {step === "idle" && (
              <button
                onClick={() => fileRef.current.click()}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[var(--line-strong)] hover:border-[var(--brand-light)] hover:bg-[#f3f8f4] rounded-xl py-5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--brand-dark)] transition-all"
              >
                <ImagePlus size={18} /> Upload crop photo
              </button>
            )}
            {step === "details" && (
              <div className="space-y-3">
                <select value={crop} onChange={e => setCrop(e.target.value)}
                  className="input-shell w-full px-3 py-2.5 text-sm text-[var(--ink)] focus:outline-none capitalize">
                  <option value="">Select crop *</option>
                  {CROPS.map(c => <option key={c} value={c}>{c.replace("_"," ")}</option>)}
                </select>
                <div>
                  <p className="eyebrow mb-1.5">Affected part</p>
                  <div className="flex flex-wrap gap-2">
                    {PARTS.map(p => (
                      <button key={p} onClick={() => setPart(p === part ? "" : p)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                          ${part === p
                            ? "bg-primary text-white border-primary shadow-[var(--shadow-sm)]"
                            : "bg-white border-[var(--line-strong)] text-[var(--ink-soft)] hover:border-[var(--brand-light)] hover:text-primary"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="eyebrow mb-1.5">How long</p>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map(d => (
                      <button key={d} onClick={() => setDuration(d === duration ? "" : d)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                          ${duration === d
                            ? "bg-primary text-white border-primary shadow-[var(--shadow-sm)]"
                            : "bg-white border-[var(--line-strong)] text-[var(--ink-soft)] hover:border-[var(--brand-light)] hover:text-primary"}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleAnalyse} disabled={loading || !crop}
                  className="btn-primary w-full py-2.5">
                  {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                  Analyse Disease
                </button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
