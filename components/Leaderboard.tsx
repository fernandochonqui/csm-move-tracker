import React, { useState, useMemo } from "react";
import {
  Trophy,
  Medal,
  Loader2,
  AlertCircle,
  User,
  BarChart3,
  Filter,
  X,
} from "lucide-react";
import { useLeaderboard, LeaderboardEntry, LeaderboardFilters } from "../hooks/use-leaderboard";

type PhaseTab = "overall" | "motivation" | "opportunity" | "execution" | "validation";

const TABS: { key: PhaseTab; label: string; color: string }[] = [
  { key: "overall", label: "Overall", color: "#248567" },
  { key: "motivation", label: "Motivation", color: "#FF8B6C" },
  { key: "opportunity", label: "Opportunity", color: "#4A5ABA" },
  { key: "validation", label: "Validation", color: "#B58A1B" },
  { key: "execution", label: "Execution", color: "#A496FF" },
];

const MANAGERS = ["Jeff", "Jenna", "Julie", "Zach"];
const SEGMENTS = ["Enterprise", "Mid-Market", "Pooled"];
const ATTACHMENTS = ["Attached", "Pool"];

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="w-5 h-5" style={{ color: "#FFD700" }} />;
  if (rank === 2) return <Medal className="w-5 h-5" style={{ color: "#C0C0C0" }} />;
  if (rank === 3) return <Medal className="w-5 h-5" style={{ color: "#CD7F32" }} />;
  return <span className="text-xs font-bold w-5 h-5 flex items-center justify-center" style={{ color: "#87B5A7" }}>{rank}</span>;
}

function getScoreColor(score: number, max: number): string {
  const pct = (score / max) * 100;
  if (pct >= 75) return "#248567";
  if (pct >= 50) return "#B58A1B";
  return "#FF8B6C";
}

const Leaderboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PhaseTab>("overall");
  const [filters, setFilters] = useState<LeaderboardFilters>({});
  const { data: entries, isLoading, error } = useLeaderboard(filters);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const updateFilter = (key: keyof LeaderboardFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  };

  const clearFilters = () => setFilters({});

  const sorted = useMemo(() => {
    if (!entries) return [];
    const copy = [...entries];
    if (activeTab === "overall") {
      copy.sort((a, b) => b.averageTotal - a.averageTotal);
    } else {
      copy.sort((a, b) => {
        const aAvg = a.phases[activeTab]?.average || 0;
        const bAvg = b.phases[activeTab]?.average || 0;
        return bAvg - aAvg;
      });
    }
    return copy;
  }, [entries, activeTab]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#248567" }} />
        <span className="ml-3 text-sm font-medium" style={{ color: "#87B5A7" }}>
          Loading leaderboard...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-8 text-center" style={{ border: "1px solid #EEE9E1" }}>
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#FF8B6C" }} />
        <h3 className="text-lg font-bold mb-2" style={{ color: "#242424" }}>
          Unable to load leaderboard
        </h3>
        <p className="text-sm" style={{ color: "#87B5A7" }}>
          Please try again later.
        </p>
      </div>
    );
  }

  const activeColor = TABS.find(t => t.key === activeTab)?.color || "#248567";
  const maxScore = activeTab === "overall" ? 20 : 4;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Trophy className="w-6 h-6" style={{ color: "#248567" }} />
                <h2 className="text-xl font-bold" style={{ color: "#242424" }}>
                  CSM Leaderboard
                </h2>
              </div>
              <p className="text-sm" style={{ color: "#87B5A7" }}>
                Average MOVE scores across all assessed calls
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4" style={{ color: "#87B5A7" }} />
            <span className="text-xs font-semibold" style={{ color: "#87B5A7" }}>Filters</span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors hover:bg-red-50"
                style={{ color: "#FF8B6C" }}
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase mb-1.5" style={{ color: "#87B5A7" }}>Manager</div>
              <div className="flex flex-wrap gap-1">
                {MANAGERS.map(m => (
                  <button
                    key={m}
                    onClick={() => updateFilter("manager", m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filters.manager === m ? "text-white shadow-sm" : ""
                    }`}
                    style={
                      filters.manager === m
                        ? { backgroundColor: "#248567" }
                        : { backgroundColor: "#F8F5F3", color: "#242424", border: "1px solid #EEE9E1" }
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase mb-1.5" style={{ color: "#87B5A7" }}>Segment</div>
              <div className="flex flex-wrap gap-1">
                {SEGMENTS.map(s => (
                  <button
                    key={s}
                    onClick={() => updateFilter("segment", s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filters.segment === s ? "text-white shadow-sm" : ""
                    }`}
                    style={
                      filters.segment === s
                        ? { backgroundColor: "#4A5ABA" }
                        : { backgroundColor: "#F8F5F3", color: "#242424", border: "1px solid #EEE9E1" }
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase mb-1.5" style={{ color: "#87B5A7" }}>Attachment</div>
              <div className="flex flex-wrap gap-1">
                {ATTACHMENTS.map(a => (
                  <button
                    key={a}
                    onClick={() => updateFilter("attachment", a)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      filters.attachment === a ? "text-white shadow-sm" : ""
                    }`}
                    style={
                      filters.attachment === a
                        ? { backgroundColor: "#B58A1B" }
                        : { backgroundColor: "#F8F5F3", color: "#242424", border: "1px solid #EEE9E1" }
                    }
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 pb-4">
          <div className="flex gap-1 p-1 rounded-full" style={{ backgroundColor: "#F8F5F3", border: "1px solid #EEE9E1" }}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-3 py-2 rounded-full text-xs font-semibold transition-colors duration-200 ${
                  activeTab === tab.key ? "bg-white shadow-sm" : "hover:bg-white/50"
                }`}
                style={
                  activeTab === tab.key
                    ? { color: tab.color, border: "1px solid #EEE9E1" }
                    : { color: "#87B5A7" }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 pb-6">
          {!sorted.length ? (
            <div className="py-8 text-center">
              <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: "#B9CDC7" }} />
              <h3 className="text-sm font-bold mb-1" style={{ color: "#242424" }}>
                {activeFilterCount > 0 ? "No results for these filters" : "No assessments yet"}
              </h3>
              <p className="text-xs" style={{ color: "#87B5A7" }}>
                {activeFilterCount > 0
                  ? "Try adjusting your filters to see more results."
                  : "Complete some call assessments to see the leaderboard."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((entry, idx) => (
                <LeaderboardRow
                  key={entry.csmName}
                  entry={entry}
                  rank={idx + 1}
                  activeTab={activeTab}
                  maxScore={maxScore}
                  accentColor={activeColor}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  rank: number;
  activeTab: PhaseTab;
  maxScore: number;
  accentColor: string;
}

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ entry, rank, activeTab, maxScore, accentColor }) => {
  const score = activeTab === "overall"
    ? entry.averageTotal
    : (entry.phases[activeTab]?.average || 0);
  const count = activeTab === "overall"
    ? entry.assessmentCount
    : (entry.phases[activeTab]?.count || 0);
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const scoreColor = getScoreColor(score, maxScore);

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
        rank <= 3 ? "shadow-sm" : ""
      }`}
      style={{
        backgroundColor: rank === 1 ? "#FFFDF5" : rank <= 3 ? "#F8FAF9" : "#fff",
        border: `1px solid ${rank === 1 ? "#FFE8A3" : rank <= 3 ? "#D1E5DC" : "#EEE9E1"}`,
      }}
    >
      <div className="w-8 flex-shrink-0 flex items-center justify-center">
        {getRankIcon(rank)}
      </div>

      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: "#F8F5F3", border: "1px solid #EEE9E1" }}>
        <User className="w-4 h-4" style={{ color: "#87B5A7" }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate" style={{ color: "#242424" }}>
          {entry.csmName}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs" style={{ color: "#87B5A7" }}>
            {count} assessment{count === 1 ? "" : "s"}
          </span>
          {entry.segment && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: entry.segment === "Enterprise" ? "#EEF0FF" : entry.segment === "Mid-Market" ? "#E7F6EE" : "#FFF8E7",
                color: entry.segment === "Enterprise" ? "#4A5ABA" : entry.segment === "Mid-Market" ? "#248567" : "#B58A1B",
              }}
            >
              {entry.segment}
            </span>
          )}
          {entry.manager && (
            <span className="text-[10px] font-medium" style={{ color: "#B9CDC7" }}>
              {entry.manager}'s team
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#EEE9E1" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: accentColor }}
          />
        </div>
        <div className="text-right" style={{ minWidth: "60px" }}>
          <span className="text-sm font-bold" style={{ color: scoreColor }}>
            {score}
          </span>
          <span className="text-xs" style={{ color: "#87B5A7" }}>
            /{maxScore}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
