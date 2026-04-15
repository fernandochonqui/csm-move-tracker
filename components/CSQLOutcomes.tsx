import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Trophy,
  XCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Filter,
  BarChart3,
  Search,
  Target,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  ExternalLink,
  Link,
  Phone,
  Zap,
  RefreshCw,
  Sparkles,
  Brain,
  Lightbulb,
  ArrowLeftRight,
  Undo2,
  Check,
  Users,
  ChevronRight,
  Star,
  Download,
  ArrowUp,
  ArrowDown,
  GitBranch,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCSQLOutcomes,
  useCSQLStageHistory,
  CSQLOutcome,
  CSQLSummary,
  StageAverage,
} from "../hooks/use-csql-outcomes";
import { useAnalyzeGongCalls } from "../hooks/use-gong-calls";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  LabelList,
  ComposedChart,
  Line,
} from "recharts";

interface CSQLOutcomesProps {
  onViewAssessment?: (assessmentId: number) => void;
}

const STAGE_ORDER = [
  "Discovery",
  "Value & Solution",
  "Validate",
  "Negotiate",
  "Closed Won",
  "Closed Lost",
];

const STAGE_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  "Discovery": { color: "#6366F1", bg: "#EEF2FF", icon: <Search className="w-3 h-3" /> },
  "Value & Solution": { color: "#8B5CF6", bg: "#F5F3FF", icon: <Target className="w-3 h-3" /> },
  "Validate": { color: "#3B82F6", bg: "#EFF6FF", icon: <CheckCircle className="w-3 h-3" /> },
  "Negotiate": { color: "#F59E0B", bg: "#FFFBEB", icon: <AlertCircle className="w-3 h-3" /> },
  "Closed Won": { color: "#248567", bg: "#E7F6EE", icon: <Trophy className="w-3 h-3" /> },
  "Closed Lost": { color: "#D9534F", bg: "#FFEAE7", icon: <XCircle className="w-3 h-3" /> },
};

const getStageConfig = (stage: string) => {
  return STAGE_CONFIG[stage] || { color: "#87B5A7", bg: "#F8F5F0", icon: <Clock className="w-3 h-3" /> };
};

const formatCurrency = (amount: number | null) => {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const c = getStageConfig(status);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.icon}
      {status}
    </span>
  );
};

const ScoreBadge: React.FC<{ score: number | null }> = ({ score }) => {
  if (score == null) return <span className="text-xs" style={{ color: "#B9CDC7" }}>—</span>;
  let bg = "#FFEAE7";
  let color = "#D9534F";
  if (score >= 16) { bg = "#E7F6EE"; color = "#248567"; }
  else if (score >= 12) { bg = "#FFF8E7"; color = "#B58A1B"; }
  else if (score >= 8) { bg = "#FFF0E7"; color = "#D97B1B"; }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: bg, color }}
    >
      {score}/20
    </span>
  );
};

const SummaryCards: React.FC<{ summary: CSQLSummary; priorWinRate?: number | null }> = ({ summary, priorWinRate }) => {
  const closedTotal = summary.closedWonCount + summary.closedLostCount;
  const winRateDelta = summary.winRate != null && priorWinRate != null ? summary.winRate - priorWinRate : null;
  const cards: { label: string; value: React.ReactNode; icon: React.ReactNode; color: string; bg: string; tooltip?: string }[] = [
    {
      label: "Total CSQLs",
      value: summary.totalCSQLs,
      icon: <BarChart3 className="w-5 h-5" />,
      color: "#248567",
      bg: "#E7F6EE",
      tooltip: `${summary.openCount} open · ${summary.closedWonCount} won · ${summary.closedLostCount} lost\n${summary.linkedCount} have a linked call score`,
    },
    {
      label: "Pipeline Value",
      value: formatCurrency(summary.totalPipeline),
      icon: <DollarSign className="w-5 h-5" />,
      color: "#4A5ABA",
      bg: "#EEF0FF",
      tooltip: `Total deal value across all ${summary.totalCSQLs} opportunities\nIncludes open, won & lost`,
    },
    {
      label: "Won Value",
      value: formatCurrency(summary.wonPipeline),
      icon: <Trophy className="w-5 h-5" />,
      color: "#248567",
      bg: "#E7F6EE",
      tooltip: `Total value from ${summary.closedWonCount} Closed Won opportunities`,
    },
    {
      label: "Win Rate",
      value: (
        <div className="flex flex-col items-center gap-0.5">
          <span>{summary.winRate != null ? `${summary.winRate}%` : "—"}</span>
          {winRateDelta != null && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: winRateDelta >= 0 ? "#248567" : "#DC2626" }}>
              {winRateDelta >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
              {Math.abs(winRateDelta)} pts
            </span>
          )}
        </div>
      ),
      icon: <TrendingUp className="w-5 h-5" />,
      color: "#B58A1B",
      bg: "#FFF8E7",
      tooltip: summary.winRate != null
        ? `${summary.closedWonCount} won / ${closedTotal} closed\n(open deals not counted)`
        : `No closed deals yet\n(${summary.openCount} open)`,
    },
    {
      label: "Avg Score (Won)",
      value: summary.avgWonScore != null ? `${summary.avgWonScore}/20` : "—",
      icon: <Trophy className="w-5 h-5" />,
      color: "#248567",
      bg: "#E7F6EE",
      tooltip: summary.avgWonScore != null
        ? `Avg MOVE score for Closed Won deals\nwith a linked call analysis (max 20 pts)`
        : `No scored Closed Won deals yet`,
    },
    {
      label: "Avg Score (Lost)",
      value: summary.avgLostScore != null ? `${summary.avgLostScore}/20` : "—",
      icon: <XCircle className="w-5 h-5" />,
      color: "#D9534F",
      bg: "#FFEAE7",
      tooltip: summary.avgLostScore != null
        ? `Avg MOVE score for Closed Lost deals\nwith a linked call analysis (max 20 pts)`
        : `No scored Closed Lost deals yet`,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="relative group">
          <div
            className="rounded-xl p-4 text-center h-full"
            style={{ backgroundColor: card.bg }}
          >
            <div className="flex justify-center mb-2" style={{ color: card.color }}>
              {card.icon}
            </div>
            <div className="text-xl font-bold" style={{ color: card.color }}>
              {card.value}
            </div>
            <div className="text-[10px] font-semibold uppercase mt-1" style={{ color: card.color, opacity: 0.7 }}>
              {card.label}
            </div>
          </div>
          {card.tooltip && (
            <div
              className="absolute bottom-full left-1/2 mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              style={{ transform: "translateX(-50%)", minWidth: "160px" }}
            >
              <div
                className="rounded-lg px-3 py-2 text-xs text-center shadow-lg"
                style={{ backgroundColor: "#242424", color: "#fff", whiteSpace: "pre-line", lineHeight: "1.5" }}
              >
                {card.tooltip}
              </div>
              <div
                className="mx-auto mt-0"
                style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #242424" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const StageFunnel: React.FC<{ summary: CSQLSummary; csqls: CSQLOutcome[] }> = ({ summary, csqls }) => {
  const [expanded, setExpanded] = React.useState(false);
  const dist = summary.stageDistribution || {};
  const orderedStages = STAGE_ORDER.filter(s => dist[s]?.count > 0);
  const extraStages = Object.keys(dist).filter(s => !STAGE_ORDER.includes(s) && dist[s]?.count > 0).sort();
  const stages = [...orderedStages, ...extraStages];
  if (stages.length === 0) return null;

  const maxPipeline = Math.max(...stages.map(s => dist[s].pipeline || 0));
  const totalPipeline = stages.reduce((sum, s) => sum + (dist[s].pipeline || 0), 0);
  const totalScored = csqls.filter(c => c.linkedAssessment?.totalScore != null).length;
  const totalCSQLs = csqls.length;

  return (
    <div className="space-y-5">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4" style={{ color: "#242424" }} /> : <ChevronUp className="w-4 h-4" style={{ color: "#242424", transform: "rotate(90deg)" }} />}
          <h3 className="text-sm font-bold" style={{ color: "#242424" }}>
            Pipeline by Stage
          </h3>
          <span className="text-xs font-semibold" style={{ color: "#87B5A7" }}>
            {formatCurrency(totalPipeline)} total
          </span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "#EEF0FF", color: "#4A5ABA" }}>
          {totalScored}/{totalCSQLs} scored
        </span>
      </div>
      {expanded && (
        <div className="space-y-3">
          {stages.map(stage => {
            const config = getStageConfig(stage);
            const { count, pipeline } = dist[stage];
            const widthPct = maxPipeline > 0 ? Math.max((pipeline / maxPipeline) * 100, 20) : 20;
            const pctOfTotal = totalPipeline > 0 ? ((pipeline / totalPipeline) * 100).toFixed(0) : "0";
            const stageCSQLs = csqls.filter(c => c.stageName === stage);
            const scoredCSQLs = stageCSQLs.filter(c => c.linkedAssessment?.totalScore != null);
            const avgScore = scoredCSQLs.length > 0
              ? (scoredCSQLs.reduce((sum, c) => sum + (c.linkedAssessment?.totalScore || 0), 0) / scoredCSQLs.length).toFixed(1)
              : null;
            return (
              <div key={stage} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: config.bg, color: config.color }}>
                      {config.icon}
                    </div>
                    <span className="text-xs font-bold" style={{ color: config.color }}>{stage}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {avgScore && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F5F3FF", color: "#7C3AED" }}>
                        avg {avgScore}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold" style={{ color: "#87B5A7" }}>{pctOfTotal}%</span>
                  </div>
                </div>
                <div className="relative h-10 rounded-lg overflow-hidden" style={{ backgroundColor: "#F8F5F0" }}>
                  <div
                    className="h-full rounded-lg flex items-center justify-between px-3 transition-all duration-700 ease-out"
                    style={{ width: `${widthPct}%`, background: `linear-gradient(135deg, ${config.bg}, ${config.bg}dd)`, borderLeft: `3px solid ${config.color}` }}
                  >
                    <span className="text-xs font-bold whitespace-nowrap" style={{ color: config.color }}>
                      {formatCurrency(pipeline)}
                    </span>
                    <span className="text-[10px] whitespace-nowrap" style={{ color: config.color, opacity: 0.75 }}>
                      {count} deal{count !== 1 ? 's' : ''}
                      {scoredCSQLs.length > 0 && ` · ${scoredCSQLs.length} scored`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

type DealSizeBucket = "none" | "under_1k" | "1k_3k" | "3k_5k" | "5k_15k" | "15k_30k" | "over_30k";

function getDealSizeBucket(amount: number | null): DealSizeBucket {
  if (amount == null || amount === 0) return "none";
  if (amount < 1000) return "under_1k";
  if (amount < 3000) return "1k_3k";
  if (amount < 5000) return "3k_5k";
  if (amount < 15000) return "5k_15k";
  if (amount < 30000) return "15k_30k";
  return "over_30k";
}

const DEAL_SIZE_BUCKET_CONFIG: { key: DealSizeBucket; label: string }[] = [
  { key: "none", label: "No Amount" },
  { key: "under_1k", label: "<$1K" },
  { key: "1k_3k", label: "$1K–$3K" },
  { key: "3k_5k", label: "$3K–$5K" },
  { key: "5k_15k", label: "$5K–$15K" },
  { key: "15k_30k", label: "$15K–$30K" },
  { key: "over_30k", label: "$30K+" },
];

const DealSizeCorrelationChart: React.FC<{ csqls: CSQLOutcome[] }> = ({ csqls }) => {
  const chartData = DEAL_SIZE_BUCKET_CONFIG.map(({ key, label }) => {
    const bucket = csqls.filter(c => getDealSizeBucket(c.amount) === key);
    const withScore = bucket.filter(c => c.linkedAssessment?.totalScore != null);
    const closed = bucket.filter(c => c.closedStatus === "Closed Won" || c.closedStatus === "Closed Lost");
    const won = closed.filter(c => c.closedStatus === "Closed Won");
    const winRate = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : null;
    const avgScore = withScore.length > 0
      ? Math.round((withScore.reduce((s, c) => s + c.linkedAssessment!.totalScore!, 0) / withScore.length) * 10) / 10
      : null;
    return { label, key, count: bucket.length, closed: closed.length, won: won.length, winRate, avgScore };
  }).filter(d => d.count > 0);

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-40 text-sm" style={{ color: "#87B5A7" }}>No data available</div>;
  }

  const getBarColor = (winRate: number | null) => {
    if (winRate == null) return "#C5BAB0";
    if (winRate >= 50) return "#16a34a";
    if (winRate >= 25) return "#d97706";
    return "#dc2626";
  };

  return (
    <ResponsiveContainer width="100%" height={260} minHeight={200}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 40, bottom: 5, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#87B5A7" }} />
        <YAxis yAxisId="score" domain={[0, 20]} tick={{ fontSize: 11, fill: "#87B5A7" }} label={{ value: "Avg Score", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#87B5A7" } }} />
        <YAxis yAxisId="winRate" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: "#87B5A7" }} tickFormatter={v => v + "%"} label={{ value: "Win Rate", angle: 90, position: "insideRight", style: { fontSize: 10, fill: "#87B5A7" } }} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="rounded-lg shadow-lg p-3 text-xs" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                <div className="font-semibold mb-1" style={{ color: "#242424" }}>{d.label}</div>
                <div style={{ color: "#87B5A7" }}>{d.count} CSQLs</div>
                {d.avgScore != null && <div style={{ color: "#248567" }}>Avg MOVE Score: <span className="font-semibold">{d.avgScore}</span></div>}
                {d.winRate != null && <div style={{ color: "#7C3AED" }}>Win Rate: <span className="font-semibold">{d.winRate}%</span> ({d.won}/{d.closed} closed)</div>}
                {d.winRate == null && d.closed === 0 && <div style={{ color: "#C5BAB0" }}>No closed deals</div>}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="score" dataKey="avgScore" name="Avg MOVE Score" radius={[3, 3, 0, 0]} maxBarSize={60}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={getBarColor(d.winRate)} />
          ))}
          <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "#87B5A7" }} formatter={(v: number) => `n=${v}`} />
        </Bar>
        <Line yAxisId="winRate" dataKey="winRate" name="Win Rate %" stroke="#7C3AED" strokeWidth={2} dot={{ fill: "#7C3AED", r: 4 }} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

const ScoreOutcomeChart: React.FC<{ csqls: CSQLOutcome[] }> = ({ csqls }) => {
  const linked = csqls.filter(c => c.linkedAssessment?.totalScore != null && (c.closedStatus === "Closed Won" || c.closedStatus === "Closed Lost"));

  const scoreBuckets = [
    { range: "Very Low (1-4)", min: 1, max: 4 },
    { range: "Low (5-8)", min: 5, max: 8 },
    { range: "Medium (9-12)", min: 9, max: 12 },
    { range: "High (13-16)", min: 13, max: 16 },
    { range: "Very High (17-20)", min: 17, max: 20 },
  ];

  const chartData = scoreBuckets.map(bucket => {
    const inBucket = linked.filter(c => {
      const score = c.linkedAssessment!.totalScore!;
      return score >= bucket.min && score <= bucket.max;
    });
    const won = inBucket.filter(c => c.closedStatus === "Closed Won").length;
    const lost = inBucket.filter(c => c.closedStatus === "Closed Lost").length;
    const total = won + lost;
    return {
      range: bucket.range,
      won,
      lost,
      winRate: total > 0 ? Math.round((won / total) * 100) : 0,
      total,
    };
  });

  const wonScores = linked
    .filter(c => c.closedStatus === "Closed Won")
    .map(c => c.linkedAssessment!.totalScore!);
  const lostScores = linked
    .filter(c => c.closedStatus === "Closed Lost")
    .map(c => c.linkedAssessment!.totalScore!);
  const avgWon = wonScores.length ? Math.round((wonScores.reduce((a, b) => a + b, 0) / wonScores.length) * 10) / 10 : null;
  const avgLost = lostScores.length ? Math.round((lostScores.reduce((a, b) => a + b, 0) / lostScores.length) * 10) / 10 : null;

  const hasData = linked.length > 0;

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-bold" style={{ color: "#242424" }}>
        Score → Outcome Correlation
      </h3>

      {!hasData ? (
        <div className="text-center py-8 text-sm" style={{ color: "#B9CDC7" }}>
          Score more calls linked to closed deals to see correlation data.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "#E7F6EE" }}>
              <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: "#248567" }}>Avg Score (Won)</div>
              <div className="text-2xl font-bold" style={{ color: "#248567" }}>{avgWon != null ? avgWon : "—"}</div>
              <div className="text-[10px]" style={{ color: "#248567", opacity: 0.7 }}>{wonScores.length} deal{wonScores.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "#FFEAE7" }}>
              <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: "#D9534F" }}>Avg Score (Lost)</div>
              <div className="text-2xl font-bold" style={{ color: "#D9534F" }}>{avgLost != null ? avgLost : "—"}</div>
              <div className="text-[10px]" style={{ color: "#D9534F", opacity: 0.7 }}>{lostScores.length} deal{lostScores.length !== 1 ? "s" : ""}</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260} minWidth={200} minHeight={200}>
            <ComposedChart data={chartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 10, fill: "#87B5A7" }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "#87B5A7" }}
                allowDecimals={false}
                label={{ value: "Deals", angle: -90, position: "insideLeft", fontSize: 10, fill: "#87B5A7" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#4A5ABA" }}
                tickFormatter={(v: number) => `${v}%`}
                label={{ value: "Win Rate", angle: 90, position: "insideRight", fontSize: 10, fill: "#4A5ABA" }}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #EEE9E1", fontSize: "12px" }}
                formatter={(value: number, name: string) => {
                  if (name === "winRate") return [`${value}%`, "Win Rate"];
                  return [value, name === "won" ? "Closed Won" : "Closed Lost"];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value: string) => {
                  if (value === "won") return "Closed Won";
                  if (value === "lost") return "Closed Lost";
                  if (value === "winRate") return "Win Rate %";
                  return value;
                }}
              />
              <Bar yAxisId="left" dataKey="won" fill="#248567" name="won" radius={[4, 4, 0, 0]} stackId="deals">
                <LabelList dataKey="won" position="inside" fontSize={10} fill="#fff" formatter={(v: number) => v > 0 ? v : ""} />
              </Bar>
              <Bar yAxisId="left" dataKey="lost" fill="#D9534F" name="lost" radius={[4, 4, 0, 0]} stackId="deals">
                <LabelList dataKey="lost" position="inside" fontSize={10} fill="#fff" formatter={(v: number) => v > 0 ? v : ""} />
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="winRate" stroke="#4A5ABA" strokeWidth={2} dot={{ r: 5, fill: "#4A5ABA" }} name="winRate" />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
};

type TimeGranularity = "week" | "month" | "quarter";

const SCORE_RANGES = [
  { key: "low", label: "Low (1–8)", min: 1, max: 8, color: "#D9534F" },
  { key: "mid", label: "Mid (9–14)", min: 9, max: 14, color: "#F0AD4E" },
  { key: "high", label: "High (15–20)", min: 15, max: 20, color: "#248567" },
];

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return start;
}

