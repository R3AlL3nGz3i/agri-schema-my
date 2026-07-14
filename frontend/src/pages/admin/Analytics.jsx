import { useState } from "react";
import ReactApexChart from "react-apexcharts";
import AppLayout from "../../components/AppLayout";
import { Users, Search, TrendingUp, MapPin, Clock, Smartphone } from "lucide-react";

// ── Data ──────────────────────────────────────────────────

const WEEKLY_DATA = {
  "This Week": {
    categories: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    scan:   [42, 58, 51, 74, 63, 38, 31],
    search: [42, 54, 47, 69, 64, 38, 30],
  },
  "Last Week": {
    categories: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    scan:   [38, 49, 44, 61, 55, 32, 27],
    search: [35, 47, 40, 58, 52, 29, 24],
  },
};

const MONTHLY_DATA = {
  "2024": {
    categories: ["Jan","Feb","Mar","Apr","May","Jun"],
    scan:   [84, 112, 98, 143, 127, 156],
    search: [76, 98,  87, 121, 108, 134],
  },
  "2023": {
    categories: ["Jan","Feb","Mar","Apr","May","Jun"],
    scan:   [61, 78, 72, 95, 88, 104],
    search: [54, 68, 65, 84, 79, 91],
  },
};

const CROP_QUERIES = {
  "All Time": [
    { crop: "Paddy",    queries: 312 },
    { crop: "Chilli",   queries: 248 },
    { crop: "Banana",   queries: 197 },
    { crop: "Tomato",   queries: 164 },
    { crop: "Oil Palm", queries: 138 },
    { crop: "Durian",   queries: 112 },
    { crop: "Rubber",   queries: 87  },
    { crop: "Cocoa",    queries: 66  },
  ],
  "This Month": [
    { crop: "Paddy",    queries: 58 },
    { crop: "Chilli",   queries: 44 },
    { crop: "Banana",   queries: 37 },
    { crop: "Tomato",   queries: 31 },
    { crop: "Oil Palm", queries: 24 },
    { crop: "Durian",   queries: 19 },
    { crop: "Rubber",   queries: 14 },
    { crop: "Cocoa",    queries: 11 },
  ],
};

const STATE_QUERIES = {
  "All Time": [
    { state: "Kedah",    queries: 218 },
    { state: "Kelantan", queries: 187 },
    { state: "Johor",    queries: 164 },
    { state: "Perak",    queries: 143 },
    { state: "Pahang",   queries: 121 },
    { state: "Sabah",    queries: 98  },
    { state: "Sarawak",  queries: 87  },
    { state: "Selangor", queries: 76  },
  ],
  "This Month": [
    { state: "Kedah",    queries: 42 },
    { state: "Johor",    queries: 38 },
    { state: "Kelantan", queries: 34 },
    { state: "Perak",    queries: 28 },
    { state: "Pahang",   queries: 22 },
    { state: "Sabah",    queries: 18 },
    { state: "Selangor", queries: 15 },
    { state: "Sarawak",  queries: 12 },
  ],
};

const TOP_QUERIES = [
  { query: "Paddy leaf spot",       count: 142, trend: "+12%" },
  { query: "Chilli wilt",           count: 118, trend: "+8%"  },
  { query: "Banana yellowing",      count: 97,  trend: "+21%" },
  { query: "Durian fruit rot",      count: 84,  trend: "+5%"  },
  { query: "Tomato late blight",    count: 76,  trend: "+3%"  },
  { query: "Oil palm leaf disease", count: 63,  trend: "+9%"  },
  { query: "Rubber powdery mildew", count: 51,  trend: "-2%"  },
  { query: "Cocoa pod rot",         count: 38,  trend: "+14%" },
];

// ── Shared chart defaults ─────────────────────────────────

const baseBar = (categories) => ({
  chart:       { toolbar: { show: false }, zoom: { enabled: false } },
  xaxis:       { categories, labels: { style: { fontSize: "11px", colors: "#9ca3af" } }, axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis:       { labels: { style: { fontSize: "11px", colors: "#9ca3af" } } },
  grid:        { borderColor: "#f3f4f6", strokeDashArray: 4 },
  tooltip:     { theme: "light" },
  dataLabels:  { enabled: false },
  legend:      { position: "bottom", fontSize: "11px", markers: { size: 6 } },
  plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
});

const baseHBar = (categories) => ({
  chart:       { toolbar: { show: false } },
  xaxis:       { labels: { style: { fontSize: "11px", colors: "#9ca3af" } } },
  yaxis:       { categories, labels: { style: { fontSize: "11px", colors: "#6b7280" } } },
  grid:        { borderColor: "#f3f4f6", strokeDashArray: 4 },
  tooltip:     { theme: "light" },
  dataLabels:  { enabled: false },
  plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: "60%" } },
  legend:      { show: false },
});

// ── Filter pill component ─────────────────────────────────

