export function MyStatusBadge({ status }) {
  const map = {
    MY_approved:   { cls: "badge-approved",   label: "MY Approved" },
    MY_restricted: { cls: "badge-restricted", label: "MY Restricted" },
    MY_banned:     { cls: "badge-banned",      label: "MY Banned" },
    unknown:       { cls: "badge-unknown",     label: "Unknown" },
  };
  const { cls, label } = map[status] || map.unknown;
  return <span className={cls}>{label}</span>;
}

export function PathogenBadge({ type }) {
  const cls = `badge-${type?.toLowerCase()}` || "badge-unknown";
  return <span className={cls}>{type || "unknown"}</span>;
}

export function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8">{pct}%</span>
    </div>
  );
}
