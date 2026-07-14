import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import AppLayout from "../../components/AppLayout";
import { useApp } from "../../context/AppContext";
import { queryDisease } from "../../api";
import { MyStatusBadge, PathogenBadge, ConfidenceBar } from "../../components/Badges";
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
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"}`}>
                    {msg.content}
                  </div>
                )}
                {msg.results && (
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm p-4 space-y-3 w-full">
                    <p className="text-xs text-gray-400">{msg.results.length} results found</p>
                    {msg.results.map((r, j) => (
                      <div key={j} className="border border-gray-100 rounded-xl p-3 hover:border-primary/30 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <span className="font-semibold text-gray-800 text-sm">{r.disease_name}</span>
                            {r.local_name && <span className="text-gray-400 text-xs ml-1">({r.local_name})</span>}
                          </div>
                          <MyStatusBadge status={
                            r.professor_verdict === "PASS"   ? "MY_approved"   :
                            r.professor_verdict === "FLAG"   ? "MY_restricted" :
                            r.professor_verdict === "REJECT" ? "MY_banned"     : "unknown"
                          } />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <PathogenBadge type={r.pathogen_category} />
                          <span className="text-xs text-gray-400 capitalize">{r.crop}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{r.symptoms_summary}</p>
                        <ConfidenceBar value={r.relevance_score} />
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
              {QUICK.map((q, i) => (
                <button key={i} onClick={() => doSearch("", q)}
                  className="text-left bg-white border border-gray-100 hover:border-primary rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:text-primary transition-colors">
                  {q}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="border-t bg-white px-4 py-3 max-w-2xl mx-auto w-full shrink-0">
          <div className="flex gap-2 items-center">
            <select value={crop} onChange={e => setCrop(e.target.value)}
              className="border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50 shrink-0">
              <option value="">All crops</option>
              {CROPS.map(c => <option key={c} value={c}>{c.replace("_"," ")}</option>)}
            </select>
            <div className="flex-1 flex items-center gap-2 border rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary bg-white">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Describe symptom or disease name..."
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <button onClick={handleSend} disabled={loading || (!input.trim() && !crop)}
              className="bg-primary hover:bg-primary-dark text-white p-2.5 rounded-xl transition-colors disabled:opacity-40 shrink-0">
              {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
