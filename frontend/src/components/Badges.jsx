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

const KNOWN_PATHOGENS = ["fungi","bacteria","virus","pest","nematode","abiotic","oomycete"];

export function PathogenBadge({ type }) {
  const key = type?.toLowerCase();
  const cls = KNOWN_PATHOGENS.includes(key) ? `badge-${key}` : "badge-unknown";
  return <span className={cls}>{type || "unknown"}</span>;
}

export function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  // Warm, semantic scale — high=brand green, mid=gold accent, low=muted red.
  const fill =
    pct >= 80 ? "linear-gradient(90deg, var(--brand-light), var(--brand))" :
    pct >= 60 ? "linear-gradient(90deg, var(--accent-light), var(--accent))" :
                "linear-gradient(90deg, #f0a99a, #e07a63)";
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full h-1.5 overflow-hidden"
        style={{ background: "var(--surface-sunk)" }}
      >
        <div
          className="h-1.5 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
      <span
        className="text-[11px] font-semibold tabular-nums w-9 text-right"
        style={{ color: "var(--ink-soft)" }}
      >
        {pct}%
      </span>
    </div>
  );
}