function FilterPills({ options, value, onChange }) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
            ${value === o ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────

export default function Analytics() {
  const [volumePeriod,  setVolumePeriod]  = useState("This Week");
  const [volumeView,    setVolumeView]    = useState("weekly");   // weekly | monthly
  const [cropPeriod,    setCropPeriod]    = useState("All Time");
  const [statePeriod,   setStatePeriod]   = useState("All Time");

  const volumeData   = volumeView === "weekly" ? WEEKLY_DATA[volumePeriod]  : MONTHLY_DATA[volumePeriod === "This Week" ? "2024" : "2023"];
  const cropData     = CROP_QUERIES[cropPeriod];
  const stateData    = STATE_QUERIES[statePeriod];
  const totalQueries = TOP_QUERIES.reduce((s, q) => s + q.count, 0);

  // Volume chart
  const volumeOptions = {
    ...baseBar(volumeData.categories),
    colors: ["#1a6b3c", "#86efac"],
  };
  const volumeSeries = [
    { name: "Scan (Photo)", data: volumeData.scan   },
    { name: "Search",       data: volumeData.search },
  ];

  // Crop horizontal bar
  const cropOptions = {
    ...baseHBar(cropData.map(c => c.crop)),
    colors: ["#1a6b3c"],
  };
  const cropSeries = [{ name: "Queries", data: cropData.map(c => c.queries) }];

  // State horizontal bar
  const stateOptions = {
    ...baseHBar(stateData.map(s => s.state)),
    colors: ["#3b82f6"],
  };
  const stateSeries = [{ name: "Queries", data: stateData.map(s => s.queries) }];

  // Donut — diagnosis outcome
  const donutOptions = {
    chart:   { toolbar: { show: false } },
    labels:  ["Disease Identified", "Partial Match", "No Match"],
    colors:  ["#22c55e", "#facc15", "#d1d5db"],
    legend:  { position: "bottom", fontSize: "11px" },
    tooltip: { theme: "light" },
    dataLabels: { style: { fontSize: "12px" } },
    plotOptions: { pie: { donut: { size: "65%", labels: { show: true, total: { show: true, label: "Success", color: "#1a6b3c", fontSize: "13px", fontWeight: 700 } } } } },
  };
  const donutSeries = [74, 18, 8];

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Query Analytics</h2>
            <p className="text-sm text-gray-400 mt-0.5">Real-world usage insights from farmers using AgriScheme</p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full">
            <Smartphone size={13} className="text-blue-500" />
            <span className="text-xs text-blue-700 font-medium">Live data</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Queries",      value: "1,324", delta: "+18% this week",     icon: Search,    color: "text-primary",    bg: "bg-primary/10" },
            { label: "Unique Farmers",     value: "487",   delta: "+31 new this week",  icon: Users,     color: "text-blue-500",   bg: "bg-blue-50"    },
            { label: "Avg. Daily Queries", value: "101",   delta: "Peak: Thu 143",      icon: TrendingUp,color: "text-purple-500", bg: "bg-purple-50"  },
            { label: "Diagnosis Rate",     value: "74%",   delta: "Disease identified", icon: Clock,     color: "text-green-500",  bg: "bg-green-50"   },
          ].map(({ label, value, delta, icon: Icon, color, bg }) => (
            <div key={label} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon size={17} className={color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">{value}</p>
              <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{delta}</p>
            </div>
          ))}
        </div>

        {/* Row 2: Query volume chart + Diagnosis donut */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h3 className="font-semibold text-gray-700">Query Volume</h3>
              <div className="flex gap-2 flex-wrap">
                <FilterPills
                  options={["weekly","monthly"]}
                  value={volumeView}
                  onChange={v => { setVolumeView(v); setVolumePeriod(v === "weekly" ? "This Week" : "2024"); }}
                />
                <FilterPills
                  options={volumeView === "weekly" ? ["This Week","Last Week"] : ["2024","2023"]}
                  value={volumePeriod}
                  onChange={setVolumePeriod}
                />
              </div>
            </div>
            <ReactApexChart type="bar" height={200} series={volumeSeries} options={volumeOptions} />
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-2">Diagnosis Outcome</h3>
            <ReactApexChart type="donut" height={220} series={donutSeries} options={donutOptions} />
            <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-100">
              <p className="text-xs text-green-700 font-medium">74% success rate</p>
              <p className="text-xs text-green-600 mt-0.5">Farmers received a matched disease diagnosis.</p>
            </div>
          </div>
        </div>

        {/* Row 3: Queries by crop + by state */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h3 className="font-semibold text-gray-700">Queries by Crop</h3>
              <FilterPills options={["All Time","This Month"]} value={cropPeriod} onChange={setCropPeriod} />
            </div>
            <ReactApexChart type="bar" height={220} series={cropSeries} options={cropOptions} />
          </div>

          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-primary" />
                <h3 className="font-semibold text-gray-700">Queries by State</h3>
              </div>
              <FilterPills options={["All Time","This Month"]} value={statePeriod} onChange={setStatePeriod} />
            </div>
            <ReactApexChart type="bar" height={220} series={stateSeries} options={stateOptions} />
          </div>
        </div>

        {/* Row 4: Top search queries table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search size={15} className="text-primary" />
              <h3 className="font-semibold text-gray-700">Top Farmer Search Queries</h3>
            </div>
            <span className="text-xs text-gray-400">{totalQueries} total searches</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["#","Query","Searches","Trend","Share"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {TOP_QUERIES.map(({ query, count, trend }, i) => (
                <tr key={query} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-gray-800 capitalize">{query}</td>
                  <td className="px-5 py-3 text-sm font-bold text-gray-700">{count}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${trend.startsWith("+") ? "text-green-500" : "text-red-400"}`}>
                      {trend}
                    </span>
                  </td>
                  <td className="px-5 py-3 w-36">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-400 h-1.5 rounded-full"
                          style={{ width: `${(count / TOP_QUERIES[0].count) * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-8">
                        {Math.round((count / totalQueries) * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </AppLayout>
  );
}