function getPeriodKey(d: Date, granularity: TimeGranularity): string {
  if (granularity === "week") {
    const ws = getWeekStart(d);
    const m = String(ws.getMonth() + 1).padStart(2, "0");
    const day = String(ws.getDate()).padStart(2, "0");
    return `${ws.getFullYear()}-${m}-${day}`;
  } else if (granularity === "month") {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  } else {
    const month = d.getMonth();
    const q = Math.floor(month / 3) + 1;
    return `${d.getFullYear()}-Q${q}`;
  }
}

function formatPeriodLabel(key: string, granularity: TimeGranularity): string {
  if (granularity === "week") {
    const [y, m, d] = key.split("-");
    return `${m}/${d}`;
  } else if (granularity === "month") {
    const [y, m] = key.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  }
  const [y, q] = key.split("-");
  return `${q} ${y.slice(2)}`;
}

const WinRateOverTime: React.FC<{ csqls: CSQLOutcome[] }> = ({ csqls }) => {
  const [granularity, setGranularity] = useState<TimeGranularity>("month");

  const closed = csqls.filter(
    c => c.linkedAssessment?.totalScore != null && (c.closedStatus === "Closed Won" || c.closedStatus === "Closed Lost")
  );

  const chartData = useMemo(() => {
    const periodMap = new Map<string, Record<string, { won: number; total: number }>>();

    closed.forEach(c => {
      const dateStr = c.linkedAssessment?.callDate || c.createdDate;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const pk = getPeriodKey(d, granularity);
      const score = c.linkedAssessment!.totalScore!;
      const range = SCORE_RANGES.find(r => score >= r.min && score <= r.max);
      if (!range) return;

      if (!periodMap.has(pk)) {
        periodMap.set(pk, {});
      }
      const bucket = periodMap.get(pk)!;
      if (!bucket[range.key]) bucket[range.key] = { won: 0, total: 0 };
      bucket[range.key].total++;
      if (c.closedStatus === "Closed Won") bucket[range.key].won++;
    });

    const periods = Array.from(periodMap.keys()).sort();

    return periods.map(pk => {
      const bucket = periodMap.get(pk)!;
      const row: Record<string, any> = { period: formatPeriodLabel(pk, granularity), _sortKey: pk };
      SCORE_RANGES.forEach(r => {
        const b = bucket[r.key];
        row[r.key] = b && b.total > 0 ? Math.round((b.won / b.total) * 100) : null;
        row[`${r.key}Count`] = b ? b.total : 0;
      });
      return row;
    });
  }, [closed, granularity]);

  const hasData = chartData.length > 0 && chartData.some(d => d.low !== null || d.mid !== null || d.high !== null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: "#242424" }}>
          Win Rate by Score Range Over Time
        </h3>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
          {(["week", "month", "quarter"] as TimeGranularity[]).map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className="px-3 py-1 text-[10px] font-semibold transition-colors"
              style={{
                backgroundColor: granularity === g ? "#248567" : "#FAFAF8",
                color: granularity === g ? "#fff" : "#87B5A7",
              }}
            >
              {g === "week" ? "Weekly" : g === "month" ? "Monthly" : "Quarterly"}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-8 text-sm" style={{ color: "#B9CDC7" }}>
          Not enough closed deals with scores to show trends yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280} minWidth={200} minHeight={200}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#87B5A7" }} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#87B5A7" }}
              tickFormatter={(v: number) => `${v}%`}
              label={{ value: "Win Rate", angle: -90, position: "insideLeft", fontSize: 10, fill: "#87B5A7" }}
            />
            <Tooltip
              contentStyle={{ borderRadius: "12px", border: "1px solid #EEE9E1", fontSize: "12px" }}
              formatter={(value: number | null, name: string) => {
                if (value === null) return ["—", name];
                const range = SCORE_RANGES.find(r => r.key === name);
                return [`${value}%`, range?.label || name];
              }}
              labelFormatter={(label: string) => label}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(value: string) => {
                const range = SCORE_RANGES.find(r => r.key === value);
                return range?.label || value;
              }}
            />
            {SCORE_RANGES.map(r => (
              <Line
                key={r.key}
                type="monotone"
                dataKey={r.key}
                stroke={r.color}
                strokeWidth={2}
                dot={{ r: 4, fill: r.color }}
                connectNulls
                name={r.key}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {hasData && (
        <div className="flex items-center justify-center gap-4 text-[10px]" style={{ color: "#87B5A7" }}>
          {SCORE_RANGES.map(r => {
            const totalDeals = chartData.reduce((sum, d) => sum + (d[`${r.key}Count`] || 0), 0);
            return (
              <span key={r.key}>
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: r.color }} />
                {r.label}: {totalDeals} deal{totalDeals !== 1 ? "s" : ""}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ScoreTrendsOverTime: React.FC<{ csqls: CSQLOutcome[] }> = ({ csqls }) => {
  const [granularity, setGranularity] = useState<TimeGranularity>("month");

  const scored = useMemo(() => csqls.filter(c => c.linkedAssessment?.totalScore != null), [csqls]);

  const chartData = useMemo(() => {
    const periodMap = new Map<string, { total: number; count: number; scores: number[] }>();

    scored.forEach(c => {
      const dateStr = c.linkedAssessment?.callDate || c.createdDate;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const pk = getPeriodKey(d, granularity);
      const score = c.linkedAssessment!.totalScore!;

      if (!periodMap.has(pk)) {
        periodMap.set(pk, { total: 0, count: 0, scores: [] });
      }
      const bucket = periodMap.get(pk)!;
      bucket.total += score;
      bucket.count++;
      bucket.scores.push(score);
    });

    const periods = Array.from(periodMap.keys()).sort();

    let runningTotal = 0;
    let runningCount = 0;

    return periods.map(pk => {
      const bucket = periodMap.get(pk)!;
      const avg = Math.round((bucket.total / bucket.count) * 10) / 10;
      const min = Math.min(...bucket.scores);
      const max = Math.max(...bucket.scores);

      runningTotal += bucket.total;
      runningCount += bucket.count;
      const cumulativeAvg = Math.round((runningTotal / runningCount) * 10) / 10;

      return {
        period: formatPeriodLabel(pk, granularity),
        _sortKey: pk,
        avg,
        min,
        max,
        count: bucket.count,
        cumulativeAvg,
      };
    });
  }, [scored, granularity]);

  const hasData = chartData.length >= 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: "#242424" }}>
          Average Score Trend Over Time
        </h3>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
          {(["week", "month", "quarter"] as TimeGranularity[]).map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className="px-3 py-1 text-[10px] font-semibold transition-colors"
              style={{
                backgroundColor: granularity === g ? "#248567" : "#FAFAF8",
                color: granularity === g ? "#fff" : "#87B5A7",
              }}
            >
              {g === "week" ? "Weekly" : g === "month" ? "Monthly" : "Quarterly"}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-8 text-sm" style={{ color: "#B9CDC7" }}>
          No scored CSQLs to show trends yet.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280} minWidth={200} minHeight={200}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#87B5A7" }} />
              <YAxis
                domain={[0, 20]}
                tick={{ fontSize: 10, fill: "#87B5A7" }}
                label={{ value: "Score", angle: -90, position: "insideLeft", fontSize: 10, fill: "#87B5A7" }}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #EEE9E1", fontSize: "12px" }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    avg: "Period Avg",
                    cumulativeAvg: "Cumulative Avg",
                  };
                  return [value, labels[name] || name];
                }}
                labelFormatter={(label: string, payload: any[]) => {
                  const count = payload?.[0]?.payload?.count;
                  return count ? `${label} (${count} call${count > 1 ? "s" : ""})` : label;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    avg: "Period Average",
                    cumulativeAvg: "Cumulative Average",
                  };
                  return labels[value] || value;
                }}
              />
              <Bar dataKey="avg" fill="#248567" radius={[4, 4, 0, 0]} barSize={28} name="avg" opacity={0.7}>
                <LabelList dataKey="avg" position="top" fontSize={9} fill="#248567" />
              </Bar>
              <Line
                type="monotone"
                dataKey="cumulativeAvg"
                stroke="#4A5ABA"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={{ r: 4, fill: "#4A5ABA" }}
                name="cumulativeAvg"
              />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="flex items-center justify-center gap-6 text-[10px]" style={{ color: "#87B5A7" }}>
            <span>
              Latest avg: <strong style={{ color: "#248567" }}>{chartData[chartData.length - 1]?.avg}</strong>
            </span>
            <span>
              Overall avg: <strong style={{ color: "#4A5ABA" }}>{chartData[chartData.length - 1]?.cumulativeAvg}</strong>
            </span>
            <span>
              Total scored: <strong>{scored.length}</strong>
            </span>
            {chartData.length >= 2 && scored.length >= 2 && (() => {
              const first = chartData[0].avg;
              const last = chartData[chartData.length - 1].avg;
              const diff = Math.round((last - first) * 10) / 10;
              const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
              const color = diff > 0 ? "#248567" : diff < 0 ? "#D9534F" : "#87B5A7";
              return (
                <span>
                  Trend: <strong style={{ color }}>{arrow} {diff > 0 ? "+" : ""}{diff}</strong>
                </span>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
};

const MOVE_DIMENSIONS = [
  { id: "discovery", label: "Discovery", short: "D", color: "#6366F1" },
  { id: "motivation", label: "Motivation", short: "M", color: "#F59E0B" },
  { id: "opportunity", label: "Opportunity", short: "O", color: "#248567" },
  { id: "validation", label: "Validation", short: "V", color: "#8B5CF6" },
  { id: "execution", label: "Execution", short: "E", color: "#EF4444" },
];

function getMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

function getDimensionScore(scores: any[], dimensionId: string): number | null {
  if (!Array.isArray(scores)) return null;
  const entry = scores.find((s: any) => s.categoryId === dimensionId);
  return entry?.score ?? null;
}

const MOVEDimensionBreakdown: React.FC<{ csqls: CSQLOutcome[] }> = ({ csqls }) => {
  const closed = useMemo(() => csqls.filter(
    c => c.linkedAssessment?.totalScore != null && c.linkedAssessment?.scores?.length > 0 &&
      (c.closedStatus === "Closed Won" || c.closedStatus === "Closed Lost")
  ), [csqls]);

  const chartData = useMemo(() => {
    const won = closed.filter(c => c.closedStatus === "Closed Won");
    const lost = closed.filter(c => c.closedStatus === "Closed Lost");

    return MOVE_DIMENSIONS.map(dim => {
      const wonScores = won.map(c => getDimensionScore(c.linkedAssessment!.scores, dim.id)).filter((s): s is number => s != null);
      const lostScores = lost.map(c => getDimensionScore(c.linkedAssessment!.scores, dim.id)).filter((s): s is number => s != null);

      const wonAvg = wonScores.length ? Math.round((wonScores.reduce((a, b) => a + b, 0) / wonScores.length) * 10) / 10 : null;
      const lostAvg = lostScores.length ? Math.round((lostScores.reduce((a, b) => a + b, 0) / lostScores.length) * 10) / 10 : null;
      const wonMedian = wonScores.length ? getMedian(wonScores) : null;
      const lostMedian = lostScores.length ? getMedian(lostScores) : null;

      return {
        dimension: dim.label,
        short: dim.short,
        wonAvg,
        lostAvg,
        wonMedian,
        lostMedian,
        wonCount: wonScores.length,
        lostCount: lostScores.length,
        gap: wonAvg != null && lostAvg != null ? Math.round((wonAvg - lostAvg) * 10) / 10 : null,
      };
    });
  }, [closed]);

  const coachingPriority = useMemo(() => {
    const withGaps = chartData.filter(d => d.gap != null && d.lostAvg != null);
    if (withGaps.length === 0) return null;
    const lowestLost = withGaps.reduce((min, d) => (d.lostAvg! < min.lostAvg! ? d : min), withGaps[0]);
    return lowestLost;
  }, [chartData]);

  const hasData = closed.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold" style={{ color: "#242424" }}>
        MOVE Dimension Breakdown: Won vs Lost
      </h3>

      {!hasData ? (
        <div className="text-center py-8 text-sm" style={{ color: "#B9CDC7" }}>
          Need closed deals with scored calls to show dimension breakdown.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280} minWidth={200} minHeight={200}>
            <ComposedChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
              <XAxis dataKey="dimension" tick={{ fontSize: 10, fill: "#87B5A7" }} />
              <YAxis
                domain={[0, 4]}
                ticks={[0, 1, 2, 3, 4]}
                tick={{ fontSize: 10, fill: "#87B5A7" }}
                label={{ value: "Score (1-4)", angle: -90, position: "insideLeft", fontSize: 10, fill: "#87B5A7" }}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #EEE9E1", fontSize: "12px" }}
                formatter={(value: number | null, name: string) => {
                  if (value === null) return ["—", name];
                  const labels: Record<string, string> = {
                    wonAvg: "Won Avg",
                    lostAvg: "Lost Avg",
                  };
                  return [value, labels[name] || name];
                }}
                labelFormatter={(label: string, payload: any[]) => {
                  const d = payload?.[0]?.payload;
                  if (!d) return label;
                  const parts = [label];
                  if (d.wonMedian != null) parts.push(`Won Median: ${d.wonMedian}`);
                  if (d.lostMedian != null) parts.push(`Lost Median: ${d.lostMedian}`);
                  if (d.gap != null) parts.push(`Gap: ${d.gap > 0 ? '+' : ''}${d.gap}`);
                  return parts.join(' · ');
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value: string) => {
                  if (value === "wonAvg") return "Closed Won (Avg)";
                  if (value === "lostAvg") return "Closed Lost (Avg)";
                  return value;
                }}
              />
              <Bar dataKey="wonAvg" fill="#248567" name="wonAvg" radius={[4, 4, 0, 0]} barSize={24}>
                <LabelList dataKey="wonAvg" position="top" fontSize={9} fill="#248567" formatter={(v: number | null) => v != null ? v : ""} />
              </Bar>
              <Bar dataKey="lostAvg" fill="#D9534F" name="lostAvg" radius={[4, 4, 0, 0]} barSize={24}>
                <LabelList dataKey="lostAvg" position="top" fontSize={9} fill="#D9534F" formatter={(v: number | null) => v != null ? v : ""} />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[10px]" style={{ color: "#87B5A7" }}>
            {chartData.map(d => (
              <span key={d.dimension} className="flex items-center gap-1">
                <strong>{d.short}</strong>
                {d.wonMedian != null && <span style={{ color: "#248567" }}>Med: {d.wonMedian}</span>}
                {d.lostMedian != null && <span style={{ color: "#D9534F" }}>Med: {d.lostMedian}</span>}
                {d.gap != null && (
                  <span style={{ color: d.gap > 0 ? "#248567" : d.gap < 0 ? "#D9534F" : "#87B5A7" }}>
                    ({d.gap > 0 ? "+" : ""}{d.gap})
                  </span>
                )}
              </span>
            ))}
          </div>

          {coachingPriority && (
            <div className="rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: "#FFF8E7", border: "1px solid #FDE68A" }}>
              <Target className="w-4 h-4 flex-shrink-0" style={{ color: "#B58A1B" }} />
              <span className="text-xs" style={{ color: "#92400E" }}>
                <strong>Top coaching priority:</strong> {coachingPriority.dimension} — lowest avg score for lost deals ({coachingPriority.lostAvg}/4).
                {coachingPriority.gap != null && coachingPriority.gap > 0 && ` Won deals average ${coachingPriority.gap} points higher in this dimension.`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MOVEDimensionTrends: React.FC<{ csqls: CSQLOutcome[] }> = ({ csqls }) => {
  const [granularity, setGranularity] = useState<TimeGranularity>("month");

  const scored = useMemo(() => csqls.filter(
    c => c.linkedAssessment?.totalScore != null && c.linkedAssessment?.scores?.length > 0
  ), [csqls]);

  const chartData = useMemo(() => {
    const periodMap = new Map<string, Map<string, number[]>>();

    scored.forEach(c => {
      const dateStr = c.linkedAssessment?.callDate || c.createdDate;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const pk = getPeriodKey(d, granularity);

      if (!periodMap.has(pk)) {
        periodMap.set(pk, new Map());
      }
      const dimMap = periodMap.get(pk)!;

      for (const dim of MOVE_DIMENSIONS) {
        const score = getDimensionScore(c.linkedAssessment!.scores, dim.id);
        if (score != null) {
          if (!dimMap.has(dim.id)) dimMap.set(dim.id, []);
          dimMap.get(dim.id)!.push(score);
        }
      }
    });

    const periods = Array.from(periodMap.keys()).sort();

    return periods.map(pk => {
      const dimMap = periodMap.get(pk)!;
      const row: Record<string, any> = {
        period: formatPeriodLabel(pk, granularity),
        _sortKey: pk,
      };
      let count = 0;
      for (const dim of MOVE_DIMENSIONS) {
        const scores = dimMap.get(dim.id) || [];
        row[dim.id] = scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null;
        count = Math.max(count, scores.length);
      }
      row.count = count;
      return row;
    });
  }, [scored, granularity]);

  const hasData = chartData.length >= 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: "#242424" }}>
          MOVE Dimension Trends Over Time
        </h3>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
          {(["week", "month", "quarter"] as TimeGranularity[]).map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className="px-3 py-1 text-[10px] font-semibold transition-colors"
              style={{
                backgroundColor: granularity === g ? "#248567" : "#FAFAF8",
                color: granularity === g ? "#fff" : "#87B5A7",
              }}
            >
              {g === "week" ? "Weekly" : g === "month" ? "Monthly" : "Quarterly"}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-8 text-sm" style={{ color: "#B9CDC7" }}>
          No scored CSQLs to show dimension trends yet.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300} minWidth={200} minHeight={200}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#87B5A7" }} />
              <YAxis
                domain={[0, 4]}
                ticks={[0, 1, 2, 3, 4]}
                tick={{ fontSize: 10, fill: "#87B5A7" }}
                label={{ value: "Score (1-4)", angle: -90, position: "insideLeft", fontSize: 10, fill: "#87B5A7" }}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #EEE9E1", fontSize: "12px" }}
                formatter={(value: number | null, name: string) => {
                  if (value === null) return ["—", name];
                  const dim = MOVE_DIMENSIONS.find(d => d.id === name);
                  return [value, dim?.label || name];
                }}
                labelFormatter={(label: string, payload: any[]) => {
                  const count = payload?.[0]?.payload?.count;
                  return count ? `${label} (${count} call${count > 1 ? "s" : ""})` : label;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value: string) => {
                  const dim = MOVE_DIMENSIONS.find(d => d.id === value);
                  return dim ? `${dim.short} - ${dim.label}` : value;
                }}
              />
              {MOVE_DIMENSIONS.map(dim => (
                <Line
                  key={dim.id}
                  type="monotone"
                  dataKey={dim.id}
                  stroke={dim.color}
                  strokeWidth={2}
                  dot={{ r: 4, fill: dim.color }}
                  connectNulls
                  name={dim.id}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>

          {chartData.length >= 2 && (
            <div className="flex flex-wrap items-center justify-center gap-4 text-[10px]" style={{ color: "#87B5A7" }}>
              {MOVE_DIMENSIONS.map(dim => {
                const first = chartData[0][dim.id];
                const last = chartData[chartData.length - 1][dim.id];
                if (first == null || last == null) return null;
                const diff = Math.round((last - first) * 10) / 10;
                const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
                const color = diff > 0 ? "#248567" : diff < 0 ? "#D9534F" : "#87B5A7";
                return (
                  <span key={dim.id} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: dim.color }} />
                    <strong>{dim.short}</strong>
                    <span style={{ color }}>{arrow} {diff > 0 ? "+" : ""}{diff}</span>
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StageDistributionChart: React.FC<{ summary: CSQLSummary; csqls: CSQLOutcome[] }> = ({ summary, csqls }) => {
  const dist = summary.stageDistribution || {};
  const stages = [...STAGE_ORDER, ...Object.keys(dist).filter(s => !STAGE_ORDER.includes(s))];
  const data = stages
    .filter(stage => dist[stage]?.count > 0)
    .reverse()
    .map(stage => {
      const stageCSQLs = csqls.filter(c => c.stageName === stage);
      const scored = stageCSQLs.filter(c => c.linkedAssessment?.totalScore != null);
      const avgScore = scored.length > 0
        ? Math.round((scored.reduce((sum, c) => sum + c.linkedAssessment!.totalScore!, 0) / scored.length) * 10) / 10
        : null;
      return {
        name: stage,
        pipeline: Math.round((dist[stage]?.pipeline || 0) / 1000),
        count: dist[stage]?.count || 0,
        scored: scored.length,
        avgScore,
        fill: getStageConfig(stage).color,
      };
    });

  if (data.length === 0) return null;

  const formatK = (v: number) => `$${v}k`;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold" style={{ color: "#242424" }}>
        Pipeline Value by Stage
      </h3>
      <ResponsiveContainer width="100%" height={260} minWidth={200} minHeight={200}>
        <BarChart data={data} layout="vertical" barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#87B5A7" }}
            tickFormatter={formatK}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: "#555" }}
            width={90}
          />
          <Tooltip
            contentStyle={{ borderRadius: "12px", border: "1px solid #EEE9E1", fontSize: "12px" }}
            formatter={(value: number, name: string) => {
              if (name === "pipeline") return [`$${value.toLocaleString()}k`, "Pipeline"];
              return [value, name];
            }}
            labelFormatter={(label: string) => {
              const item = data.find(d => d.name === label);
              if (!item) return label;
              return `${label} (${item.count} deal${item.count !== 1 ? "s" : ""}${item.avgScore != null ? `, avg score: ${item.avgScore}` : ""})`;
            }}
          />
          <Bar dataKey="pipeline" name="pipeline" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="count"
              position="insideLeft"
              fontSize={10}
              fill="#fff"
              fontWeight="bold"
              formatter={(v: number) => `${v} deals`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const REP_TIME_OPTIONS = [
  { key: "all", label: "All Time" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "prevquarter", label: "Last Quarter" },
  { key: "year", label: "This Year" },
] as const;

type RepTimePeriod = typeof REP_TIME_OPTIONS[number]["key"];

function filterByRepTime(csqls: CSQLOutcome[], period: RepTimePeriod): CSQLOutcome[] {
  if (period === "all") return csqls;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let start: Date, end: Date;
  if (period === "month") {
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 0, 23, 59, 59);
  } else if (period === "quarter") {
    const q = Math.floor(month / 3);
    start = new Date(year, q * 3, 1);
    end = new Date(year, q * 3 + 3, 0, 23, 59, 59);
  } else if (period === "prevquarter") {
    const q = Math.floor(month / 3) - 1;
    const qYear = q < 0 ? year - 1 : year;
    const qIdx = ((q % 4) + 4) % 4;
    start = new Date(qYear, qIdx * 3, 1);
    end = new Date(qYear, qIdx * 3 + 3, 0, 23, 59, 59);
  } else {
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31, 23, 59, 59);
  }
  return csqls.filter(c => {
    const d = new Date(c.createdDate);
    return d >= start && d <= end;
  });
}

interface RepCoachingDimension {
  dimension: string;
  avgScore: number;
  rating: string;
  observation: string;
  tips: string[];
}

interface RepCoachingResult {
  repName: string;
  overallSummary: string;
  dimensionCoaching: RepCoachingDimension[];
}

const RATING_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  Strength:     { bg: "#E7F6EE", text: "#248567", label: "Strength" },
  Developing:   { bg: "#FFFBEB", text: "#B45309", label: "Developing" },
  "Needs Work": { bg: "#FEF2F2", text: "#DC2626", label: "Needs Work" },
};

function dimScoreColor(score: number | null): { bg: string; text: string } {
  if (score == null) return { bg: "#F5F5F5", text: "#9CA3AF" };
  if (score >= 3.0) return { bg: "#E7F6EE", text: "#248567" };
  if (score >= 2.0) return { bg: "#FFFBEB", text: "#B45309" };
  return { bg: "#FEF2F2", text: "#DC2626" };
}

const TimeToCloseTab: React.FC<{ csqls: CSQLOutcome[] }> = ({ csqls }) => {
  const [showDetail, setShowDetail] = useState(false);
  const closedDeals = useMemo(() =>
    csqls.filter(c =>
      (c.closedStatus === "Closed Won" || c.closedStatus === "Closed Lost") &&
      c.createdDate && c.closeDate
    ).map(c => {
      const created = new Date(c.createdDate);
      const closed = new Date(c.closeDate!);
      const days = Math.max(0, Math.round((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
      return { ...c, daysToClose: days };
    }),
  [csqls]);

  const won = closedDeals.filter(c => c.closedStatus === "Closed Won");
  const lost = closedDeals.filter(c => c.closedStatus === "Closed Lost");

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const median = (arr: number[]) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };

  const avgWon = avg(won.map(c => c.daysToClose));
  const avgLost = avg(lost.map(c => c.daysToClose));
  const medianWon = median(won.map(c => c.daysToClose));
  const medianLost = median(lost.map(c => c.daysToClose));

  const buckets = [
    { label: "0–30d", min: 0, max: 30 },
    { label: "31–60d", min: 31, max: 60 },
    { label: "61–90d", min: 61, max: 90 },
    { label: "91–180d", min: 91, max: 180 },
    { label: "180d+", min: 181, max: Infinity },
  ];

  const distributionData = buckets.map(b => {
    const wonInBucket = won.filter(c => c.daysToClose >= b.min && c.daysToClose <= b.max).length;
    const lostInBucket = lost.filter(c => c.daysToClose >= b.min && c.daysToClose <= b.max).length;
    const total = wonInBucket + lostInBucket;
    return {
      bucket: b.label,
      won: wonInBucket,
      lost: lostInBucket,
      total,
      winRate: total > 0 ? Math.round((wonInBucket / total) * 100) : null,
    };
  });

  const scoreBuckets = [
    { label: "Very Low\n(1–4)", min: 1, max: 4 },
    { label: "Low\n(5–8)", min: 5, max: 8 },
    { label: "Medium\n(9–12)", min: 9, max: 12 },
    { label: "High\n(13–16)", min: 13, max: 16 },
    { label: "Very High\n(17–20)", min: 17, max: 20 },
  ];

  const scoreTTCData = scoreBuckets.map(b => {
    const inBucket = closedDeals.filter(c =>
      c.linkedAssessment?.totalScore != null &&
      c.linkedAssessment.totalScore >= b.min &&
      c.linkedAssessment.totalScore <= b.max
    );
    const wonB = inBucket.filter(c => c.closedStatus === "Closed Won");
    const lostB = inBucket.filter(c => c.closedStatus === "Closed Lost");
    return {
      score: b.label,
      avgDays: inBucket.length ? Math.round(inBucket.reduce((a, c) => a + c.daysToClose, 0) / inBucket.length) : null,
      avgWon: wonB.length ? Math.round(wonB.reduce((a, c) => a + c.daysToClose, 0) / wonB.length) : null,
      avgLost: lostB.length ? Math.round(lostB.reduce((a, c) => a + c.daysToClose, 0) / lostB.length) : null,
      count: inBucket.length,
    };
  }).filter(d => d.count > 0);

  const [trendGranularity, setTrendGranularity] = useState<"month" | "quarter">("month");

  const trendData = useMemo(() => {
    const periodMap = new Map<string, { wonDays: number[]; lostDays: number[] }>();
    closedDeals.forEach(c => {
      const d = new Date(c.closeDate!);
      if (isNaN(d.getTime())) return;
      const pk = getPeriodKey(d, trendGranularity);
      if (!periodMap.has(pk)) periodMap.set(pk, { wonDays: [], lostDays: [] });
      const entry = periodMap.get(pk)!;
      if (c.closedStatus === "Closed Won") entry.wonDays.push(c.daysToClose);
      else entry.lostDays.push(c.daysToClose);
    });
    return Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([pk, { wonDays, lostDays }]) => {
        const avgW = wonDays.length ? Math.round(wonDays.reduce((a, b) => a + b, 0) / wonDays.length) : null;
        const avgL = lostDays.length ? Math.round(lostDays.reduce((a, b) => a + b, 0) / lostDays.length) : null;
        return {
          period: formatPeriodLabel(pk, trendGranularity),
          avgWon: avgW,
          avgLost: avgL,
          wonCount: wonDays.length,
          lostCount: lostDays.length,
          total: wonDays.length + lostDays.length,
        };
      });
  }, [closedDeals, trendGranularity]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg shadow-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
        <p className="font-bold mb-1" style={{ color: "#242424" }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value != null ? `${p.value}${p.dataKey === "total" || p.dataKey === "wonCount" || p.dataKey === "lostCount" ? " deals" : " days"}` : "—"}</p>
        ))}
      </div>
    );
  };

  if (closedDeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="w-10 h-10 mb-3" style={{ color: "#C5BAB0" }} />
        <p className="text-sm font-semibold" style={{ color: "#5C5C5C" }}>No closed deals yet</p>
        <p className="text-xs mt-1" style={{ color: "#A0A0A0" }}>Time to close metrics will appear once deals are closed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Avg Days to Close (Won)", value: avgWon != null ? `${avgWon}d` : "—", sub: medianWon != null ? `Median: ${medianWon}d` : "", color: "#248567", bg: "#E7F6EE", n: won.length },
          { label: "Avg Days to Close (Lost)", value: avgLost != null ? `${avgLost}d` : "—", sub: medianLost != null ? `Median: ${medianLost}d` : "", color: "#D9534F", bg: "#FFEAE7", n: lost.length },
          { label: "Fastest Win", value: won.length ? `${Math.min(...won.map(c => c.daysToClose))}d` : "—", sub: "Quickest close", color: "#4A5ABA", bg: "#EEF0FD", n: won.length },
          { label: "Longest Active Win", value: won.length ? `${Math.max(...won.map(c => c.daysToClose))}d` : "—", sub: "Slowest close", color: "#87B5A7", bg: "#F0FDF4", n: won.length },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: card.bg, border: `1px solid ${card.color}22` }}>
            <div className="text-[10px] font-semibold uppercase mb-1" style={{ color: card.color }}>{card.label}</div>
            <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
            {card.sub && <div className="text-[10px] mt-0.5" style={{ color: card.color, opacity: 0.75 }}>{card.sub}</div>}
            <div className="text-[10px] mt-1" style={{ color: card.color, opacity: 0.55 }}>{card.n} deal{card.n !== 1 ? "s" : ""}</div>
          </div>
        ))}
      </div>

      {trendData.length >= 1 && (
        <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "#242424" }}>Time to Close Trend</h3>
              <p className="text-[11px] mt-0.5" style={{ color: "#87B5A7" }}>
                Avg days from opportunity creation to close for Won (green) and Lost (red) deals. Bars show total deal volume per period.
                {trendData.length === 1 && <span style={{ color: "#B58A1B" }}> — Widen the time period filter to see a trend line.</span>}
              </p>
            </div>
            <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid #EEE9E1" }}>
              {(["month", "quarter"] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setTrendGranularity(g)}
                  className="px-3 py-1 text-[10px] font-semibold transition-colors"
                  style={{
                    backgroundColor: trendGranularity === g ? "#248567" : "#FAFAF8",
                    color: trendGranularity === g ? "#fff" : "#87B5A7",
                  }}
                >
                  {g === "month" ? "Monthly" : "Quarterly"}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280} minHeight={200} minWidth={200}>
            <ComposedChart data={trendData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#87B5A7" }} />
              <YAxis
                yAxisId="days"
                tick={{ fontSize: 10, fill: "#87B5A7" }}
                label={{ value: "Avg Days", angle: -90, position: "insideLeft", fontSize: 10, fill: "#87B5A7" }}
              />
              <YAxis
                yAxisId="count"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "#C5BAB0" }}
                label={{ value: "Deals", angle: 90, position: "insideRight", fontSize: 10, fill: "#C5BAB0" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="count" dataKey="total" name="Total Deals" fill="#EEE9E1" radius={[3, 3, 0, 0]} />
              <Line yAxisId="days" type="monotone" dataKey="avgWon" name="Avg Days (Won)" stroke="#248567" strokeWidth={2} dot={{ r: 3, fill: "#248567" }} connectNulls />
              <Line yAxisId="days" type="monotone" dataKey="avgLost" name="Avg Days (Lost)" stroke="#F87171" strokeWidth={2} dot={{ r: 3, fill: "#F87171" }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
        <h3 className="text-sm font-semibold mb-0.5" style={{ color: "#242424" }}>Time to Close Distribution</h3>
        <p className="text-[11px] mb-3" style={{ color: "#87B5A7" }}>How many deals closed in each time bucket — and win rate within each bucket.</p>
        <ResponsiveContainer width="100%" height={260} minHeight={200} minWidth={200}>
          <ComposedChart data={distributionData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
            <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#87B5A7" }} />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 10, fill: "#87B5A7" }} label={{ value: "Deals", angle: -90, position: "insideLeft", fontSize: 10, fill: "#87B5A7" }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: "#87B5A7" }} label={{ value: "Win %", angle: 90, position: "insideRight", fontSize: 10, fill: "#87B5A7" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="won" name="Closed Won" stackId="a" fill="#248567" radius={[0, 0, 0, 0]} />
            <Bar yAxisId="left" dataKey="lost" name="Closed Lost" stackId="a" fill="#F87171" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="winRate" name="Win Rate" stroke="#B58A1B" strokeWidth={2} dot={{ r: 3, fill: "#B58A1B" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {scoreTTCData.length > 0 && (
        <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
          <h3 className="text-sm font-semibold mb-0.5" style={{ color: "#242424" }}>Score vs. Time to Close</h3>
          <p className="text-[11px] mb-3" style={{ color: "#87B5A7" }}>Average days to close for Won and Lost deals by MOVE score range. Lower days with higher scores may indicate stronger deals.</p>
          <ResponsiveContainer width="100%" height={260} minHeight={200} minWidth={200}>
            <ComposedChart data={scoreTTCData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
              <XAxis dataKey="score" tick={{ fontSize: 10, fill: "#87B5A7" }} />
              <YAxis tick={{ fontSize: 10, fill: "#87B5A7" }} label={{ value: "Avg Days", angle: -90, position: "insideLeft", fontSize: 10, fill: "#87B5A7" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="avgWon" name="Avg Days (Won)" fill="#248567" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgLost" name="Avg Days (Lost)" fill="#F87171" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
        <div
          className="px-4 py-2.5 flex items-center justify-between cursor-pointer select-none"
          style={{ backgroundColor: "#F5F0EB" }}
          onClick={() => setShowDetail(v => !v)}
        >
          <div>
            <p className="text-xs font-semibold" style={{ color: "#242424" }}>Closed Deals — Time to Close Detail</p>
            {!showDetail && <p className="text-[10px] mt-0.5" style={{ color: "#87B5A7" }}>Sorted by fastest to slowest. Score shown where available.</p>}
          </div>
          {showDetail
            ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "#87B5A7" }} />
            : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "#87B5A7" }} />}
        </div>
        {showDetail && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "#FAFAF8" }}>
                  <th className="px-4 py-2 text-left font-semibold" style={{ color: "#5C5C5C" }}>Opportunity</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: "#5C5C5C" }}>CSM</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: "#5C5C5C" }}>Outcome</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: "#5C5C5C" }}>Days to Close</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: "#5C5C5C" }}>MOVE Score</th>
                  <th className="px-3 py-2 text-right font-semibold" style={{ color: "#5C5C5C" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {[...closedDeals].sort((a, b) => a.daysToClose - b.daysToClose).slice(0, 50).map((c) => (
                  <tr key={c.oppId} className="border-t hover:bg-[#FAFAF8] transition-colors" style={{ borderColor: "#EEE9E1" }}>
                    <td className="px-4 py-2.5 font-medium truncate max-w-[180px]" style={{ color: "#242424" }} title={c.oppName}>{c.oppName}</td>
                    <td className="px-3 py-2.5" style={{ color: "#5C5C5C" }}>{c.createdByName.split(" ")[0]}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full font-semibold text-[10px]" style={{
                        backgroundColor: c.closedStatus === "Closed Won" ? "#E7F6EE" : "#FFEAE7",
                        color: c.closedStatus === "Closed Won" ? "#248567" : "#D9534F",
                      }}>
                        {c.closedStatus === "Closed Won" ? "Won" : "Lost"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold" style={{ color: "#242424" }}>{c.daysToClose}d</td>
                    <td className="px-3 py-2.5 text-center">
                      {c.linkedAssessment?.totalScore != null ? (
                        <span className="font-semibold" style={{ color: c.linkedAssessment.totalScore >= 16 ? "#248567" : c.linkedAssessment.totalScore >= 12 ? "#B45309" : c.linkedAssessment.totalScore >= 8 ? "#D97706" : "#DC2626" }}>
                          {c.linkedAssessment.totalScore}/20
                        </span>
                      ) : <span style={{ color: "#C5BAB0" }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ color: "#5C5C5C" }}>
                      {c.amount != null ? `$${c.amount >= 1_000_000 ? (c.amount / 1_000_000).toFixed(1) + "M" : c.amount >= 1_000 ? (c.amount / 1_000).toFixed(0) + "K" : c.amount}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const RepAnalysisTab: React.FC<{ csqls: CSQLOutcome[] }> = ({ csqls }) => {
  const [timePeriod, setTimePeriod] = useState<RepTimePeriod>("all");
  const [coachingRep, setCoachingRep] = useState<string | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingData, setCoachingData] = useState<RepCoachingResult | null>(null);
  const [coachingError, setCoachingError] = useState<string | null>(null);

  const filtered = useMemo(() => filterByRepTime(csqls, timePeriod), [csqls, timePeriod]);

  const repStats = useMemo(() => {
    const map = new Map<string, {
      name: string;
      total: number;
      scored: number;
      won: number;
      closed: number;
      totalScoreSum: number;
      dimSums: Record<string, number>;
      dimCounts: Record<string, number>;
    }>();

    for (const c of filtered) {
      const name = c.createdByName || "Unknown";
      if (!map.has(name)) {
        map.set(name, {
          name,
          total: 0,
          scored: 0,
          won: 0,
          closed: 0,
          totalScoreSum: 0,
          dimSums: {},
          dimCounts: {},
        });
      }
      const r = map.get(name)!;
      r.total++;
      if (c.linkedAssessment?.totalScore != null) {
        r.scored++;
        r.totalScoreSum += c.linkedAssessment.totalScore;
        for (const dim of MOVE_DIMENSIONS) {
          const s = getDimensionScore(c.linkedAssessment.scores, dim.id);
          if (s != null) {
            r.dimSums[dim.id] = (r.dimSums[dim.id] || 0) + s;
            r.dimCounts[dim.id] = (r.dimCounts[dim.id] || 0) + 1;
          }
        }
      }
      if (c.closedStatus === "Closed Won" || c.closedStatus === "Closed Lost") {
        r.closed++;
        if (c.closedStatus === "Closed Won") r.won++;
      }
    }

    return [...map.values()]
      .filter(r => r.scored > 0)
      .map(r => ({
        name: r.name,
        total: r.total,
        scored: r.scored,
        avgTotal: r.scored > 0 ? Math.round((r.totalScoreSum / r.scored) * 10) / 10 : null,
        winRate: r.closed > 0 ? Math.round((r.won / r.closed) * 100) : null,
        closedCount: r.closed,
        dimAvgs: Object.fromEntries(
          MOVE_DIMENSIONS.map(d => [
            d.id,
            r.dimCounts[d.id] > 0
              ? Math.round((r.dimSums[d.id] / r.dimCounts[d.id]) * 10) / 10
              : null,
          ])
        ),
      }))
      .sort((a, b) => (b.avgTotal ?? 0) - (a.avgTotal ?? 0));
  }, [filtered]);

  const repCSQLs = useMemo(() => {
    if (!coachingRep) return [];
    return filtered.filter(c => c.createdByName === coachingRep);
  }, [filtered, coachingRep]);

  const fetchCoaching = useCallback(async (repName: string) => {
    setCoachingRep(repName);
    setCoachingLoading(true);
    setCoachingError(null);
    setCoachingData(null);
    try {
      const repCSQLData = filtered.filter(c => c.createdByName === repName);
      const response = await fetch("/api/csql-rep-coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ repName, csqls: repCSQLData }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to get coaching");
      }
      const data: RepCoachingResult = await response.json();
      setCoachingData(data);
    } catch (err: any) {
      setCoachingError(err.message || "Failed to generate coaching");
    } finally {
      setCoachingLoading(false);
    }
  }, [filtered]);

  if (repStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="w-10 h-10 mb-3" style={{ color: "#C5BAB0" }} />
        <p className="text-sm font-semibold" style={{ color: "#5C5C5C" }}>No scored CSQLs in this period</p>
        <p className="text-xs mt-1" style={{ color: "#A0A0A0" }}>Adjust the time filter or score some calls first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#242424" }}>Per-Rep Score Breakdown</p>
          <p className="text-xs mt-0.5" style={{ color: "#878787" }}>Average scores per MOVE dimension for each CSM</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: "#F5F0EB", border: "1px solid #EEE9E1" }}>
          {REP_TIME_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setTimePeriod(opt.key)}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150"
              style={{
                backgroundColor: timePeriod === opt.key ? "#fff" : "transparent",
                color: timePeriod === opt.key ? "#248567" : "#87B5A7",
                boxShadow: timePeriod === opt.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: "#F5F0EB" }}>
                <th className="px-4 py-2.5 text-left font-semibold" style={{ color: "#5C5C5C" }}>Rep</th>
                <th className="px-3 py-2.5 text-center font-semibold" style={{ color: "#5C5C5C" }}>CSQLs</th>
                <th className="px-3 py-2.5 text-center font-semibold" style={{ color: "#5C5C5C" }}>Avg Score</th>
                <th className="px-3 py-2.5 text-center font-semibold" style={{ color: "#5C5C5C" }}>Win Rate</th>
                {MOVE_DIMENSIONS.map(d => (
                  <th key={d.id} className="px-3 py-2.5 text-center font-semibold" style={{ color: d.color }}>
                    {d.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center font-semibold" style={{ color: "#5C5C5C" }}>AI Coaching</th>
              </tr>
            </thead>
            <tbody>
              {repStats.map((rep, idx) => (
                <tr
                  key={rep.name}
                  style={{ backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#FAFAF8", borderTop: "1px solid #F0EBE5" }}
                >
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "#242424" }}>
                    <div className="flex items-center gap-2">
                      {idx === 0 && <Star className="w-3 h-3 flex-shrink-0" style={{ color: "#F59E0B" }} />}
                      {rep.name}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center" style={{ color: "#5C5C5C" }}>
                    <span>{rep.scored}</span>
                    {rep.total > rep.scored && (
                      <span className="ml-1" style={{ color: "#A0A0A0" }}>/{rep.total}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold" style={{ color: "#242424" }}>
                    {rep.avgTotal ?? "—"}
                    <span className="text-[10px] font-normal ml-0.5" style={{ color: "#A0A0A0" }}>/20</span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold" style={{ color: rep.winRate != null ? (rep.winRate >= 50 ? "#248567" : rep.winRate >= 30 ? "#B45309" : "#DC2626") : "#A0A0A0" }}>
                    {rep.winRate != null ? `${rep.winRate}%` : "—"}
                    {rep.closedCount > 0 && (
                      <span className="block text-[10px] font-normal" style={{ color: "#A0A0A0" }}>{rep.closedCount} closed</span>
                    )}
                  </td>
                  {MOVE_DIMENSIONS.map(d => {
                    const score = rep.dimAvgs[d.id];
                    const { bg, text } = dimScoreColor(score);
                    return (
                      <td key={d.id} className="px-3 py-2.5 text-center">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ backgroundColor: bg, color: text }}
                        >
                          {score != null ? score.toFixed(1) : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => {
                        if (coachingRep === rep.name && coachingData) {
                          setCoachingRep(null);
                          setCoachingData(null);
                        } else {
                          fetchCoaching(rep.name);
                        }
                      }}
                      disabled={coachingLoading && coachingRep === rep.name}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-colors hover:shadow-sm disabled:opacity-50"
                      style={{ backgroundColor: coachingRep === rep.name && coachingData ? "#E7F6EE" : "#F5F0EB", color: coachingRep === rep.name && coachingData ? "#248567" : "#5C5C5C" }}
                    >
                      {coachingLoading && coachingRep === rep.name ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Brain className="w-3 h-3" />
                      )}
                      {coachingRep === rep.name && coachingData ? "Hide" : "Coach"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {coachingLoading && (
        <div className="flex items-center gap-3 rounded-xl p-5" style={{ backgroundColor: "#FAFAF8", border: "1px solid #EEE9E1" }}>
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: "#248567" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#242424" }}>Generating coaching for {coachingRep}…</p>
            <p className="text-xs mt-0.5" style={{ color: "#878787" }}>Analyzing their score patterns and outcomes with AI.</p>
          </div>
        </div>
      )}

      {coachingError && (
        <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#DC2626" }} />
          <p className="text-sm" style={{ color: "#DC2626" }}>{coachingError}</p>
          <button onClick={() => setCoachingError(null)} className="ml-auto"><X className="w-4 h-4" style={{ color: "#DC2626" }} /></button>
        </div>
      )}

      {coachingData && !coachingLoading && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
          <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: "#E7F6EE", borderBottom: "1px solid #B5E6D0" }}>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" style={{ color: "#248567" }} />
              <span className="text-sm font-bold" style={{ color: "#248567" }}>AI Coaching — {coachingData.repName}</span>
            </div>
            <button onClick={() => { setCoachingRep(null); setCoachingData(null); }}>
              <X className="w-4 h-4" style={{ color: "#248567" }} />
            </button>
          </div>

          <div className="p-5 space-y-5" style={{ backgroundColor: "#FAFAF8" }}>
            <div className="rounded-lg p-4" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#F59E0B" }} />
                <div>
                  <p className="text-xs font-semibold uppercase mb-1" style={{ color: "#878787" }}>Overall Coaching Summary</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#242424" }}>{coachingData.overallSummary}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coachingData.dimensionCoaching.map(dim => {
                const ratingStyle = RATING_STYLES[dim.rating] || RATING_STYLES["Developing"];
                const dimMeta = MOVE_DIMENSIONS.find(d => d.id === dim.dimension.toLowerCase() || d.label.toLowerCase() === dim.dimension.toLowerCase());
                return (
                  <div key={dim.dimension} className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dimMeta?.color || "#9CA3AF" }} />
                        <span className="text-xs font-bold uppercase" style={{ color: "#242424" }}>
                          {dimMeta?.label || dim.dimension}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: dimScoreColor(dim.avgScore).text }}>
                          {dim.avgScore.toFixed(1)}<span className="text-[10px] font-normal">/4</span>
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: ratingStyle.bg, color: ratingStyle.text }}
                        >
                          {dim.rating}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#5C5C5C" }}>{dim.observation}</p>
                    <ul className="space-y-1.5">
                      {dim.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "#242424" }}>
                          <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "#248567" }} />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AccountCallResult {
  conversationId: string;
  title: string;
  callDate: string;
  callUrl: string;
  csmName: string;
  durationMins: number;
  accountName: string;
  alreadyAnalyzed: boolean;
  assessmentId: number | null;
  assessmentScore: number | null;
}

const FindCallsModal: React.FC<{
  csql: CSQLOutcome;
  onClose: () => void;
  onViewAssessment?: (assessmentId: number) => void;
  replaceMode?: boolean;
  onSelectCall?: (assessmentId: number) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}> = ({ csql, onClose, onViewAssessment, replaceMode, onSelectCall, queryClient }) => {
  const [calls, setCalls] = useState<AccountCallResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const analyzeMutation = useAnalyzeGongCalls();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const linkCallToCSQL = async (assessmentId: number, conversationId: string) => {
    setLinkingId(conversationId);
    try {
      await fetch("/api/csql/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oppId: csql.oppId, assessmentId }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/csql-unscored-count"] });
      await refetchCalls();
    } catch (err) {
      console.error("Failed to link call to CSQL:", err);
    } finally {
      setLinkingId(null);
    }
  };

  React.useEffect(() => {
    const fetchCalls = async () => {
      try {
        const params = new URLSearchParams({
          accountName: csql.accountName,
          beforeDate: csql.createdDate,
        });
        const response = await fetch(`/api/csql-find-calls?${params}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch calls");
        const data = await response.json();
        setCalls(data.calls);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchCalls();
  }, [csql.accountName, csql.createdDate]);

  const refetchCalls = async () => {
    try {
      const params = new URLSearchParams({
        accountName: csql.accountName,
        beforeDate: csql.createdDate,
      });
      const response = await fetch(`/api/csql-find-calls?${params}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCalls(data.calls);
      }
    } catch {}
  };

  React.useEffect(() => {
    if (!calls || replaceMode || csql.linkedAssessment) return;
    const scoredCalls = calls.filter(c => c.alreadyAnalyzed && c.assessmentId);
    if (scoredCalls.length === 1) {
      const only = scoredCalls[0];
      linkCallToCSQL(only.assessmentId!, only.conversationId);
    }
  }, [calls]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#EEE9E1" }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: "#242424" }}>
              {replaceMode ? 'Replace Score for' : 'Find Calls for'} {csql.accountName}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#87B5A7" }}>
              Calls within 180 days before CSQL created on {new Date(csql.createdDate).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" style={{ color: "#87B5A7" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#248567" }} />
              <span className="ml-2 text-sm" style={{ color: "#87B5A7" }}>Searching Gong calls...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <XCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "#D9534F" }} />
              <p className="text-sm" style={{ color: "#D9534F" }}>{error}</p>
            </div>
          )}

          {calls && calls.length === 0 && (
            <div className="text-center py-12">
              <Phone className="w-8 h-8 mx-auto mb-2" style={{ color: "#B9CDC7" }} />
              <p className="text-sm font-semibold" style={{ color: "#87B5A7" }}>
                No calls found for this account
              </p>
              <p className="text-xs mt-1" style={{ color: "#B9CDC7" }}>
                No Gong calls matching "{csql.accountName}" in the 180 days before the CSQL was created
              </p>
            </div>
          )}

          {calls && calls.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold mb-3" style={{ color: "#87B5A7" }}>
                {calls.length} call{calls.length !== 1 ? 's' : ''} found
              </p>
              {calls.map((call) => (
                <div
                  key={call.conversationId}
                  className="rounded-xl p-4 border transition-colors hover:shadow-sm"
                  style={{ borderColor: "#EEE9E1", backgroundColor: call.alreadyAnalyzed ? "#FAFAF8" : "white" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#87B5A7" }} />
                        <span className="text-sm font-semibold truncate" style={{ color: "#242424" }}>
                          {call.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: "#87B5A7" }}>
                        <span>{new Date(call.callDate).toLocaleDateString()}</span>
                        <span>&middot;</span>
                        <span>{call.csmName}</span>
                        <span>&middot;</span>
                        <span>{call.durationMins} min</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {call.alreadyAnalyzed ? (
                        <>
                          <ScoreBadge score={call.assessmentScore} />
                          {replaceMode && call.assessmentId && onSelectCall ? (
                            <button
                              onClick={async () => {
                                setSelectingId(call.conversationId);
                                try {
                                  await onSelectCall(call.assessmentId!);
                                } catch (e: any) {
                                  console.error('Override failed:', e?.message || e);
                                  alert(`Failed to replace call: ${e?.message || 'Unknown error'}`);
                                } finally {
                                  setSelectingId(null);
                                }
                              }}
                              disabled={selectingId === call.conversationId || (csql.linkedAssessment?.assessmentId === call.assessmentId)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors hover:shadow-sm disabled:opacity-50"
                              style={{
                                backgroundColor: csql.linkedAssessment?.assessmentId === call.assessmentId ? "#F0F0F0" : "#E7F6EE",
                                color: csql.linkedAssessment?.assessmentId === call.assessmentId ? "#999" : "#248567",
                              }}
                            >
                              {selectingId === call.conversationId ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                              ) : csql.linkedAssessment?.assessmentId === call.assessmentId ? (
                                <><CheckCircle className="w-3 h-3" /> Current</>
                              ) : (
                                <><ArrowLeftRight className="w-3 h-3" /> Select</>
                              )}
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {call.assessmentId && onViewAssessment && (
                                <button
                                  onClick={() => onViewAssessment(call.assessmentId!)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors hover:shadow-sm"
                                  style={{ backgroundColor: "#EEF0FF", color: "#4A5ABA" }}
                                >
                                  <Eye className="w-3 h-3" />
                                  View
                                </button>
                              )}
                              {call.assessmentId && !replaceMode && (
                                csql.linkedAssessment?.assessmentId === call.assessmentId ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase" style={{ backgroundColor: "#E7F6EE", color: "#248567" }}>
                                    <CheckCircle className="w-3 h-3" />
                                    Linked
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => call.assessmentId && linkCallToCSQL(call.assessmentId, call.conversationId)}
                                    disabled={linkingId === call.conversationId}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors hover:shadow-sm disabled:opacity-50"
                                    style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
                                  >
                                    {linkingId === call.conversationId ? (
                                      <><Loader2 className="w-3 h-3 animate-spin" /> Linking...</>
                                    ) : (
                                      <><Link className="w-3 h-3" /> Link Score</>
                                    )}
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={async () => {
                            setAnalyzingId(call.conversationId);
                            analyzeMutation.mutate([call.conversationId], {
                              onSuccess: async (result) => {
                                const assessmentId = result.results?.[0]?.assessmentId;
                                if (assessmentId && !replaceMode) {
                                  try {
                                    await fetch("/api/csql/override", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      credentials: "include",
                                      body: JSON.stringify({ oppId: csql.oppId, assessmentId }),
                                    });
                                    queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/csql-unscored-count"] });
                                  } catch (err) {
                                    console.error("Failed to auto-link call to CSQL:", err);
                                  }
                                }
                                setAnalyzingId(null);
                                await refetchCalls();
                              },
                              onError: () => {
                                setAnalyzingId(null);
                              },
                            });
                          }}
                          disabled={analyzingId === call.conversationId}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:shadow-sm disabled:opacity-50"
                          style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
                        >
                          {analyzingId === call.conversationId ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <BarChart3 className="w-3 h-3" />
                              Analyze
                            </>
                          )}
                        </button>
                      )}
                      <a
                        href={call.callUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                        title="Open in Gong"
                      >
                        <ExternalLink className="w-3.5 h-3.5" style={{ color: "#87B5A7" }} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t flex justify-end" style={{ borderColor: "#EEE9E1" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ backgroundColor: "#F8F5F0", color: "#87B5A7" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const StageVelocityChart: React.FC<{
  stageAverages: StageAverage[];
  perOpp: Record<string, number>;
  csqls: CSQLOutcome[];
  isLoading: boolean;
}> = ({ stageAverages, perOpp, csqls, isLoading }) => {
  const stripPrefix = (s: string) => s.replace(/^\([^)]+\)\s*/, "");
  const ORDERED_STAGES = ["(0) Prospect", "(1) Discovery", "(2) Value & Solution", "(3) Validate", "(4) Negotiate"];

  const openByStage = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const c of csqls) {
      if (c.closedStatus === "Open") {
        const days = perOpp[c.oppId];
        if (days != null) {
          if (!map[c.stageName]) map[c.stageName] = [];
          map[c.stageName].push(days);
        }
      }
    }
    return map;
  }, [csqls, perOpp]);

  const avgMap = useMemo(() => {
    const m: Record<string, { avgDaysWon: number | null; avgDaysLost: number | null; wonCount: number; lostCount: number }> = {};
    for (const s of stageAverages) {
      m[s.stage] = { avgDaysWon: s.avgDaysWon, avgDaysLost: s.avgDaysLost, wonCount: s.wonCount, lostCount: s.lostCount };
    }
    return m;
  }, [stageAverages]);

  const chartData = useMemo(() => {
    const stagesWithData = [...ORDERED_STAGES].filter(s => avgMap[s] || openByStage[s]);
    return stagesWithData.map(s => {
      const avgs = avgMap[s] ?? { avgDaysWon: null, avgDaysLost: null, wonCount: 0, lostCount: 0 };
      const openList = openByStage[s] ?? [];
      const currentOpenAvg = openList.length ? Math.round(openList.reduce((a, b) => a + b, 0) / openList.length) : null;
      return {
        stage: stripPrefix(s),
        wonAvg: avgs.avgDaysWon,
        lostAvg: avgs.avgDaysLost,
        currentOpenAvg,
        wonCount: avgs.wonCount,
        lostCount: avgs.lostCount,
        openCount: openList.length,
      };
    });
  }, [avgMap, openByStage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#87B5A7" }} />
        <span className="ml-2 text-sm" style={{ color: "#87B5A7" }}>Loading stage history…</span>
      </div>
    );
  }
  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm" style={{ color: "#87B5A7" }}>
        No stage velocity data available
      </div>
    );
  }

  const maxDays = Math.max(0, ...chartData.flatMap(d => [d.wonAvg ?? 0, d.lostAvg ?? 0, d.currentOpenAvg ?? 0]));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs mb-3" style={{ color: "#878787" }}>
          Average days deals spend in each stage, comparing won vs lost outcomes. Open deals show current time in stage.
        </p>
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 58)}>
          <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 40, left: 10, bottom: 4 }} barGap={3} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEE9E1" />
            <XAxis type="number" domain={[0, Math.ceil(maxDays * 1.1) || 60]} tickFormatter={v => `${v}d`} tick={{ fontSize: 10, fill: "#87B5A7" }} />
            <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 11, fill: "#5C5C5C" }} />
            <Tooltip
              formatter={(value: any, name: string) => [`${value} days`, name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EEE9E1" }}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="wonAvg" name="Won avg" fill="#248567" radius={[0, 3, 3, 0]}>
              <LabelList dataKey="wonAvg" position="right" formatter={(v: any) => v != null ? `${v}d` : ""} style={{ fontSize: 10, fill: "#248567" }} />
            </Bar>
            <Bar dataKey="lostAvg" name="Lost avg" fill="#D9534F" radius={[0, 3, 3, 0]}>
              <LabelList dataKey="lostAvg" position="right" formatter={(v: any) => v != null ? `${v}d` : ""} style={{ fontSize: 10, fill: "#D9534F" }} />
            </Bar>
            <Bar dataKey="currentOpenAvg" name="Current open" fill="#4B8FD4" radius={[0, 3, 3, 0]}>
              <LabelList dataKey="currentOpenAvg" position="right" formatter={(v: any) => v != null ? `${v}d` : ""} style={{ fontSize: 10, fill: "#4B8FD4" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid #EEE9E1" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: "#F8F5F0" }}>
              <th className="px-4 py-2 text-left font-bold" style={{ color: "#87B5A7" }}>Stage</th>
              <th className="px-3 py-2 text-center font-bold" style={{ color: "#248567" }}>Won avg (days)</th>
              <th className="px-3 py-2 text-center font-bold" style={{ color: "#D9534F" }}>Lost avg (days)</th>
              <th className="px-3 py-2 text-center font-bold" style={{ color: "#248567" }}>Won deals</th>
              <th className="px-3 py-2 text-center font-bold" style={{ color: "#D9534F" }}>Lost deals</th>
              <th className="px-3 py-2 text-center font-bold" style={{ color: "#4B8FD4" }}>Open now</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, i) => (
              <tr key={row.stage} className="border-t" style={{ borderColor: "#EEE9E1", backgroundColor: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <td className="px-4 py-2 font-semibold" style={{ color: "#242424" }}>{row.stage}</td>
                <td className="px-3 py-2 text-center font-mono" style={{ color: "#248567" }}>{row.wonAvg != null ? `${row.wonAvg}d` : "—"}</td>
                <td className="px-3 py-2 text-center font-mono" style={{ color: "#D9534F" }}>{row.lostAvg != null ? `${row.lostAvg}d` : "—"}</td>
                <td className="px-3 py-2 text-center" style={{ color: "#5C5C5C" }}>{row.wonCount}</td>
                <td className="px-3 py-2 text-center" style={{ color: "#5C5C5C" }}>{row.lostCount}</td>
                <td className="px-3 py-2 text-center font-semibold" style={{ color: "#4B8FD4" }}>{row.openCount > 0 ? `${row.openCount} (avg ${row.currentOpenAvg}d)` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CSQLOutcomes: React.FC<CSQLOutcomesProps> = ({ onViewAssessment }) => {
  const { data, isLoading, error, refetch, isFetching } = useCSQLOutcomes();
  const [sortField, setSortField] = useState<string>("createdDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [stageFilter, setStageFilter] = useState<Set<string>>(new Set());
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [linkedFilter, setLinkedFilter] = useState<string>("all");
  const [callProximityFilter, setCallProximityFilter] = useState<string>("all");
  const [matchFilter, setMatchFilter] = useState<Set<string>>(new Set());
  const [matchDropdownOpen, setMatchDropdownOpen] = useState(false);
  const [dealSizeFilter, setDealSizeFilter] = useState<Set<string>>(new Set());
  const [dealSizeDropdownOpen, setDealSizeDropdownOpen] = useState(false);
  const [csmFilter, setCsmFilter] = useState<Set<string>>(new Set());
  const [csmDropdownOpen, setCsmDropdownOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<string>("quarter");
  const stageHistoryDateRange = useMemo(() => {
    if (timePeriod === "all") return { from: undefined, to: undefined };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: Date;
    let end: Date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    switch (timePeriod) {
      case "week": { const d = today.getDay(); const diff = d === 0 ? 6 : d - 1; start = new Date(today); start.setDate(today.getDate() - diff); break; }
      case "month": { start = new Date(today.getFullYear(), today.getMonth(), 1); break; }
      case "quarter": { const q = Math.floor(today.getMonth() / 3); start = new Date(today.getFullYear(), q * 3, 1); break; }
      case "prev_quarter": { const q = Math.floor(today.getMonth() / 3); const pq = q === 0 ? 3 : q - 1; const py = q === 0 ? today.getFullYear() - 1 : today.getFullYear(); start = new Date(py, pq * 3, 1); end = new Date(py, pq * 3 + 3, 0, 23, 59, 59, 999); break; }
      case "year": { start = new Date(today.getFullYear(), 0, 1); break; }
      case "prev_year": { start = new Date(today.getFullYear() - 1, 0, 1); end = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999); break; }
      default: return { from: undefined, to: undefined };
    }
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }, [timePeriod]);
  const { data: stageHistoryData, isLoading: stageHistoryLoading } = useCSQLStageHistory(stageHistoryDateRange.from, stageHistoryDateRange.to);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [chartTab, setChartTab] = useState<"overview" | "trends" | "move" | "timing" | "velocity" | "reps" | "insights">("overview");
  const [findCallsFor, setFindCallsFor] = useState<CSQLOutcome | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoScoring, setAutoScoring] = useState(false);
  const [autoScoreProgress, setAutoScoreProgress] = useState<{
    total: number; scored: number; failed: number; skipped: number; current: string;
  } | null>(null);
  const [autoScoreDone, setAutoScoreDone] = useState(false);

  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsData, setInsightsData] = useState<{
    keyInsights: { title: string; detail: string }[];
    winLossPatterns: { summary: string; criticalDimensions: { dimension: string; finding: string }[]; scoreThresholds: string; recommendations: string };
  } | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsTab, setInsightsTab] = useState<"insights" | "patterns">("insights");
  const [analyzingMatches, setAnalyzingMatches] = useState(false);
  const [matchAnalysisProgress, setMatchAnalysisProgress] = useState<{ done: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stageDropdownRef = useRef<HTMLDivElement>(null);
  const matchDropdownRef = useRef<HTMLDivElement>(null);
  const dealSizeDropdownRef = useRef<HTMLDivElement>(null);
  const csmDropdownRef = useRef<HTMLDivElement>(null);
  const analyticsFilterBarRef = useRef<HTMLDivElement>(null);
  const [analyticsOpenDropdown, setAnalyticsOpenDropdown] = useState<string | null>(null);
  const [analyticsShowAdvanced, setAnalyticsShowAdvanced] = useState(false);
  const queryClient = useQueryClient();

  const toggleSelect = useCallback((oppId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(oppId)) next.delete(oppId);
      else next.add(oppId);
      return next;
    });
  }, []);

  const startAutoScore = useCallback(async () => {
    setAutoScoring(true);
    setAutoScoreDone(false);
    setAutoScoreProgress({ total: 0, scored: 0, failed: 0, skipped: 0, current: 'Starting...' });

    const controller = new AbortController();
    abortRef.current = controller;

    const oppIds = selectedIds.size > 0 ? Array.from(selectedIds) : null;

    try {
      const response = await fetch('/api/csql/auto-score', {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oppIds }),
      });

      if (!response.ok || !response.body) {
        setAutoScoreProgress(prev => prev ? { ...prev, current: 'Failed to start auto-scoring' } : null);
        setAutoScoreDone(true);
        setAutoScoring(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'progress' || event.type === 'scored') {
              setAutoScoreProgress({
                total: event.total,
                scored: event.scored,
                failed: event.failed,
                skipped: event.skipped,
                current: event.current || event.accountName || '',
              });
            } else if (event.type === 'complete') {
              setAutoScoreProgress({
                total: event.total,
                scored: event.scored,
                failed: event.failed,
                skipped: event.skipped,
                current: event.message,
              });
              setAutoScoreDone(true);
              setSelectedIds(new Set());
              queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
              queryClient.invalidateQueries({ queryKey: ["/api/csql-unscored-count"] });
            } else if (event.type === 'error') {
              setAutoScoreProgress(prev => prev ? { ...prev, current: event.message } : null);
              setAutoScoreDone(true);
            } else if (event.type === 'status') {
              setAutoScoreProgress(prev => prev ? { ...prev, current: event.message } : null);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setAutoScoreProgress(prev => prev ? { ...prev, current: 'Connection error' } : null);
        setAutoScoreDone(true);
      }
    }

    setAutoScoring(false);
    abortRef.current = null;
  }, [queryClient, selectedIds]);

  const cancelAutoScore = useCallback(() => {
    abortRef.current?.abort();
    setAutoScoring(false);
    setAutoScoreDone(true);
    queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/csql-unscored-count"] });
  }, [queryClient]);

  const handleOverrideCall = useCallback(async (oppId: string, assessmentId: number) => {
    const response = await fetch('/api/csql/override', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oppId, assessmentId }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Override failed (${response.status})`);
    }
    const result = await response.json();
    await queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/csql-unscored-count"] });
    setFindCallsFor(null);
    setReplaceMode(false);
    const scoreText = result.totalScore != null ? `New score: ${result.totalScore}/20` : 'Score replaced';
    setOverrideSuccess(scoreText);
    setTimeout(() => setOverrideSuccess(null), 4000);
  }, [queryClient]);

  const handleUndoOverride = useCallback(async (oppId: string) => {
    const response = await fetch(`/api/csql/override/${encodeURIComponent(oppId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to undo override');
    await queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/csql-unscored-count"] });
  }, [queryClient]);

  const getTimePeriodRange = useCallback((period: string): { start: Date; end: Date } | null => {
    if (period === "all") return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: Date;
    let end: Date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    switch (period) {
      case "week": {
        const day = today.getDay();
        const diff = day === 0 ? 6 : day - 1;
        start = new Date(today);
        start.setDate(today.getDate() - diff);
        break;
      }
      case "month": {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      }
      case "quarter": {
        const q = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), q * 3, 1);
        break;
      }
      case "prev_quarter": {
        const q = Math.floor(today.getMonth() / 3);
        const pq = q === 0 ? 3 : q - 1;
        const py = q === 0 ? today.getFullYear() - 1 : today.getFullYear();
        start = new Date(py, pq * 3, 1);
        end = new Date(py, pq * 3 + 3, 0, 23, 59, 59, 999);
        break;
      }
      case "year": {
        start = new Date(today.getFullYear(), 0, 1);
        break;
      }
      case "prev_year": {
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;
      }
      default:
        return null;
    }
    return { start, end };
  }, []);

  const timeFilteredCSQLs = useMemo(() => {
    if (!data?.csqls) return [];
    const range = getTimePeriodRange(timePeriod);
    if (!range) return data.csqls;
    return data.csqls.filter(c => {
      const d = new Date(c.createdDate);
      return d >= range.start && d <= range.end;
    });
  }, [data?.csqls, timePeriod, getTimePeriodRange]);

  const baseFilteredCSQLs = useMemo(() => {
    let list = timeFilteredCSQLs;
    if (csmFilter.size > 0) {
      list = list.filter(c => csmFilter.has(c.createdByName ?? ""));
    }
    if (stageFilter.size > 0) {
      list = list.filter(c => stageFilter.has(c.stageName));
    }
    if (linkedFilter === "linked") {
      list = list.filter(c => c.linkedAssessment != null);
    } else if (linkedFilter === "unlinked") {
      list = list.filter(c => c.linkedAssessment == null);
    }
    if (callProximityFilter !== "all") {
      const maxDays = parseInt(callProximityFilter, 10);
      list = list.filter(c => {
        if (!c.linkedAssessment?.callDate || !c.createdDate) return true;
        const callMs = new Date(c.linkedAssessment.callDate).getTime();
        const createdMs = new Date(c.createdDate).getTime();
        const diffDays = Math.abs(callMs - createdMs) / (1000 * 60 * 60 * 24);
        return diffDays <= maxDays;
      });
    }
    if (matchFilter.size > 0) {
      list = list.filter(c => {
        const conf = c.matchConfidence?.confidence ?? "none";
        return matchFilter.has(conf);
      });
    }
    if (dealSizeFilter.size > 0) {
      list = list.filter(c => dealSizeFilter.has(getDealSizeBucket(c.amount)));
    }
    return list;
  }, [timeFilteredCSQLs, csmFilter, stageFilter, linkedFilter, callProximityFilter, matchFilter, dealSizeFilter]);

  const analyticsCSQLs = useMemo(() => {
    return baseFilteredCSQLs.map(c =>
      c.isExcluded ? { ...c, linkedAssessment: null } : c
    );
  }, [baseFilteredCSQLs]);

  const availableCSMs = useMemo(() => {
    const names = new Set(timeFilteredCSQLs.map(c => c.createdByName).filter(Boolean));
    return [...names].sort();
  }, [timeFilteredCSQLs]);

  const filteredSummary = useMemo((): CSQLSummary | null => {
    if (!data?.summary) return null;
    const hasExclusions = analyticsCSQLs.some(c => c.isExcluded);
    const hasFilters = timePeriod !== "all" || csmFilter.size > 0 || stageFilter.size > 0 || linkedFilter !== "all" || callProximityFilter !== "all" || matchFilter.size > 0 || hasExclusions;
    if (!hasFilters) return data.summary;
    const csqls = analyticsCSQLs;
    const closedWon = csqls.filter(c => c.closedStatus === "Closed Won");
    const closedLost = csqls.filter(c => c.closedStatus === "Closed Lost");
    const openDeals = csqls.filter(c => c.closedStatus === "Open");
    const totalPipeline = csqls.reduce((sum, c) => sum + (c.amount || 0), 0);
    const wonPipeline = closedWon.reduce((sum, c) => sum + (c.amount || 0), 0);
    const linkedScores = csqls.filter(c => c.linkedAssessment?.totalScore != null).map(c => c.linkedAssessment!.totalScore!);
    const avgLinkedScore = linkedScores.length ? Math.round((linkedScores.reduce((a, b) => a + b, 0) / linkedScores.length) * 10) / 10 : null;
    const wonScores = closedWon.filter(c => c.linkedAssessment?.totalScore != null).map(c => c.linkedAssessment!.totalScore!);
    const lostScores = closedLost.filter(c => c.linkedAssessment?.totalScore != null).map(c => c.linkedAssessment!.totalScore!);
    const avgWonScore = wonScores.length ? Math.round((wonScores.reduce((a, b) => a + b, 0) / wonScores.length) * 10) / 10 : null;
    const avgLostScore = lostScores.length ? Math.round((lostScores.reduce((a, b) => a + b, 0) / lostScores.length) * 10) / 10 : null;
    const closedTotal = closedWon.length + closedLost.length;
    const winRate = closedTotal > 0 ? Math.round((closedWon.length / closedTotal) * 100) : null;
    const stageDistribution: Record<string, { count: number; pipeline: number }> = {};
    for (const c of csqls) {
      if (!stageDistribution[c.stageName]) stageDistribution[c.stageName] = { count: 0, pipeline: 0 };
      stageDistribution[c.stageName].count++;
      stageDistribution[c.stageName].pipeline += c.amount || 0;
    }
    return {
      totalCSQLs: csqls.length,
      linkedCount: csqls.filter(c => c.linkedAssessment != null).length,
      closedWonCount: closedWon.length,
      closedLostCount: closedLost.length,
      openCount: openDeals.length,
      totalPipeline,
      wonPipeline,
      avgLinkedScore,
      avgWonScore,
      avgLostScore,
      winRate,
      stageDistribution,
    };
  }, [analyticsCSQLs, timePeriod, csmFilter, stageFilter, linkedFilter, callProximityFilter, matchFilter, data?.summary]);

  const availableStages = useMemo(() => {
    const csqls = timeFilteredCSQLs;
    if (!csqls.length) return [];
    const stages = new Set(csqls.map(c => c.stageName));
    const ordered = STAGE_ORDER.filter(s => stages.has(s));
    const remaining = [...stages].filter(s => !STAGE_ORDER.includes(s as string)).sort();
    return [...ordered, ...remaining];
  }, [timeFilteredCSQLs]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target as Node)) {
        setStageDropdownOpen(false);
      }
      if (matchDropdownRef.current && !matchDropdownRef.current.contains(e.target as Node)) {
        setMatchDropdownOpen(false);
      }
      if (dealSizeDropdownRef.current && !dealSizeDropdownRef.current.contains(e.target as Node)) {
        setDealSizeDropdownOpen(false);
      }
      if (csmDropdownRef.current && !csmDropdownRef.current.contains(e.target as Node)) {
        setCsmDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!analyticsOpenDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (analyticsFilterBarRef.current && !analyticsFilterBarRef.current.contains(e.target as Node)) {
        setAnalyticsOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [analyticsOpenDropdown]);

  useEffect(() => {
    if (stageFilter.size > 0 && availableStages.length > 0) {
      const valid = new Set([...stageFilter].filter(s => availableStages.includes(s)));
      if (valid.size !== stageFilter.size) {
        setStageFilter(valid);
      }
    }
  }, [availableStages, stageFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (timePeriod !== "all") count++;
    if (csmFilter.size > 0) count++;
    if (stageFilter.size > 0) count++;
    if (linkedFilter !== "all") count++;
    if (callProximityFilter !== "all") count++;
    if (matchFilter.size > 0) count++;
    if (dealSizeFilter.size > 0) count++;
    return count;
  }, [timePeriod, csmFilter, stageFilter, linkedFilter, callProximityFilter, matchFilter, dealSizeFilter]);

  const clearAllFilters = useCallback(() => {
    setTimePeriod("quarter");
    setCsmFilter(new Set());
    setStageFilter(new Set());
    setLinkedFilter("all");
    setCallProximityFilter("all");
    setMatchFilter(new Set());
    setDealSizeFilter(new Set());
  }, []);

  const PERIOD_LABELS: Record<string, string> = {
    week: "This Week", month: "This Month", quarter: "This Quarter",
    prev_quarter: "Last Quarter", year: "This Year", prev_year: "Last Year", all: "All Time",
  };

  const summaryLabel = useMemo(() => {
    if (!filteredSummary) return null;
    const label = PERIOD_LABELS[timePeriod] ?? "All Time";
    const pipeline = filteredSummary.totalPipeline >= 1_000_000
      ? `$${(filteredSummary.totalPipeline / 1_000_000).toFixed(1)}M`
      : filteredSummary.totalPipeline >= 1_000
        ? `$${(filteredSummary.totalPipeline / 1_000).toFixed(0)}K`
        : `$${filteredSummary.totalPipeline.toFixed(0)}`;
    const wrPart = filteredSummary.winRate != null ? ` · ${filteredSummary.winRate}% win rate on closed deals` : "";
    return `${label}: ${filteredSummary.totalCSQLs} CSQLs (${pipeline} pipeline)${wrPart}.`;
  }, [filteredSummary, timePeriod]);

  const priorWinRate = useMemo(() => {
    if (!data?.csqls) return null;
    const priorPeriodKey: Record<string, string> = {
      quarter: "prev_quarter", year: "prev_year",
    };
    let range: { start: Date; end: Date } | null = null;
    if (priorPeriodKey[timePeriod]) {
      range = getTimePeriodRange(priorPeriodKey[timePeriod]);
    } else if (timePeriod === "month") {
      const now = new Date();
      range = {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    }
    if (!range) return null;
    const { start, end } = range;
    const prior = data.csqls.filter(c => {
      const d = new Date(c.createdDate);
      return d >= start && d <= end;
    });
    const won = prior.filter(c => c.closedStatus === "Closed Won").length;
    const lost = prior.filter(c => c.closedStatus === "Closed Lost").length;
    const total = won + lost;
    return total > 0 ? Math.round((won / total) * 100) : null;
  }, [data?.csqls, timePeriod, getTimePeriodRange]);

  const topPerformers = useMemo(() => {
    if (!analyticsCSQLs.length) return [];
    const byCSM = new Map<string, { won: number; lost: number; pipeline: number }>();
    for (const c of analyticsCSQLs) {
      const name = c.createdByName || "Unknown";
      if (!byCSM.has(name)) byCSM.set(name, { won: 0, lost: 0, pipeline: 0 });
      const e = byCSM.get(name)!;
      if (c.closedStatus === "Closed Won") e.won++;
      else if (c.closedStatus === "Closed Lost") e.lost++;
      e.pipeline += c.amount || 0;
    }
    const all = [...byCSM.entries()].map(([name, s]) => ({
      name,
      won: s.won,
      closed: s.won + s.lost,
      pipeline: s.pipeline,
      winRate: (s.won + s.lost) >= 2 ? Math.round((s.won / (s.won + s.lost)) * 100) : null,
    }));
    const withRate = all.filter(c => c.winRate !== null).sort((a, b) => b.winRate! - a.winRate!);
    const withoutRate = all.filter(c => c.winRate === null).sort((a, b) => b.pipeline - a.pipeline);
    return [...withRate, ...withoutRate].slice(0, 3);
  }, [analyticsCSQLs]);

  const advancedFilterCount = useMemo(() => {
    let c = 0;
    if (callProximityFilter !== "all") c++;
    if (dealSizeFilter.size > 0) c++;
    if (matchFilter.size > 0) c++;
    return c;
  }, [callProximityFilter, dealSizeFilter, matchFilter]);

  const filteredAndSorted = useMemo(() => {
    let list = [...baseFilteredCSQLs];

    const stageOrder: Record<string, number> = {};
    STAGE_ORDER.forEach((s, i) => { stageOrder[s] = i; });

    list.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "createdDate":
          aVal = a.createdDate;
          bVal = b.createdDate;
          break;
        case "amount":
          aVal = a.amount || 0;
          bVal = b.amount || 0;
          break;
        case "accountName":
          aVal = a.accountName.toLowerCase();
          bVal = b.accountName.toLowerCase();
          break;
        case "score":
          aVal = a.linkedAssessment?.totalScore ?? -1;
          bVal = b.linkedAssessment?.totalScore ?? -1;
          break;
        case "stageName":
          aVal = stageOrder[a.stageName] ?? 99;
          bVal = stageOrder[b.stageName] ?? 99;
          break;
        default:
          aVal = a.createdDate;
          bVal = b.createdDate;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [baseFilteredCSQLs, sortField, sortDir]);

  const exportToCSV = useCallback(() => {
    if (!filteredAndSorted.length) return;
    const headers = ["Opportunity Name", "Account", "CSM", "Amount", "Stage", "Status", "Created Date", "Close Date", "Call Score", "Call Date"];
    const rows = filteredAndSorted.map(c => [
      c.oppName, c.accountName, c.createdByName,
      c.amount != null ? c.amount.toString() : "",
      c.stageName, c.closedStatus,
      c.createdDate ? new Date(c.createdDate).toLocaleDateString() : "",
      c.closeDate ? new Date(c.closeDate).toLocaleDateString() : "",
      c.linkedAssessment?.totalScore != null ? c.linkedAssessment.totalScore.toString() : "",
      c.linkedAssessment?.callDate ? new Date(c.linkedAssessment.callDate).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `csql-outcomes-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredAndSorted]);

  const fetchInsights = useCallback(async () => {
    if (!analyticsCSQLs.length || !filteredSummary) return;
    setInsightsLoading(true);
    setInsightsError(null);
    setInsightsData(null);
    try {
      const filters = {
        timePeriod,
        csm: csmFilter.size > 0 ? [...csmFilter].join(", ") : undefined,
        stage: stageFilter.size > 0 ? [...stageFilter] : undefined,
        linked: linkedFilter !== "all" ? linkedFilter : undefined,
        callProximity: callProximityFilter !== "all" ? callProximityFilter : undefined,
        match: matchFilter.size > 0 ? [...matchFilter] : undefined,
      };
      const resp = await fetch("/api/csql-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          csqls: analyticsCSQLs,
          summary: filteredSummary,
          filters,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Failed to generate insights");
      }
      const result = await resp.json();
      setInsightsData(result);
    } catch (e: any) {
      setInsightsError(e?.message || "Failed to generate insights");
    } finally {
      setInsightsLoading(false);
    }
  }, [analyticsCSQLs, filteredSummary, timePeriod, csmFilter, stageFilter, linkedFilter, callProximityFilter, matchFilter]);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const visibleIds = filteredAndSorted.map(c => c.oppId);
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      }
    });
  }, [filteredAndSorted]);

  const analyzeMatches = useCallback(async () => {
    const toAnalyze = baseFilteredCSQLs.filter(
      c => c.linkedAssessment && !c.matchConfidence
    );
    if (toAnalyze.length === 0) return;

    setAnalyzingMatches(true);
    setMatchAnalysisProgress({ done: 0, total: toAnalyze.length });

    const CHUNK = 10;
    let done = 0;
    for (let i = 0; i < toAnalyze.length; i += CHUNK) {
      const chunk = toAnalyze.slice(i, i + CHUNK);
      const items = chunk.map(c => ({
        oppId: c.oppId,
        oppName: c.oppName,
        accountName: c.accountName,
        assessmentId: c.linkedAssessment!.assessmentId,
      }));

      try {
        await fetch("/api/csql-match-confidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ items }),
        });
      } catch (err) {
        console.error("Match confidence chunk error:", err);
      }

      done += chunk.length;
      setMatchAnalysisProgress({ done, total: toAnalyze.length });
    }

    setAnalyzingMatches(false);
    setMatchAnalysisProgress(null);
    queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
  }, [baseFilteredCSQLs, queryClient]);

  const unanalyzedMatchCount = useMemo(() => {
    return baseFilteredCSQLs.filter(c => c.linkedAssessment && !c.matchConfidence).length;
  }, [baseFilteredCSQLs]);

  const [togglingExclusion, setTogglingExclusion] = useState<Set<string>>(new Set());
  const [matchPopoverOpen, setMatchPopoverOpen] = useState<string | null>(null);
  const [settingMatch, setSettingMatch] = useState<Set<string>>(new Set());
  const matchPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchPopoverOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (matchPopoverRef.current && !matchPopoverRef.current.contains(e.target as Node)) {
        setMatchPopoverOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [matchPopoverOpen]);

  const handleSetMatchConfidence = useCallback(async (oppId: string, assessmentId: number, confidence: "green" | "yellow" | "red") => {
    setSettingMatch(prev => new Set(prev).add(oppId));
    try {
      const resp = await fetch("/api/csql/set-match-confidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oppId, assessmentId, confidence }),
      });
      if (!resp.ok) throw new Error("Failed to set match confidence");
      queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
    } catch (err) {
      console.error("Set match confidence error:", err);
    } finally {
      setSettingMatch(prev => {
        const next = new Set(prev);
        next.delete(oppId);
        return next;
      });
      setMatchPopoverOpen(null);
    }
  }, [queryClient]);

  const handleResetMatchConfidence = useCallback(async (oppId: string) => {
    setSettingMatch(prev => new Set(prev).add(oppId));
    try {
      const resp = await fetch(`/api/csql/reset-match-confidence/${encodeURIComponent(oppId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Failed to reset match confidence");
      queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
    } catch (err) {
      console.error("Reset match confidence error:", err);
    } finally {
      setSettingMatch(prev => {
        const next = new Set(prev);
        next.delete(oppId);
        return next;
      });
      setMatchPopoverOpen(null);
    }
  }, [queryClient]);

  const handleToggleExclusion = useCallback(async (oppId: string) => {
    setTogglingExclusion(prev => new Set(prev).add(oppId));
    try {
      const resp = await fetch("/api/csql/toggle-exclusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oppId }),
      });
      if (!resp.ok) throw new Error("Failed to toggle exclusion");
      queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/csql-unscored-count"] });
    } catch (err) {
      console.error("Toggle exclusion error:", err);
    } finally {
      setTogglingExclusion(prev => {
        const next = new Set(prev);
        next.delete(oppId);
        return next;
      });
    }
  }, [queryClient]);

  const allVisibleSelected = filteredAndSorted.length > 0 && filteredAndSorted.every(c => selectedIds.has(c.oppId));
  const someVisibleSelected = filteredAndSorted.some(c => selectedIds.has(c.oppId));

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon: React.FC<{ field: string }> = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-40 rounded-md" style={{ backgroundColor: "#EEE9E1" }} />
            <div className="h-3 w-72 rounded-md mt-2" style={{ backgroundColor: "#F5F0EB" }} />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: "#EEE9E1" }} />
            <div className="h-8 w-24 rounded-lg" style={{ backgroundColor: "#EEE9E1" }} />
            <div className="h-8 w-24 rounded-lg" style={{ backgroundColor: "#EEE9E1" }} />
          </div>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg" style={{ backgroundColor: "#F5F0EB" }} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4" style={{ backgroundColor: "#FAFAF8", border: "1px solid #EEE9E1" }}>
              <div className="h-3 w-16 rounded mb-3" style={{ backgroundColor: "#EEE9E1" }} />
              <div className="h-7 w-20 rounded" style={{ backgroundColor: "#EEE9E1" }} />
              <div className="h-2 w-24 rounded mt-2" style={{ backgroundColor: "#F5F0EB" }} />
            </div>
          ))}
        </div>
        <div className="rounded-xl p-5" style={{ backgroundColor: "#FAFAF8", border: "1px solid #EEE9E1" }}>
          <div className="h-4 w-32 rounded mb-4" style={{ backgroundColor: "#EEE9E1" }} />
          <div className="h-48 w-full rounded-lg" style={{ backgroundColor: "#F5F0EB" }} />
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
          <div className="px-4 py-3" style={{ backgroundColor: "#F8F5F0" }}>
            <div className="flex gap-8">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-3 rounded" style={{ backgroundColor: "#EEE9E1", width: `${60 + Math.random() * 40}px` }} />
              ))}
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-8 px-4 py-3" style={{ borderBottom: "1px solid #F5F0EB" }}>
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="h-3 rounded" style={{ backgroundColor: i % 2 === 0 ? "#F5F0EB" : "#FAFAF8", width: `${50 + Math.random() * 50}px` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <XCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#D9534F" }} />
        <p className="text-sm font-semibold" style={{ color: "#D9534F" }}>
          Failed to load CSQL outcomes
        </p>
        <p className="text-xs mt-1" style={{ color: "#B9CDC7" }}>
          {(error as Error).message}
        </p>
      </div>
    );
  }

  if (!data || data.csqls.length === 0) {
    return (
      <div className="text-center py-16">
        <DollarSign className="w-12 h-12 mx-auto mb-3" style={{ color: "#B9CDC7" }} />
        <p className="text-sm font-semibold" style={{ color: "#87B5A7" }}>
          No CSQLs found
        </p>
        <p className="text-xs mt-1" style={{ color: "#B9CDC7" }}>
          CSQLs will appear here when CSMs create opportunities in Salesforce
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#242424" }}>
            CSQL Outcomes
          </h2>
          <p className="text-xs mt-1" style={{ color: "#87B5A7" }}>
            Opportunities created by CSMs linked to their most recent qualifying call score
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching || autoScoring}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: "#F5F0EB",
              color: "#248567",
              opacity: isFetching ? 0.6 : 1,
            }}
            title="Refresh data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={exportToCSV}
            disabled={!filteredAndSorted.length}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ backgroundColor: "#F5F0EB", color: "#4A5ABA", opacity: filteredAndSorted.length ? 1 : 0.4 }}
            title="Download filtered data as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={startAutoScore}
            disabled={autoScoring}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: autoScoring ? "#B9CDC7" : "#248567",
              color: "#fff",
              opacity: autoScoring ? 0.7 : 1,
            }}
          >
            {autoScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {autoScoring ? "Scoring..." : selectedIds.size > 0 ? `Score Selected (${selectedIds.size})` : "Score All"}
          </button>
          <button
            onClick={analyzeMatches}
            disabled={analyzingMatches || unanalyzedMatchCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: analyzingMatches ? "#B9CDC7" : unanalyzedMatchCount === 0 ? "#E5E7EB" : "#7C5ABF",
              color: "#fff",
              opacity: analyzingMatches ? 0.7 : 1,
            }}
          >
            {analyzingMatches ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            {analyzingMatches
              ? `Analyzing ${matchAnalysisProgress?.done || 0}/${matchAnalysisProgress?.total || 0}`
              : unanalyzedMatchCount > 0
                ? `Analyze Matches (${unanalyzedMatchCount})`
                : "All Matched"}
          </button>
        </div>
      </div>

      {summaryLabel && (
        <p className="text-sm px-1" style={{ color: "#87B5A7" }}>{summaryLabel}</p>
      )}

      {filteredSummary && <SummaryCards summary={filteredSummary} priorWinRate={priorWinRate} />}


      {filteredSummary && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
            style={{ backgroundColor: "#F5F0EB" }}
            onClick={() => setShowCharts(!showCharts)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#248567" }} />
              <span className="text-sm font-bold flex-shrink-0" style={{ color: "#242424" }}>Analytics</span>
              {(timePeriod !== "all" || csmFilter.size > 0 || stageFilter.size > 0 || linkedFilter !== "all" || callProximityFilter !== "all" || dealSizeFilter.size > 0 || matchFilter.size > 0) && (
                <span className="text-[10px] truncate" style={{ color: "#87B5A7" }}>
                  {[
                    timePeriod !== "all" ? (PERIOD_LABELS[timePeriod] ?? timePeriod) : null,
                    csmFilter.size > 0 ? `${csmFilter.size} CSM${csmFilter.size > 1 ? "s" : ""}` : null,
                    stageFilter.size > 0 ? `${stageFilter.size} Stage${stageFilter.size > 1 ? "s" : ""}` : null,
                    linkedFilter !== "all" ? (linkedFilter === "linked" ? "With Score" : "No Score") : null,
                    callProximityFilter !== "all" ? `≤ ${callProximityFilter} day${callProximityFilter === "1" ? "" : "s"}` : null,
                    dealSizeFilter.size > 0 ? `${dealSizeFilter.size} Amount${dealSizeFilter.size > 1 ? "s" : ""}` : null,
                    matchFilter.size > 0 ? `${matchFilter.size} Match type${matchFilter.size > 1 ? "s" : ""}` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 p-0.5 rounded-md" style={{ backgroundColor: "rgba(0,0,0,0.04)" }}>
                {([
                  { key: "overview" as const, label: "Overview", icon: <BarChart3 className="w-3 h-3" /> },
                  { key: "trends" as const, label: "Trends", icon: <TrendingUp className="w-3 h-3" /> },
                  { key: "move" as const, label: "MOVE", icon: <Target className="w-3 h-3" /> },
                  { key: "timing" as const, label: "Time to Close", icon: <Clock className="w-3 h-3" /> },
                  { key: "velocity" as const, label: "Stage Velocity", icon: <GitBranch className="w-3 h-3" /> },
                  { key: "reps" as const, label: "Reps", icon: <Users className="w-3 h-3" /> },
                  { key: "insights" as const, label: "AI Insights", icon: <Sparkles className="w-3 h-3" /> },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={(e) => { e.stopPropagation(); setChartTab(tab.key); if (!showCharts) setShowCharts(true); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all duration-150"
                    style={{
                      backgroundColor: chartTab === tab.key ? "#fff" : "transparent",
                      color: chartTab === tab.key ? (tab.key === "insights" ? "#7C3AED" : "#248567") : "#87B5A7",
                      boxShadow: chartTab === tab.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.key === "insights" && insightsData && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#7C3AED" }} />
                    )}
                  </button>
                ))}
              </div>
              {showCharts
                ? <ChevronUp className="w-4 h-4" style={{ color: "#87B5A7" }} />
                : <ChevronDown className="w-4 h-4" style={{ color: "#87B5A7" }} />
              }
            </div>
          </div>

          {showCharts && (
            <div className="p-4" style={{ backgroundColor: "#FAFAF8" }}>
              <div
                ref={analyticsFilterBarRef}
                className="flex flex-wrap items-center gap-2 mb-4 pb-3"
                style={{ borderBottom: "1px solid #EEE9E1", position: "relative" }}
              >
                <div className="flex items-center gap-1 p-0.5 rounded-full" style={{ backgroundColor: "#EEE9E1" }}>
                  {([
                    { value: "week", label: "1W" },
                    { value: "month", label: "1M" },
                    { value: "quarter", label: "This Q" },
                    { value: "prev_quarter", label: "Prev Q" },
                    { value: "year", label: "1Y" },
                    { value: "prev_year", label: "Prev Y" },
                    { value: "all", label: "All" },
                  ] as { value: string; label: string }[]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTimePeriod(opt.value)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150"
                      style={{
                        backgroundColor: timePeriod === opt.value ? "#fff" : "transparent",
                        color: timePeriod === opt.value ? "#248567" : "#87B5A7",
                        boxShadow: timePeriod === opt.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: "#D6CFC8" }} />
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" style={{ color: activeFilterCount > 0 ? "#248567" : "#C5BAB0" }} />
                  {activeFilterCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#E7F6EE", color: "#248567" }}>
                      {activeFilterCount}
                    </span>
                  )}
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors hover:bg-red-50"
                      style={{ color: "#E11D48" }}
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setAnalyticsOpenDropdown(v => v === "csm" ? null : "csm")}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                    style={{
                      borderColor: csmFilter.size > 0 ? "#248567" : "#EEE9E1",
                      color: "#242424",
                      backgroundColor: csmFilter.size > 0 ? "#F0FDF4" : "#fff",
                      minWidth: "100px",
                    }}
                  >
                    <span className="truncate">
                      {csmFilter.size === 0 ? "All CSMs" : csmFilter.size === 1 ? [...csmFilter][0] : `${csmFilter.size} CSMs`}
                    </span>
                    <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "#87B5A7" }} />
                  </button>
                  {analyticsOpenDropdown === "csm" && (
                    <div
                      className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
                      style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1", minWidth: "180px", maxHeight: "280px" }}
                    >
                      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid #F5F0EB" }}>
                        <span className="text-[10px] font-semibold" style={{ color: "#87B5A7" }}>{csmFilter.size} selected</span>
                        {csmFilter.size > 0 && (
                          <button onClick={() => setCsmFilter(new Set())} className="text-[10px] font-semibold" style={{ color: "#E11D48" }}>Clear</button>
                        )}
                      </div>
                      <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
                        {availableCSMs.map(name => (
                          <label key={name} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={csmFilter.has(name)}
                              onChange={() => setCsmFilter(prev => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; })}
                              className="w-3.5 h-3.5 rounded accent-[#248567] cursor-pointer"
                            />
                            <span className="text-xs" style={{ color: "#242424" }}>{name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setAnalyticsOpenDropdown(v => v === "stage" ? null : "stage")}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                    style={{
                      borderColor: stageFilter.size > 0 ? "#248567" : "#EEE9E1",
                      color: "#242424",
                      backgroundColor: stageFilter.size > 0 ? "#F0FDF4" : "#fff",
                      minWidth: "100px",
                    }}
                  >
                    <span className="truncate">
                      {stageFilter.size === 0 ? "All Stages" : stageFilter.size === 1 ? [...stageFilter][0] : `${stageFilter.size} Stages`}
                    </span>
                    <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "#87B5A7" }} />
                  </button>
                  {analyticsOpenDropdown === "stage" && (
                    <div
                      className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
                      style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1", minWidth: "200px", maxHeight: "260px" }}
                    >
                      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid #F5F0EB" }}>
                        <span className="text-[10px] font-semibold" style={{ color: "#87B5A7" }}>{stageFilter.size} selected</span>
                        {stageFilter.size > 0 && (
                          <button onClick={() => setStageFilter(new Set())} className="text-[10px] font-semibold" style={{ color: "#E11D48" }}>Clear</button>
                        )}
                      </div>
                      <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
                        {availableStages.map(stage => (
                          <label key={stage} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={stageFilter.has(stage)}
                              onChange={() => setStageFilter(prev => { const next = new Set(prev); if (next.has(stage)) next.delete(stage); else next.add(stage); return next; })}
                              className="w-3.5 h-3.5 rounded accent-[#248567] cursor-pointer"
                            />
                            <span className="text-xs" style={{ color: "#242424" }}>{stage}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <select
                  value={linkedFilter}
                  onChange={(e) => setLinkedFilter(e.target.value)}
                  className="px-2 py-1 rounded-lg text-xs border focus:outline-none"
                  style={{ borderColor: linkedFilter !== "all" ? "#248567" : "#EEE9E1", color: "#242424", backgroundColor: linkedFilter !== "all" ? "#F0FDF4" : "#fff" }}
                >
                  <option value="all">All CSQLs</option>
                  <option value="linked">With Call Score</option>
                  <option value="unlinked">Without Call Score</option>
                </select>
                <button
                  onClick={() => setAnalyticsShowAdvanced(v => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors"
                  style={{
                    borderColor: advancedFilterCount > 0 ? "#248567" : "#EEE9E1",
                    color: advancedFilterCount > 0 ? "#248567" : "#87B5A7",
                    backgroundColor: advancedFilterCount > 0 ? "#F0FDF4" : "#fff",
                  }}
                >
                  {advancedFilterCount > 0 ? `Advanced (${advancedFilterCount})` : "Advanced"}
                  {analyticsShowAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {analyticsShowAdvanced && (
                  <>
                    <select
                      value={callProximityFilter}
                      onChange={(e) => setCallProximityFilter(e.target.value)}
                      className="px-2 py-1 rounded-lg text-xs border focus:outline-none"
                      style={{ borderColor: callProximityFilter !== "all" ? "#248567" : "#EEE9E1", color: "#242424", backgroundColor: callProximityFilter !== "all" ? "#F0FDF4" : "#fff" }}
                    >
                      <option value="all">Any Timing</option>
                      <option value="1">≤ 1 day</option>
                      <option value="3">≤ 3 days</option>
                      <option value="7">≤ 7 days</option>
                      <option value="30">≤ 30 days</option>
                    </select>
                    <div className="relative">
                      <button
                        onClick={() => setAnalyticsOpenDropdown(v => v === "dealSize" ? null : "dealSize")}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                        style={{
                          borderColor: dealSizeFilter.size > 0 ? "#248567" : "#EEE9E1",
                          color: "#242424",
                          backgroundColor: dealSizeFilter.size > 0 ? "#F0FDF4" : "#fff",
                          minWidth: "110px",
                        }}
                      >
                        <span className="truncate">
                          {dealSizeFilter.size === 0
                            ? "All Amounts"
                            : dealSizeFilter.size === 1
                              ? (DEAL_SIZE_BUCKET_CONFIG.find(b => b.key === [...dealSizeFilter][0])?.label ?? [...dealSizeFilter][0])
                              : `${dealSizeFilter.size} Amounts`}
                        </span>
                        <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "#87B5A7" }} />
                      </button>
                      {analyticsOpenDropdown === "dealSize" && (
                        <div
                          className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
                          style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1", minWidth: "160px" }}
                        >
                          <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid #F5F0EB" }}>
                            <span className="text-[10px] font-semibold" style={{ color: "#87B5A7" }}>{dealSizeFilter.size} selected</span>
                            {dealSizeFilter.size > 0 && (
                              <button onClick={() => setDealSizeFilter(new Set())} className="text-[10px] font-semibold" style={{ color: "#E11D48" }}>Clear</button>
                            )}
                          </div>
                          <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
                            {DEAL_SIZE_BUCKET_CONFIG.map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={dealSizeFilter.has(key)}
                                  onChange={() => setDealSizeFilter(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })}
                                  className="w-3.5 h-3.5 rounded accent-[#248567] cursor-pointer"
                                />
                                <span className="text-xs" style={{ color: "#242424" }}>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setAnalyticsOpenDropdown(v => v === "match" ? null : "match")}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                        style={{
                          borderColor: matchFilter.size > 0 ? "#248567" : "#EEE9E1",
                          color: "#242424",
                          backgroundColor: matchFilter.size > 0 ? "#F0FDF4" : "#fff",
                          minWidth: "110px",
                        }}
                      >
                        <span className="truncate">
                          {matchFilter.size === 0
                            ? "All Matches"
                            : matchFilter.size === 1
                              ? ({ green: "Green", yellow: "Yellow", red: "Red", none: "Not Analyzed" } as Record<string,string>)[[...matchFilter][0]] ?? [...matchFilter][0]
                              : `${matchFilter.size} Match Types`}
                        </span>
                        <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "#87B5A7" }} />
                      </button>
                      {analyticsOpenDropdown === "match" && (
                        <div
                          className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
                          style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1", minWidth: "160px" }}
                        >
                          <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid #F5F0EB" }}>
                            <span className="text-[10px] font-semibold" style={{ color: "#87B5A7" }}>{matchFilter.size} selected</span>
                            {matchFilter.size > 0 && (
                              <button onClick={() => setMatchFilter(new Set())} className="text-[10px] font-semibold" style={{ color: "#E11D48" }}>Clear</button>
                            )}
                          </div>
                          <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
                            {(["green", "yellow", "red", "none"] as const).map(conf => (
                              <label key={conf} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={matchFilter.has(conf)}
                                  onChange={() => setMatchFilter(prev => { const next = new Set(prev); if (next.has(conf)) next.delete(conf); else next.add(conf); return next; })}
                                  className="w-3.5 h-3.5 rounded accent-[#248567] cursor-pointer"
                                />
                                <span className="text-xs" style={{ color: "#242424" }}>{{ green: "Green", yellow: "Yellow", red: "Red", none: "Not Analyzed" }[conf]}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <span className="ml-auto text-[10px]" style={{ color: "#B9CDC7" }}>
                  {analyticsCSQLs.length} CSQLs in view
                </span>
              </div>

              {chartTab === "overview" && (
                <div className="space-y-4">
                  <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                    <StageFunnel summary={filteredSummary} csqls={analyticsCSQLs} />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                      <ScoreOutcomeChart csqls={analyticsCSQLs} />
                    </div>
                    <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                      <StageDistributionChart summary={filteredSummary} csqls={analyticsCSQLs} />
                    </div>
                  </div>
                  <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: "#242424" }}>Deal Size vs Score &amp; Win Rate</h3>
                    <p className="text-[11px] mb-3" style={{ color: "#87B5A7" }}>Avg MOVE score (bars) and Closed Won rate (line) by deal size bucket. Bar color: green ≥50% win rate, amber 25–49%, red &lt;25%.</p>
                    <DealSizeCorrelationChart csqls={analyticsCSQLs} />
                  </div>
                </div>
              )}

              {chartTab === "trends" && (
                <div className="space-y-4">
                  <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                    <ScoreTrendsOverTime csqls={analyticsCSQLs} />
                  </div>
                  <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                    <WinRateOverTime csqls={analyticsCSQLs} />
                  </div>
                </div>
              )}

              {chartTab === "move" && (
                <div className="space-y-4">
                  <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                    <MOVEDimensionBreakdown csqls={analyticsCSQLs} />
                  </div>
                  <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                    <MOVEDimensionTrends csqls={analyticsCSQLs} />
                  </div>
                </div>
              )}

              {chartTab === "timing" && (
                <div className="space-y-4">
                  <TimeToCloseTab csqls={analyticsCSQLs} />
                </div>
              )}

              {chartTab === "velocity" && (
                <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "#242424" }}>
                    <GitBranch className="w-4 h-4" style={{ color: "#248567" }} />
                    Stage Velocity
                  </h3>
                  <StageVelocityChart
                    stageAverages={stageHistoryData?.stageAverages ?? []}
                    perOpp={stageHistoryData?.perOpp ?? {}}
                    csqls={analyticsCSQLs}
                    isLoading={stageHistoryLoading}
                  />
                </div>
              )}

              {chartTab === "reps" && (
                <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1" }}>
                  <RepAnalysisTab csqls={analyticsCSQLs} />
                </div>
              )}

              {chartTab === "insights" && (
                <div>
                  {!insightsData && !insightsLoading && !insightsError && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #EDE9FE, #DDD6FE)" }}>
                        <Sparkles className="w-5 h-5" style={{ color: "#7C3AED" }} />
                      </div>
                      <p className="text-sm font-semibold mb-1" style={{ color: "#242424" }}>AI-Powered CSQL Insights</p>
                      <p className="text-xs mb-5 max-w-xs" style={{ color: "#878787" }}>
                        Analyze patterns across {analyticsCSQLs.length} CSQLs to surface key findings and win/loss correlations.
                      </p>
                      <button
                        onClick={fetchInsights}
                        disabled={!analyticsCSQLs.length}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff" }}
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate Insights
                      </button>
                    </div>
                  )}

                  {insightsLoading && (
                    <div className="rounded-xl p-8 text-center" style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", border: "1px solid #DDD6FE" }}>
                      <div className="inline-flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-2" style={{ borderColor: "#7C3AED", borderTopColor: "transparent" }} />
                        <span className="text-sm font-semibold" style={{ color: "#6D28D9" }}>AI is analyzing {analyticsCSQLs.length} CSQLs…</span>
                      </div>
                      <p className="text-xs mt-2" style={{ color: "#8B5CF6" }}>This may take 15–30 seconds</p>
                    </div>
                  )}

                  {insightsError && (
                    <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
                      <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#DC2626" }} />
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#DC2626" }}>Failed to generate insights</p>
                        <p className="text-xs mt-0.5" style={{ color: "#991B1B" }}>{insightsError}</p>
                      </div>
                      <button onClick={() => setInsightsError(null)} className="ml-auto"><X className="w-4 h-4" style={{ color: "#DC2626" }} /></button>
                    </div>
                  )}

                  {insightsData && !insightsLoading && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #DDD6FE" }}>
                      <div className="px-5 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-white" />
                          <span className="text-sm font-bold text-white">AI Insights</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}>
                            {analyticsCSQLs.length} CSQLs analyzed
                          </span>
                        </div>
                        <button
                          onClick={fetchInsights}
                          disabled={insightsLoading}
                          className="text-xs px-2 py-1 rounded-md transition-colors"
                          style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}
                          title="Refresh insights"
                        >
                          <RefreshCw className={`w-3 h-3 ${insightsLoading ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                      <div className="flex border-b" style={{ borderColor: "#DDD6FE", backgroundColor: "#FAFAF8" }}>
                        {([
                          { key: "insights" as const, label: "Key Insights", icon: Lightbulb, count: insightsData.keyInsights.length },
                          { key: "patterns" as const, label: "Win/Loss Patterns", icon: Brain, count: null },
                        ]).map(tab => (
                          <button
                            key={tab.key}
                            onClick={() => setInsightsTab(tab.key)}
                            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors"
                            style={{
                              borderBottomColor: insightsTab === tab.key ? "#7C3AED" : "transparent",
                              color: insightsTab === tab.key ? "#7C3AED" : "#87B5A7",
                              backgroundColor: insightsTab === tab.key ? "#F5F3FF" : "transparent",
                            }}
                          >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                            {tab.count !== null && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                                backgroundColor: insightsTab === tab.key ? "#EDE9FE" : "#F0F0F0",
                                color: insightsTab === tab.key ? "#7C3AED" : "#999",
                              }}>{tab.count}</span>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="p-5" style={{ backgroundColor: "#FAFAF8" }}>
                        {insightsTab === "insights" && (
                          <div className="space-y-4">
                            {insightsData.keyInsights.map((insight, i) => (
                              <div key={i} className="rounded-lg p-4" style={{ backgroundColor: "#fff", border: "1px solid #EDE9FE" }}>
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#EDE9FE", color: "#7C3AED" }}>
                                    {i + 1}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold" style={{ color: "#242424" }}>{insight.title}</p>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "#666" }}>{insight.detail}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {insightsTab === "patterns" && insightsData.winLossPatterns && (
                          <div className="space-y-4">
                            <div className="rounded-lg p-4" style={{ backgroundColor: "#fff", border: "1px solid #EDE9FE" }}>
                              <p className="text-sm font-semibold mb-2" style={{ color: "#242424" }}>Summary</p>
                              <p className="text-xs leading-relaxed" style={{ color: "#666" }}>{insightsData.winLossPatterns.summary}</p>
                            </div>
                            {insightsData.winLossPatterns.criticalDimensions.length > 0 && (
                              <div className="rounded-lg p-4" style={{ backgroundColor: "#fff", border: "1px solid #EDE9FE" }}>
                                <p className="text-sm font-semibold mb-3" style={{ color: "#242424" }}>Critical Dimensions</p>
                                <div className="space-y-2">
                                  {insightsData.winLossPatterns.criticalDimensions.map((dim, i) => (
                                    <div key={i} className="flex items-start gap-3 rounded-md p-3" style={{ backgroundColor: "#F5F3FF" }}>
                                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "#7C3AED", color: "#fff" }}>{dim.dimension}</span>
                                      <p className="text-xs leading-relaxed" style={{ color: "#5B21B6" }}>{dim.finding}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="rounded-lg p-4" style={{ backgroundColor: "#fff", border: "1px solid #EDE9FE" }}>
                                <p className="text-sm font-semibold mb-2" style={{ color: "#242424" }}>Score Thresholds</p>
                                <p className="text-xs leading-relaxed" style={{ color: "#666" }}>{insightsData.winLossPatterns.scoreThresholds}</p>
                              </div>
                              <div className="rounded-lg p-4" style={{ backgroundColor: "#fff", border: "1px solid #EDE9FE" }}>
                                <p className="text-sm font-semibold mb-2" style={{ color: "#242424" }}>Recommendations</p>
                                <p className="text-xs leading-relaxed" style={{ color: "#666" }}>{insightsData.winLossPatterns.recommendations}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {overrideSuccess && (
        <div className="rounded-xl p-4 flex items-center gap-3 animate-fade-in" style={{ backgroundColor: "#E7F6EE", border: "1px solid #B5E6D0" }}>
          <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#248567" }} />
          <p className="text-sm font-semibold" style={{ color: "#248567" }}>Call score replaced successfully. {overrideSuccess}</p>
          <button onClick={() => setOverrideSuccess(null)} className="ml-auto"><X className="w-4 h-4" style={{ color: "#248567" }} /></button>
        </div>
      )}

      <div className="rounded-xl" style={{ border: "1px solid #EEE9E1" }}>
        <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap rounded-xl" style={{ backgroundColor: "#F8F5F0", borderBottom: "1px solid #EEE9E1", position: "sticky", top: 0, zIndex: 20 }}>
          <div className="flex items-center gap-1 p-0.5 rounded-full" style={{ backgroundColor: "#EEE9E1" }}>
            {[
              { value: "week", label: "1W" },
              { value: "month", label: "1M" },
              { value: "quarter", label: "This Q" },
              { value: "prev_quarter", label: "Prev Q" },
              { value: "year", label: "1Y" },
              { value: "prev_year", label: "Prev Y" },
              { value: "all", label: "All" },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setTimePeriod(opt.value)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 whitespace-nowrap"
                style={{
                  backgroundColor: timePeriod === opt.value ? "#fff" : "transparent",
                  color: timePeriod === opt.value ? "#248567" : "#87B5A7",
                  boxShadow: timePeriod === opt.value ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="w-px h-4 mx-1 flex-shrink-0" style={{ backgroundColor: "#D6CFC8" }} />
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" style={{ color: activeFilterCount > 0 ? "#248567" : "#C5BAB0" }} />
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#E7F6EE", color: "#248567" }}>
                {activeFilterCount}
              </span>
            )}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors hover:bg-red-50"
                style={{ color: "#E11D48" }}
              >
                Clear All
              </button>
            )}
          </div>
          <div className="relative" ref={csmDropdownRef}>
            <button
              onClick={() => setCsmDropdownOpen(!csmDropdownOpen)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
              style={{
                borderColor: csmFilter.size > 0 ? "#248567" : "#EEE9E1",
                color: "#242424",
                backgroundColor: csmFilter.size > 0 ? "#F0FDF4" : "#fff",
                minWidth: "100px",
              }}
            >
              <span className="truncate">
                {csmFilter.size === 0
                  ? "All CSMs"
                  : csmFilter.size === 1
                    ? [...csmFilter][0]
                    : `${csmFilter.size} CSMs`}
              </span>
              <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "#87B5A7" }} />
            </button>
            {csmDropdownOpen && (
              <div
                className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
                style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1", minWidth: "180px", maxHeight: "280px" }}
              >
                <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid #F5F0EB" }}>
                  <span className="text-[10px] font-semibold" style={{ color: "#87B5A7" }}>
                    {csmFilter.size} selected
                  </span>
                  {csmFilter.size > 0 && (
                    <button onClick={() => setCsmFilter(new Set())} className="text-[10px] font-semibold" style={{ color: "#E11D48" }}>
                      Clear
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
                  {availableCSMs.map(name => (
                    <label key={name} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={csmFilter.has(name)}
                        onChange={() => {
                          setCsmFilter(prev => {
                            const next = new Set(prev);
                            if (next.has(name)) next.delete(name); else next.add(name);
                            return next;
                          });
                        }}
                        className="w-3.5 h-3.5 rounded accent-[#248567] cursor-pointer"
                      />
                      <span className="text-xs" style={{ color: "#242424" }}>{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={stageDropdownRef}>
            <button
              onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
              style={{
                borderColor: stageFilter.size > 0 ? "#248567" : "#EEE9E1",
                color: "#242424",
                backgroundColor: stageFilter.size > 0 ? "#F0FDF4" : "#fff",
                minWidth: "100px",
              }}
            >
              <span className="truncate">
                {stageFilter.size === 0
                  ? "All Stages"
                  : stageFilter.size === 1
                    ? [...stageFilter][0]
                    : `${stageFilter.size} Stages`}
              </span>
              <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "#87B5A7" }} />
            </button>
            {stageDropdownOpen && (
              <div
                className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
                style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1", minWidth: "200px", maxHeight: "260px" }}
              >
                <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid #F5F0EB" }}>
                  <span className="text-[10px] font-semibold" style={{ color: "#87B5A7" }}>
                    {stageFilter.size} selected
                  </span>
                  {stageFilter.size > 0 && (
                    <button onClick={() => setStageFilter(new Set())} className="text-[10px] font-semibold" style={{ color: "#E11D48" }}>
                      Clear
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
                  {availableStages.map(stage => (
                    <label key={stage} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={stageFilter.has(stage)}
                        onChange={() => {
                          setStageFilter(prev => {
                            const next = new Set(prev);
                            if (next.has(stage)) next.delete(stage); else next.add(stage);
                            return next;
                          });
                        }}
                        className="w-3.5 h-3.5 rounded accent-[#248567] cursor-pointer"
                      />
                      <span className="text-xs" style={{ color: "#242424" }}>{stage}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <select
            value={linkedFilter}
            onChange={(e) => setLinkedFilter(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs border focus:outline-none"
            style={{ borderColor: linkedFilter !== "all" ? "#248567" : "#EEE9E1", color: "#242424", backgroundColor: linkedFilter !== "all" ? "#F0FDF4" : "#fff" }}
          >
            <option value="all">All CSQLs</option>
            <option value="linked">With Call Score</option>
            <option value="unlinked">Without Call Score</option>
          </select>
          <button
            onClick={() => setShowAdvancedFilters(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors"
            style={{
              borderColor: advancedFilterCount > 0 ? "#248567" : "#EEE9E1",
              color: advancedFilterCount > 0 ? "#248567" : "#87B5A7",
              backgroundColor: advancedFilterCount > 0 ? "#F0FDF4" : "#fff",
            }}
          >
            {advancedFilterCount > 0 ? `Advanced (${advancedFilterCount})` : "Advanced"}
            {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showAdvancedFilters && (
            <>
              <select
                value={callProximityFilter}
                onChange={(e) => setCallProximityFilter(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs border focus:outline-none"
                style={{ borderColor: callProximityFilter !== "all" ? "#248567" : "#EEE9E1", color: "#242424", backgroundColor: callProximityFilter !== "all" ? "#F0FDF4" : "#fff" }}
              >
                <option value="all">Any Timing</option>
                <option value="1">≤ 1 day</option>
                <option value="3">≤ 3 days</option>
                <option value="7">≤ 7 days</option>
                <option value="30">≤ 30 days</option>
              </select>
              <div className="relative" ref={dealSizeDropdownRef}>
                <button
                  onClick={() => setDealSizeDropdownOpen(!dealSizeDropdownOpen)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                  style={{
                    borderColor: dealSizeFilter.size > 0 ? "#248567" : "#EEE9E1",
                    color: "#242424",
                    backgroundColor: dealSizeFilter.size > 0 ? "#F0FDF4" : "#fff",
                    minWidth: "110px",
                  }}
                >
                  <span className="truncate">
                    {dealSizeFilter.size === 0
                      ? "All Amounts"
                      : dealSizeFilter.size === 1
                        ? (DEAL_SIZE_BUCKET_CONFIG.find(b => b.key === [...dealSizeFilter][0])?.label ?? [...dealSizeFilter][0])
                        : `${dealSizeFilter.size} Amounts`}
                  </span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "#87B5A7" }} />
                </button>
                {dealSizeDropdownOpen && (
                  <div
                    className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
                    style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1", minWidth: "160px" }}
                  >
                    <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid #F5F0EB" }}>
                      <span className="text-[10px] font-semibold" style={{ color: "#87B5A7" }}>
                        {dealSizeFilter.size} selected
                      </span>
                      {dealSizeFilter.size > 0 && (
                        <button onClick={() => setDealSizeFilter(new Set())} className="text-[10px] font-semibold" style={{ color: "#E11D48" }}>
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
                      {DEAL_SIZE_BUCKET_CONFIG.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={dealSizeFilter.has(key)}
                            onChange={() => {
                              setDealSizeFilter(prev => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key); else next.add(key);
                                return next;
                              });
                            }}
                            className="w-3.5 h-3.5 rounded accent-[#248567] cursor-pointer"
                          />
                          <span className="text-xs" style={{ color: "#242424" }}>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative" ref={matchDropdownRef}>
                <button
                  onClick={() => setMatchDropdownOpen(!matchDropdownOpen)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                  style={{
                    borderColor: matchFilter.size > 0 ? "#248567" : "#EEE9E1",
                    color: "#242424",
                    backgroundColor: matchFilter.size > 0 ? "#F0FDF4" : "#fff",
                    minWidth: "110px",
                  }}
                >
                  <span className="truncate">
                    {matchFilter.size === 0
                      ? "All Matches"
                      : matchFilter.size === 1
                        ? { green: "Green", yellow: "Yellow", red: "Red", none: "Not Analyzed" }[[...matchFilter][0]] ?? [...matchFilter][0]
                        : `${matchFilter.size} Match Types`}
                  </span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "#87B5A7" }} />
                </button>
                {matchDropdownOpen && (
                  <div
                    className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
                    style={{ backgroundColor: "#fff", border: "1px solid #EEE9E1", minWidth: "160px" }}
                  >
                    <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid #F5F0EB" }}>
                      <span className="text-[10px] font-semibold" style={{ color: "#87B5A7" }}>
                        {matchFilter.size} selected
                      </span>
                      {matchFilter.size > 0 && (
                        <button onClick={() => setMatchFilter(new Set())} className="text-[10px] font-semibold" style={{ color: "#E11D48" }}>
                          Clear
                        </button>
                      )}
                    </div>
                    {[
                      { value: "green", label: "Green Match" },
                      { value: "yellow", label: "Yellow Match" },
                      { value: "red", label: "Red Match" },
                      { value: "none", label: "Not Analyzed" },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={matchFilter.has(opt.value)}
                          onChange={() => {
                            setMatchFilter(prev => {
                              const next = new Set(prev);
                              if (next.has(opt.value)) next.delete(opt.value); else next.add(opt.value);
                              return next;
                            });
                          }}
                          className="w-3.5 h-3.5 rounded accent-[#248567] cursor-pointer"
                    />
                    <span className="text-xs" style={{ color: "#242424" }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
            </>
          )}
          <span className="ml-auto text-[10px] whitespace-nowrap flex-shrink-0" style={{ color: "#B9CDC7" }}>
            {selectedIds.size > 0 && <span style={{ color: "#248567", fontWeight: 600 }}>{selectedIds.size} selected · </span>}
            {filteredAndSorted.length} of {data?.csqls?.length || 0} CSQLs
          </span>
        </div>
      </div>

      {autoScoreProgress && (
        <div className="rounded-xl p-5" style={{ backgroundColor: "#FAFAF8", border: "1px solid #EEE9E1" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {!autoScoreDone ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#248567" }} />
              ) : (
                <CheckCircle className="w-4 h-4" style={{ color: "#248567" }} />
              )}
              <span className="text-sm font-semibold" style={{ color: "#242424" }}>
                {autoScoreDone ? "Auto-Score Complete" : "Auto-Scoring Calls..."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!autoScoreDone && (
                <button
                  onClick={cancelAutoScore}
                  className="text-xs px-2 py-1 rounded border transition-colors hover:bg-red-50"
                  style={{ borderColor: "#EEE9E1", color: "#E11D48" }}
                >
                  Cancel
                </button>
              )}
              {autoScoreDone && (
                <button
                  onClick={() => { setAutoScoreProgress(null); setAutoScoreDone(false); }}
                  className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50"
                  style={{ borderColor: "#EEE9E1", color: "#87B5A7" }}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>

          {autoScoreProgress.total > 0 && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round(((autoScoreProgress.scored + autoScoreProgress.failed + autoScoreProgress.skipped) / autoScoreProgress.total) * 100)}%`,
                    backgroundColor: "#248567",
                  }}
                />
              </div>

              <div className="flex items-center gap-4 text-xs mb-2">
                <span style={{ color: "#248567" }}>
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  {autoScoreProgress.scored} scored
                </span>
                <span style={{ color: "#87B5A7" }}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {autoScoreProgress.skipped} skipped
                </span>
                {autoScoreProgress.failed > 0 && (
                  <span style={{ color: "#E11D48" }}>
                    <XCircle className="w-3 h-3 inline mr-1" />
                    {autoScoreProgress.failed} failed
                  </span>
                )}
                <span style={{ color: "#B9CDC7" }}>
                  {autoScoreProgress.scored + autoScoreProgress.failed + autoScoreProgress.skipped} / {autoScoreProgress.total}
                </span>
              </div>
            </>
          )}

          <p className="text-[11px] truncate" style={{ color: "#B9CDC7" }}>
            {autoScoreProgress.current}
          </p>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: "#F8F5F0" }}>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded cursor-pointer accent-[#248567]"
                  />
                </th>
                <th
                  className="text-left px-4 py-3 font-bold cursor-pointer select-none"
                  style={{ color: "#87B5A7" }}
                  onClick={() => handleSort("createdDate")}
                >
                  <span className="inline-flex items-center gap-1">
                    Created <SortIcon field="createdDate" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 font-bold cursor-pointer select-none"
                  style={{ color: "#87B5A7" }}
                  onClick={() => handleSort("accountName")}
                >
                  <span className="inline-flex items-center gap-1">
                    Account <SortIcon field="accountName" />
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-bold" style={{ color: "#87B5A7" }}>
                  Creator
                </th>
                <th
                  className="text-right px-4 py-3 font-bold cursor-pointer select-none"
                  style={{ color: "#87B5A7" }}
                  onClick={() => handleSort("amount")}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    Amount <SortIcon field="amount" />
                  </span>
                </th>
                <th
                  className="text-center px-4 py-3 font-bold cursor-pointer select-none"
                  style={{ color: "#87B5A7" }}
                  onClick={() => handleSort("stageName")}
                >
                  <span className="inline-flex items-center gap-1">
                    Stage <SortIcon field="stageName" />
                  </span>
                </th>
                <th className="text-center px-3 py-3 font-bold" style={{ color: "#87B5A7" }}>
                  Days in Stage
                </th>
                <th
                  className="text-center px-4 py-3 font-bold cursor-pointer select-none"
                  style={{ color: "#87B5A7" }}
                  onClick={() => handleSort("score")}
                >
                  <span className="inline-flex items-center gap-1">
                    Call Score <SortIcon field="score" />
                  </span>
                </th>
                <th className="text-center px-3 py-3 font-bold" style={{ color: "#87B5A7" }}>
                  Match
                </th>
                <th className="text-center px-4 py-3 font-bold" style={{ color: "#87B5A7" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.length === 0 && (data?.csqls?.length ?? 0) > 0 && (
                <tr>
                  <td colSpan={20} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-3xl">🔍</div>
                      <p className="text-sm font-semibold" style={{ color: "#242424" }}>No CSQLs match your current filters</p>
                      <p className="text-xs" style={{ color: "#87B5A7" }}>Try widening the time period or clearing a filter</p>
                      <button
                        onClick={clearAllFilters}
                        className="mt-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ backgroundColor: "#248567", color: "#fff" }}
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {filteredAndSorted.map((csql) => (
                <tr
                  key={csql.oppId}
                  className="border-t hover:bg-[#FAFAF8] transition-colors"
                  style={{ borderColor: "#EEE9E1", opacity: csql.isExcluded ? 0.55 : 1 }}
                >
                  <td className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(csql.oppId)}
                      onChange={() => toggleSelect(csql.oppId)}
                      className="w-3.5 h-3.5 rounded cursor-pointer accent-[#248567]"
                    />
                  </td>
                  <td className="px-4 py-3" style={{ color: "#242424" }}>
                    {new Date(csql.createdDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold truncate max-w-[200px]" style={{ color: "#242424" }}>
                      {csql.accountName}
                    </div>
                    <div className="text-[10px] truncate max-w-[200px]" style={{ color: "#B9CDC7" }}>
                      {csql.oppName}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "#242424" }}>
                    {csql.createdByName}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "#242424" }}>
                    {formatCurrency(csql.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={csql.stageName} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    {(() => {
                      const days = stageHistoryData?.perOpp[csql.oppId];
                      if (days == null) return <span style={{ color: "#B9CDC7" }}>—</span>;
                      const avg = stageHistoryData?.stageAverages.find(s => s.stage === csql.stageName);
                      let color = "#5C5C5C";
                      let bg = "transparent";
                      let tip = `${days} days in ${csql.stageName.replace(/^\([^)]+\)\s*/, "")}`;
                      if (avg) {
                        tip += ` · won avg ${avg.avgDaysWon ?? "?"}d, lost avg ${avg.avgDaysLost ?? "?"}d`;
                        if (avg.avgDaysWon != null && days <= avg.avgDaysWon) { color = "#248567"; bg = "#E7F6EE"; }
                        else if (avg.avgDaysLost != null && days > avg.avgDaysLost) { color = "#D9534F"; bg = "#FFEAE7"; }
                        else { color = "#B98A00"; bg = "#FFF8E1"; }
                      }
                      return (
                        <span
                          className="inline-block px-2 py-0.5 rounded font-mono font-semibold text-[11px]"
                          style={{ color, backgroundColor: bg }}
                          title={tip}
                        >
                          {days}d
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {csql.linkedAssessment ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className={csql.isExcluded ? "opacity-35 line-through" : ""}>
                          <ScoreBadge score={csql.linkedAssessment.totalScore ?? null} />
                          {csql.linkedAssessment.callDate && (
                            <div className="text-[9px] mt-0.5" style={{ color: "#B9CDC7" }}>
                              Call: {new Date(csql.linkedAssessment.callDate).toLocaleDateString()}
                            </div>
                          )}
                          {csql.isOverridden && (
                            <div className="text-[8px] mt-0.5 font-semibold" style={{ color: "#7C5ABF" }}>
                              Manual
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleExclusion(csql.oppId)}
                          disabled={togglingExclusion.has(csql.oppId)}
                          title={csql.isExcluded ? "Include in analytics" : "Exclude from analytics"}
                          className="relative flex-shrink-0 w-7 h-4 rounded-full transition-colors focus:outline-none"
                          style={{
                            backgroundColor: csql.isExcluded ? "#D1D5DB" : "#248567",
                            opacity: togglingExclusion.has(csql.oppId) ? 0.5 : 1,
                          }}
                        >
                          <span
                            className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
                            style={{
                              left: csql.isExcluded ? "2px" : "12px",
                            }}
                          />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px]" style={{ color: "#B9CDC7" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {csql.linkedAssessment ? (
                      <div className="relative group inline-flex items-center justify-center" ref={matchPopoverOpen === csql.oppId ? matchPopoverRef : undefined}>
                        <button
                          className="relative w-4 h-4 rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all focus:outline-none"
                          style={{
                            backgroundColor: csql.matchConfidence
                              ? csql.matchConfidence.confidence === "green" ? "#22C55E"
                                : csql.matchConfidence.confidence === "yellow" ? "#EAB308"
                                : "#EF4444"
                              : "#E5E7EB",
                            ringColor: "#248567",
                          }}
                          onClick={() => setMatchPopoverOpen(matchPopoverOpen === csql.oppId ? null : csql.oppId)}
                          disabled={settingMatch.has(csql.oppId)}
                          title={csql.matchConfidence?.reasoning || "Click to set match confidence"}
                        >
                          {csql.matchConfidence?.isManual && (
                            <Check className="w-2.5 h-2.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" strokeWidth={3} />
                          )}
                        </button>
                        {matchPopoverOpen === csql.oppId && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1.5 px-2.5 py-2 rounded-xl shadow-lg z-50" style={{ backgroundColor: "#242424" }}>
                            {(["green", "yellow", "red"] as const).map(color => (
                              <button
                                key={color}
                                className="w-5 h-5 rounded-full transition-transform hover:scale-125 focus:outline-none relative"
                                style={{
                                  backgroundColor: color === "green" ? "#22C55E" : color === "yellow" ? "#EAB308" : "#EF4444",
                                  ring: csql.matchConfidence?.confidence === color ? "2px solid white" : "none",
                                  outline: csql.matchConfidence?.confidence === color ? "2px solid white" : "none",
                                  outlineOffset: "1px",
                                }}
                                onClick={() => handleSetMatchConfidence(csql.oppId, csql.linkedAssessment!.assessmentId, color)}
                                title={`Set as ${color}`}
                              />
                            ))}
                            {csql.matchConfidence && (
                              <button
                                className="w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-125 focus:outline-none"
                                style={{ backgroundColor: "#4B5563" }}
                                onClick={() => handleResetMatchConfidence(csql.oppId)}
                                title="Reset to unanalyzed"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            )}
                            {csql.matchConfidence?.reasoning && csql.matchConfidence.reasoning !== "Manually set" && (
                              <div className="text-[9px] text-white max-w-[140px] ml-1 leading-tight opacity-80">
                                {csql.matchConfidence.reasoning.slice(0, 80)}{csql.matchConfidence.reasoning.length > 80 ? "..." : ""}
                              </div>
                            )}
                          </div>
                        )}
                        {matchPopoverOpen !== csql.oppId && csql.matchConfidence?.reasoning && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg shadow-lg text-[10px] text-left w-52 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none" style={{ backgroundColor: "#242424", color: "#fff" }}>
                            {csql.matchConfidence.reasoning}
                            {csql.matchConfidence.isManual && (
                              <div className="mt-1 text-[8px] font-semibold" style={{ color: "#A78BFA" }}>Manually confirmed</div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px]" style={{ color: "#B9CDC7" }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {csql.linkedAssessment && onViewAssessment && (
                        <button
                          onClick={() => onViewAssessment(csql.linkedAssessment!.assessmentId)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors hover:shadow-sm"
                          style={{ backgroundColor: "#EEF0FF", color: "#4A5ABA" }}
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      )}
                      {csql.linkedAssessment ? (
                        <button
                          onClick={() => { setFindCallsFor(csql); setReplaceMode(true); }}
                          className="inline-flex items-center p-1.5 rounded-full transition-colors hover:shadow-sm"
                          style={{ backgroundColor: "#FFF0E7", color: "#B56A1B" }}
                          title="Replace the linked call with a different one"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => { setFindCallsFor(csql); setReplaceMode(false); }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors hover:shadow-sm"
                          style={{ backgroundColor: "#FFF8E7", color: "#B58A1B" }}
                        >
                          <Search className="w-3 h-3" />
                          Find Call
                        </button>
                      )}
                      {csql.isOverridden && (
                        <button
                          onClick={() => handleUndoOverride(csql.oppId)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors hover:shadow-sm"
                          style={{ backgroundColor: "#F5F0FF", color: "#7C5ABF" }}
                          title="Undo manual override and use auto-linked call"
                        >
                          <Undo2 className="w-3 h-3" />
                          Undo
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {findCallsFor && (
        <FindCallsModal
          csql={findCallsFor}
          onClose={() => { setFindCallsFor(null); setReplaceMode(false); }}
          onViewAssessment={onViewAssessment}
          replaceMode={replaceMode}
          queryClient={queryClient}
          onSelectCall={replaceMode ? async (assessmentId: number) => {
            await handleOverrideCall(findCallsFor.oppId, assessmentId);
          } : undefined}
        />
      )}
    </div>
  );
};

export default CSQLOutcomes;
