import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import AppLayout from "../../components/AppLayout";
import { useApp } from "../../context/AppContext";
import { queryDisease } from "../../api";
import { MyStatusBadge, PathogenBadge, ConfidenceBar } from "../../components/Badges";
import { titleCaseDisease, cleanSymptoms } from "../../utils/format";
import { Search, Send, Loader, Sprout } from "lucide-react";

const CROPS = ["paddy","durian","banana","chilli","tomato","rubber","oil_palm","cocoa"];
const QUICK = [
  "Rice blast disease in paddy",
  "Chilli anthracnose symptoms",
  "Banana fusarium wilt treatment",
  "Durian root rot Malaysia",
  "Oil palm ganoderma control",
];

export default function FarmerSearch() {
  const { search } = useLocation();
  const params      = new URLSearchParams(search);
  const initCrop    = params.get("crop") || "";
  const initSymptom = params.get("symptom") || "";
  const { addHistory } = useApp();

  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Search for crop diseases by name, symptom, or select a crop. I'll find the best matches from our knowledge base.",
  }]);
  const [input,   setInput]   = useState("");
  const [crop,    setCrop]    = useState(initCrop);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (initCrop || initSymptom) doSearch(initCrop, initSymptom || initCrop);
  }, []);

  const push = (role, content, extra = {}) =>
    setMessages(prev => [...prev, { role, content, ...extra }]);

  const doSearch = async (c, s) => {
    if (!c && !s) return;
    const label = [c && c.replace("_"," "), s].filter(Boolean).join(" — ");
    push("user", label);
    setLoading(true);
    try {
      const r = await queryDisease({ crop: c || undefined, symptom: s || undefined, n_results: 6 });
      if (r.data.length === 0) {
        push("assistant", "No results found. Try a different crop or symptom.");
      } else {
        push("assistant", null, { results: r.data });
        addHistory({ label, ts: Date.now() });
      }
    } catch {
      push("assistant", "Could not connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const q = input.trim();
    if (!q && !crop) return;
    setInput("");
    doSearch(crop, q);
  };

  return (
    <AppLayout title="Search Disease">
      <div className="flex flex-col h-full">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 max-w-2xl mx-auto w-full">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Sprout size={14} className="text-white" />
                </div>
              )}
              <div className={`max-w-[85%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.content && (
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${msg.role === "user"
                      ? "bg-primary text-white rounded-tr-sm shadow-[var(--shadow-sm)]"
                      : "bg-white border border-[var(--line)] text-[var(--ink)] rounded-tl-sm shadow-[var(--shadow-sm)]"}`}>
                    {msg.content}
                  </div>
                )}
                {msg.results && (
                  <div className="bg-white border border-[var(--line)] rounded-2xl rounded-tl-sm shadow-[var(--shadow-md)] p-4 space-y-2.5 w-full">
                    <p className="eyebrow">{msg.results.length} results found</p>
                    {msg.results.map((r, j) => (
                      <div key={j} className="rounded-xl border border-[var(--line)] bg-white p-3.5 transition-all hover:border-[var(--brand-light)] hover:shadow-[var(--shadow-md)]">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="min-w-0">
                            <span className="font-semibold text-[var(--ink)] text-[15px] leading-snug">{titleCaseDisease(r.disease_name)}</span>
                            {r.local_name && <span className="text-[var(--ink-soft)] text-xs ml-1.5 italic">{r.local_name}</span>}
                          </div>
                          <MyStatusBadge status={
                            r.professor_verdict === "PASS"   ? "MY_approved"   :
                            r.professor_verdict === "FLAG"   ? "MY_restricted" :
                            r.professor_verdict === "REJECT" ? "MY_banned"     : "unknown"
                          } />
                        </div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <PathogenBadge type={r.pathogen_category} />
                          <span className="text-xs font-medium text-[var(--ink-soft)] capitalize">{r.crop}</span>
                        </div>
                        <p className="text-[13px] leading-relaxed text-[var(--ink-soft)] line-clamp-2 mb-3">{cleanSymptoms(r.symptoms_summary)}</p>
                        <div className="pt-2.5 border-t border-[var(--line)]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)]">Match</span>
                          </div>
                          <ConfidenceBar value={r.relevance_score} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Sprout size={14} className="text-white" />
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

          {/* Quick suggestions on first load */}
          {messages.length === 1 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="eyebrow mb-1">Try a search</p>
              {QUICK.map((q, i) => (
                <button key={i} onClick={() => doSearch("", q)}
                  className="text-left bg-white border border-[var(--line)] hover:border-[var(--brand-light)] hover:bg-[#f3f8f4] rounded-xl px-4 py-2.5 text-sm text-[var(--ink-soft)] hover:text-[var(--brand-dark)] transition-all shadow-[var(--shadow-sm)]">
                  {q}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-[var(--line)] bg-white/80 backdrop-blur px-4 py-3 max-w-2xl mx-auto w-full shrink-0">
          <div className="flex gap-2 items-center">
            <select value={crop} onChange={e => setCrop(e.target.value)}
              className="input-shell px-3 py-2.5 text-sm text-[var(--ink)] focus:outline-none shrink-0 capitalize">
              <option value="">All crops</option>
              {CROPS.map(c => <option key={c} value={c}>{c.replace("_"," ")}</option>)}
            </select>
            <div className="input-shell flex-1 flex items-center gap-2 px-3 py-2.5">
              <Search size={15} className="text-[var(--ink-soft)] shrink-0" />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Describe symptom or disease name..."
                className="flex-1 text-sm outline-none bg-transparent placeholder:text-[var(--ink-soft)]"
              />
            </div>
            <button onClick={handleSend} disabled={loading || (!input.trim() && !crop)}
              className="btn-primary p-2.5 shrink-0">
              {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
