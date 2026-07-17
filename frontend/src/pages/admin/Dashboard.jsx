import { useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import AppLayout from "../../components/AppLayout";
import { getStats, getAggregates } from "../../api";
import {
  FileText, Clock, AlertTriangle, CheckCircle,
  Database, ArrowUpRight, ShieldCheck,
} from "lucide-react";

const MOCK_ACTIVITY = [
  { action: "Entry approved",    detail: "Rice blast — Magnaporthe oryzae",      time: "2 min ago",  color: "bg-green-500" },
  { action: "New entry ingested",detail: "Chilli anthracnose — Colletotrichum",  time: "18 min ago", color: "bg-blue-500"  },
  { action: "MY Banned flagged", detail: "Chlorpyrifos detected in treatment",   time: "1 hr ago",   color: "bg-red-500"   },
  { action: "Entry rejected",    detail: "Insufficient evidence — Durian canker",time: "3 hr ago",   color: "bg-gray-400"  },
  { action: "Entry approved",    detail: "Banana fusarium wilt — FOC TR4",       time: "5 hr ago",   color: "bg-green-500" },
  { action: "New entry ingested",detail: "Oil palm Ganoderma BSR — G. boninense",time: "7 hr ago",   color: "bg-blue-500"  },
];

const MONTHLY = [
  { month: "Jan", papers: 18, approved: 14 },
  { month: "Feb", papers: 24, approved: 19 },
  { month: "Mar", papers: 31, approved: 26 },
  { month: "Apr", papers: 22, approved: 17 },
  { month: "May", papers: 38, approved: 31 },
  { month: "Jun", papers: 42, approved: 35 },
];

// Presentation styles keyed by the raw values returned from /aggregates.
const PATHOGEN_STYLE = {
  fungi:    { color: "bg-amber-400",  badge: "badge-fungi"    },
  bacteria: { color: "bg-blue-400",   badge: "badge-bacteria" },
  virus:    { color: "bg-purple-400", badge: "badge-virus"    },
  pest:     { color: "bg-red-400",    badge: "badge-pest"     },
  nematode: { color: "bg-pink-400",   badge: "badge-nematode" },
  abiotic:  { color: "bg-sky-400",    badge: "badge-abiotic"  },
  oomycete: { color: "bg-teal-400",   badge: "badge-oomycete" },
};

const STATUS_STYLE = {
  MY_approved:   { label: "MY Approved",   cls: "badge-approved",   bar: "bg-green-400"  },
  MY_restricted: { label: "MY Restricted", cls: "badge-restricted", bar: "bg-orange-400" },
  MY_banned:     { label: "MY Banned",     cls: "badge-banned",     bar: "bg-red-400"    },
  unknown:       { label: "Unknown",       cls: "badge-unknown",    bar: "bg-gray-300"   },
};

const cap = (s) => (s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const MY_BADGE = {
  MY_approved:   "badge-approved",
  MY_restricted: "badge-restricted",
  MY_banned:     "badge-banned",
  unknown:       "badge-unknown",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [agg, setAgg]     = useState(null);

  useEffect(() => {
    getStats().then(r => setStats(r.data)).catch(() => {});
    getAggregates().then(r => setAgg(r.data)).catch(() => {});
  }, []);

  // ── Derived from /aggregates (real knowledge-base counts) ──
  const pathogens = (agg?.pathogen_breakdown || []).map(p => ({
    type: cap(p.type),
    count: p.count,
    ...(PATHOGEN_STYLE[p.type] || { color: "bg-gray-300", badge: "badge-unknown" }),
  }));
  const totalPathogens = pathogens.reduce((s, p) => s + p.count, 0) || 1;

  const statusTotal = (agg?.regulatory_status || []).reduce((s, r) => s + r.count, 0) || 1;
  const myStatus = (agg?.regulatory_status || []).map(r => ({
    count: r.count,
    pct: Math.round((r.count / statusTotal) * 100),
    ...(STATUS_STYLE[r.status] || { label: cap(r.status), cls: "badge-unknown", bar: "bg-gray-300" }),
  }));

  const cropMax = Math.max(1, ...(agg?.crop_coverage || []).map(c => c.diseases));
  const cropData = (agg?.crop_coverage || []).map(c => ({
    name: cap(c.crop),
    papers: c.diseases,
    pct: Math.round((c.diseases / cropMax) * 100),
  }));
  const totalEntries = (agg?.crop_coverage || []).reduce((s, c) => s + c.diseases, 0);

  const topDiseases = [...(agg?.diseases || [])]
    .filter(d => d.confidence_score != null)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 7)
    .map(d => ({
      name: cap(d.name),
      crop: cap(d.crop),
      pathogen: cap(d.pathogen_type),
      papers: d.treatments ?? 0,
      my: d.my_status || "unknown",
      pct: Math.round((d.confidence_score || 0) * 100),
    }));

  const statCards = [
    { label: "KB Entries",       value: stats?.total_entries ?? "—",   delta: `${stats?.professor_pass ?? 0} professor-passed`, icon: FileText,      color: "text-primary",    bg: "bg-primary/10"  },
    { label: "Pending Review",   value: stats?.professor_flag ?? "—",  delta: "Flagged for review",   icon: Clock,         color: "text-yellow-500", bg: "bg-yellow-50"   },
    { label: "MY Banned Alerts", value: stats?.professor_reject ?? "—",delta: "Rejected entries",     icon: AlertTriangle, color: "text-red-500",    bg: "bg-red-50"      },
    { label: "Schema Valid",     value: stats?.schema_valid ?? "—",    delta: `${stats?.schema_errors ?? 0} schema errors`, icon: CheckCircle,   color: "text-green-500",  bg: "bg-green-50"    },
    { label: "Crops Covered",    value: stats?.crops_total ?? "—",     delta: "Malaysian crops",      icon: Database,      color: "text-purple-500", bg: "bg-purple-50"   },
  ];

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow mb-1">Knowledge Base</p>
            <h2 className="text-2xl font-bold text-[var(--ink)]">Dashboard</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-1">
              Scholarly evidence mining · Malaysia regulatory validation · Real-time overview
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-700 font-semibold">Pipeline active</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {statCards.map(({ label, value, delta, icon: Icon, color, bg }) => (
            <div key={label} className="card card-hover flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-lg ${bg} ring-1 ring-black/5 flex items-center justify-center`}>
                  <Icon size={17} className={color} />
                </div>
                <ArrowUpRight size={14} className="text-[var(--line-strong)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--ink)] tabular-nums">{value}</p>
                <p className="text-xs font-semibold text-[var(--ink-soft)] mt-0.5">{label}</p>
                <p className="text-xs text-[var(--ink-soft)] opacity-70 mt-0.5">{delta}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: Monthly chart + MY Status + Activity */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Monthly ingestion chart — ApexCharts */}
          <div className="card lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700">Monthly Ingestion <span className="text-xs font-normal text-gray-400">(Sample)</span></h3>
              <span className="text-xs text-gray-400">Jan – Jun 2024</span>
            </div>
            <ReactApexChart
              type="bar"
              height={160}
              series={[
                { name: "Approved", data: MONTHLY.map(m => m.approved) },
                { name: "Ingested", data: MONTHLY.map(m => m.papers - m.approved) },
              ]}
              options={{
                chart: { stacked: true, toolbar: { show: false }, sparkline: { enabled: false } },
                colors: ["#1a6b3c", "#d1fae5"],
                plotOptions: { bar: { borderRadius: 3, columnWidth: "55%" } },
                xaxis: { categories: MONTHLY.map(m => m.month), labels: { style: { fontSize: "11px", colors: "#9ca3af" } }, axisBorder: { show: false }, axisTicks: { show: false } },
                yaxis: { labels: { style: { fontSize: "11px", colors: "#9ca3af" } } },
                legend: { position: "bottom", fontSize: "11px", markers: { size: 6 } },
                grid: { borderColor: "#f3f4f6", strokeDashArray: 4 },
                tooltip: { theme: "light" },
                dataLabels: { enabled: false },
              }}
            />
          </div>

          {/* MY Regulatory Status */}
          <div className="card lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={16} className="text-primary" />
              <h3 className="font-semibold text-gray-700">Malaysia Regulatory Status</h3>
            </div>
            <div className="space-y-3">
              {myStatus.map(({ label, count, cls, bar, pct }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cls}>{label}</span>
                    <span className="text-sm font-bold text-gray-700">{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`${bar} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 border-t pt-3">
              Based on DOA Malaysia · LRMP · MyPesticide cross-reference
            </p>
          </div>

          {/* Recent activity */}
          <div className="card lg:col-span-1">
            <h3 className="font-semibold text-gray-700 mb-4">Recent Activity <span className="text-xs font-normal text-gray-400">(Sample)</span></h3>
            <div className="space-y-3">
              {MOCK_ACTIVITY.map((a, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className={`w-2 h-2 rounded-full ${a.color} mt-1.5 shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700">{a.action}</p>
                    <p className="text-xs text-gray-400 truncate">{a.detail}</p>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Crop coverage + Pathogen breakdown */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Crop coverage */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Crop Coverage</h3>
              <span className="text-xs text-gray-400">{cropData.length} crops · {totalEntries} entries</span>
            </div>
            <div className="space-y-3">
              {cropData.map(({ name, pct, papers }) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-gray-500 shrink-0">{name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-16 text-right">{papers} entries</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pathogen breakdown */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Pathogen Breakdown</h3>
              <span className="text-xs text-gray-400">{totalPathogens} total entries</span>
            </div>
            <div className="space-y-3">
              {pathogens.map(({ type, count, color, badge }) => (
                <div key={type} className="flex items-center gap-3">
                  <span className={`${badge} w-16 text-center shrink-0`}>{type}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${(count / totalPathogens) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 4: Top diseases table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Highest-Confidence Diseases</h3>
            <span className="text-xs text-gray-400">Ranked by confidence score</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["#","Disease","Crop","Pathogen","Treatments","MY Status","Confidence"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topDiseases.map(({ name, crop, pathogen, papers, my, pct }, i) => (
                  <tr key={name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400 font-medium">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800 text-sm">{name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{crop}</td>
                    <td className="px-4 py-3"><span className={`badge-${pathogen.toLowerCase()}`}>{pathogen}</span></td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-700">{papers}</td>
                    <td className="px-4 py-3"><span className={MY_BADGE[my]}>{my.replace("_"," ")}</span></td>
                    <td className="px-4 py-3 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-7">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
