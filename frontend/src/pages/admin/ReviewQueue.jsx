import { useState, useEffect, Fragment } from "react";
import AppLayout from "../../components/AppLayout";
import { MyStatusBadge, PathogenBadge, ConfidenceBar } from "../../components/Badges";
import { getReviews } from "../../api";
import { CheckCircle, XCircle, Edit3, ChevronDown, ChevronUp, AlertTriangle, Clock, Loader } from "lucide-react";

export default function ReviewQueue() {
  const [queue, setQueue]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter]     = useState("all"); // all | pending | approved | flagged

  useEffect(() => {
    getReviews()
      .then(r => setQueue(r.data))
      .catch(() => setError("Could not load review queue. Is the API running on :8000?"))
      .finally(() => setLoading(false));
  }, []);

  const handleDecision = (id, decision) => {
    setQueue(prev => prev.map(p =>
      p.id === id ? { ...p, decision } : p
    ));
    setExpanded(null);
  };

  const filtered = queue.filter(p => {
    if (filter === "approved") return p.decision === "approve";
    if (filter === "rejected") return p.decision === "reject";
    if (filter === "pending")  return !p.decision;
    return true;
  });

  const pending  = queue.filter(p => !p.decision).length;
  const approved = queue.filter(p => p.decision === "approve").length;
  const rejected = queue.filter(p => p.decision === "reject").length;

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Review Queue</h2>
            <p className="text-sm text-gray-400 mt-0.5">Human-in-the-loop validation for scholarly evidence</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="badge-unknown">{pending} pending</span>
            <span className="badge-approved">{approved} approved</span>
            <span className="badge-banned">{rejected} rejected</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: "all",      label: `All (${queue.length})` },
            { key: "pending",  label: `Pending (${pending})` },
            { key: "approved", label: `Approved (${approved})` },
            { key: "rejected", label: `Rejected (${rejected})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${filter === key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Loading / error */}
        {loading && (
          <div className="card flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
            <Loader size={16} className="animate-spin" /> Loading professor reviews…
          </div>
        )}
        {error && !loading && (
          <div className="card flex items-center justify-center gap-2 py-12 text-red-500 text-sm">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paper</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Crop / Disease</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">MY Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Confidence</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Decision</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(paper => (
                <Fragment key={paper.id}>
                  <tr
                    className={`hover:bg-gray-50 transition-colors
                      ${paper.decision === "approve" ? "bg-green-50/40" : ""}
                      ${paper.decision === "reject"  ? "bg-red-50/40"   : ""}`}>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-gray-800 line-clamp-2 text-xs leading-relaxed">{paper.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{paper.authors[0] ?? paper.reviewed_by ?? "Unknown"} · {paper.year ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-700 capitalize">{paper.crop}</p>
                      <p className="text-xs text-gray-400 capitalize">{paper.disease_display}</p>
                    </td>
                    <td className="px-4 py-3">
                      <PathogenBadge type={paper.pathogen_category} />
                    </td>
                    <td className="px-4 py-3">
                      <MyStatusBadge status={paper.my_status} />
                    </td>
                    <td className="px-4 py-3 w-28">
                      <ConfidenceBar value={paper.confidence.my_status} />
                      <p className="text-xs text-gray-400 mt-0.5">{Math.round(paper.confidence.my_status * 100)}%</p>
                    </td>
                    <td className="px-4 py-3">
                      {paper.decision ? (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full
                          ${paper.decision === "approve" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {paper.decision === "approve" ? "✓ Approved" : "✗ Rejected"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-yellow-600">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(expanded === paper.id ? null : paper.id)}
                        className="text-gray-400 hover:text-primary transition-colors"
                      >
                        {expanded === paper.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded review card */}
                  {expanded === paper.id && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50 border-t border-gray-100">
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Left — paper details */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Paper Details</p>
                              <p className="text-sm font-medium text-gray-800">{paper.title}</p>
                              <p className="text-xs text-gray-500 mt-1">{paper.authors.join(", ")} · {paper.publisher} · {paper.year}</p>
                              <p className="text-xs text-blue-500 mt-0.5">DOI: {paper.doi}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="bg-white rounded-lg p-2.5 border">
                                <p className="text-gray-400 mb-0.5">Detected Crop</p>
                                <p className="font-medium capitalize text-gray-700">{paper.crop}</p>
                                <ConfidenceBar value={paper.confidence.crop} />
                              </div>
                              <div className="bg-white rounded-lg p-2.5 border">
                                <p className="text-gray-400 mb-0.5">Pathogen Category</p>
                                <PathogenBadge type={paper.pathogen_category} />
                                <ConfidenceBar value={paper.confidence.pathogen} />
                              </div>
                              <div className="bg-white rounded-lg p-2.5 border">
                                <p className="text-gray-400 mb-0.5">Pathogen Name</p>
                                <p className="font-medium text-gray-700 italic text-xs">{paper.pathogen_name}</p>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 border">
                                <p className="text-gray-400 mb-0.5">Intervention</p>
                                <p className="font-medium text-gray-700 text-xs">{paper.intervention}</p>
                              </div>
                            </div>
                          </div>

                          {/* Right — validation */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Malaysia Validation</p>
                              <div className="bg-white rounded-lg p-3 border flex items-center justify-between">
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Active Ingredient</p>
                                  <p className="text-sm font-medium text-gray-700">{paper.active_ingredient ?? "None / Biological"}</p>
                                </div>
                                <MyStatusBadge status={paper.my_status} />
                              </div>
                              {paper.my_status === "MY_banned" && (
                                <div className="flex gap-2 mt-2 bg-red-50 border border-red-100 rounded-lg p-2.5">
                                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                  <p className="text-xs text-red-700">This active ingredient is banned in Malaysia. The paper is valid as research evidence but the recommendation must not be applied.</p>
                                </div>
                              )}
                              {paper.my_status === "MY_restricted" && (
                                <div className="flex gap-2 mt-2 bg-orange-50 border border-orange-100 rounded-lg p-2.5">
                                  <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                                  <p className="text-xs text-orange-700">Restricted use — requires DOA permit. Label the recommendation accordingly.</p>
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Evidence Snippets</p>
                              <div className="space-y-2">
                                {paper.snippets.map((s, i) => (
                                  <div key={i} className="bg-white border rounded-lg px-3 py-2 text-xs text-gray-600 italic">
                                    "{s}"
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Action buttons */}
                            {!paper.decision && (
                              <div className="flex gap-3 pt-1">
                                <button onClick={() => handleDecision(paper.id, "approve")}
                                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                                  <CheckCircle size={15} /> Approve
                                </button>
                                <button onClick={() => handleDecision(paper.id, "reject")}
                                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                                  <XCircle size={15} /> Reject
                                </button>
                                <button className="flex items-center justify-center gap-2 border border-gray-200 hover:border-primary text-gray-600 hover:text-primary px-4 py-2 rounded-lg text-sm transition-colors">
                                  <Edit3 size={15} /> Edit
                                </button>
                              </div>
                            )}
                            {paper.decision && (
                              <button onClick={() => handleDecision(paper.id, null)}
                                className="text-xs text-gray-400 hover:text-gray-600 underline">
                                Undo decision
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No reviews in this category.</p>
            </div>
          )}
        </div>
        )}
      </div>
    </AppLayout>
  );
}
