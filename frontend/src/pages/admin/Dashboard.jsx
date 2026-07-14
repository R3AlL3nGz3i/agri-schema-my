import { useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import AppLayout from "../../components/AppLayout";
import { getStats } from "../../api";
import {
  FileText, Clock, AlertTriangle, CheckCircle,
  TrendingUp, Database, ArrowUpRight, ShieldCheck,
} from "lucide-react";

const MOCK_ACTIVITY = [
  { action: "Paper approved",    detail: "Rice blast — Magnaporthe oryzae",      time: "2 min ago",  color: "bg-green-500" },
  { action: "New paper ingested",detail: "Chilli anthracnose — Colletotrichum",  time: "18 min ago", color: "bg-blue-500"  },
  { action: "MY Banned flagged", detail: "Chlorpyrifos detected in treatment",   time: "1 hr ago",   color: "bg-red-500"   },
  { action: "Paper rejected",    detail: "Insufficient evidence — Durian canker",time: "3 hr ago",   color: "bg-gray-400"  },
  { action: "Paper approved",    detail: "Banana fusarium wilt — FOC TR4",       time: "5 hr ago",   color: "bg-green-500" },
  { action: "New paper ingested",detail: "Oil palm Ganoderma BSR — G. boninense",time: "7 hr ago",   color: "bg-blue-500"  },
];

const MONTHLY = [
  { month: "Jan", papers: 18, approved: 14 },
  { month: "Feb", papers: 24, approved: 19 },
  { month: "Mar", papers: 31, approved: 26 },
  { month: "Apr", papers: 22, approved: 17 },
  { month: "May", papers: 38, approved: 31 },
  { month: "Jun", papers: 42, approved: 35 },
];

const CROP_DATA = [
  { name: "Paddy",    pct: 92, papers: 98  },
  { name: "Chilli",   pct: 85, papers: 74  },
  { name: "Banana",   pct: 78, papers: 61  },
  { name: "Tomato",   pct: 71, papers: 53  },
  { name: "Oil Palm", pct: 65, papers: 44  },
  { name: "Durian",   pct: 54, papers: 32  },
  { name: "Rubber",   pct: 48, papers: 27  },
  { name: "Cocoa",    pct: 32, papers: 18  },
];

const PATHOGENS = [
  { type: "Fungi",     count: 98,  color: "bg-amber-400",  badge: "badge-fungi"    },
  { type: "Bacteria",  count: 54,  color: "bg-blue-400",   badge: "badge-bacteria" },
  { type: "Virus",     count: 41,  color: "bg-purple-400", badge: "badge-virus"    },
  { type: "Pest",      count: 37,  color: "bg-red-400",    badge: "badge-pest"     },
  { type: "Nematode",  count: 22,  color: "bg-pink-400",   badge: "badge-nematode" },
  { type: "Abiotic",   count: 18,  color: "bg-sky-400",    badge: "badge-abiotic"  },
  { type: "Oomycete",  count: 14,  color: "bg-teal-400",   badge: "badge-oomycete" },
];

const TOP_DISEASES = [
  { name: "Rice Blast",            crop: "Paddy",    pathogen: "Fungi",    papers: 38, my: "MY_approved",   pct: 92 },
  { name: "Anthracnose",           crop: "Chilli",   pathogen: "Fungi",    papers: 31, my: "MY_approved",   pct: 85 },
  { name: "Fusarium Wilt (TR4)",   crop: "Banana",   pathogen: "Fungi",    papers: 27, my: "unknown",       pct: 78 },
  { name: "Ganoderma BSR",         crop: "Oil Palm", pathogen: "Fungi",    papers: 24, my: "MY_restricted", pct: 71 },
  { name: "Phytophthora Root Rot", crop: "Durian",   pathogen: "Oomycete", papers: 19, my: "MY_restricted", pct: 58 },
  { name: "Sheath Blight",         crop: "Paddy",    pathogen: "Fungi",    papers: 17, my: "MY_approved",   pct: 52 },
  { name: "Bacterial Leaf Blight", crop: "Paddy",    pathogen: "Bacteria", papers: 14, my: "MY_approved",   pct: 44 },
];

const MY_STATUS = [
  { label: "MY Approved",   count: 198, cls: "badge-approved",   bar: "bg-green-400",  pct: 70 },
  { label: "MY Restricted", count: 43,  cls: "badge-restricted", bar: "bg-orange-400", pct: 15 },
  { label: "MY Banned",     count: 12,  cls: "badge-banned",     bar: "bg-red-400",    pct: 4  },
  { label: "Unknown",       count: 31,  cls: "badge-unknown",    bar: "bg-gray-300",   pct: 11 },
];

const totalPathogens = PATHOGENS.reduce((s, p) => s + p.count, 0);

const MY_BADGE = {
  MY_approved:   "badge-approved",
  MY_restricted: "badge-restricted",
  MY_banned:     "badge-banned",
  unknown:       "badge-unknown",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const statCards = [
    { label: "Papers Collected", value: stats?.total_entries ?? 284, delta: "+42 this month",   icon: FileText,      color: "text-primary",      bg: "bg-primary/10"    },
    { label: "Pending Review",   value: stats?.professor_flag ?? 18, delta: "Needs attention",  icon: Clock,         color: "text-yellow-500",   bg: "bg-yellow-50"     },
    { label: "MY Banned Alerts", value: stats?.professor_reject ?? 5,delta: "Flagged by AI",    icon: AlertTriangle, color: "text-red-500",      bg: "bg-red-50"        },
    { label: "Schema Valid",     value: stats?.schema_valid ?? 261,  delta: "92% pass rate",    icon: CheckCircle,   color: "text-green-500",    bg: "bg-green-50"      },
    { label: "Crops Covered",    value: stats?.crops_total ?? 8,     delta: "8 Malaysian crops", icon: Database,      color: "text-purple-500",   bg: "bg-purple-50"     },
    { label: "Ingested (Jun)",   value: 42,                          delta: "+11% vs May",       icon: TrendingUp,    color: "text-blue-500",     bg: "bg-blue-50"       },
  ];

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Knowledge Base Dashboard</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Scholarly evidence mining · Malaysia regulatory validation · Real-time overview
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-700 font-medium">Pipeline active</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map(({ label, value, delta, icon: Icon, color, bg }) => (
            <div key={label} className="card flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon size={17} className={color} />
                </div>
                <ArrowUpRight size={14} className="text-gray-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{delta}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: Monthly chart + MY Status + Activity */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Monthly ingestion chart — ApexCharts */}
          <div className="card lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-700">Monthly Ingestion</h3>
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
              {MY_STATUS.map(({ label, count, cls, bar, pct }) => (
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
            <h3 className="font-semibold text-gray-700 mb-4">Recent Activity</h3>
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
              <span className="text-xs text-gray-400">8 crops · 284 papers</span>
            </div>
            <div className="space-y-3">
              {CROP_DATA.map(({ name, pct, papers }) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-gray-500 shrink-0">{name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-14 text-right">{papers} papers</span>
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
              {PATHOGENS.map(({ type, count, color, badge }) => (
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
            <h3 className="font-semibold text-gray-700">Most Researched Diseases</h3>
            <span className="text-xs text-gray-400">Ranked by paper count</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["#","Disease","Crop","Pathogen","Papers","MY Status","Coverage"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {TOP_DISEASES.map(({ name, crop, pathogen, papers, my, pct }, i) => (
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
