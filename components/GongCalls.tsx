import React, { useState } from "react";
import {
  Phone,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Filter,
  BarChart3,
  ToggleLeft,
  ToggleRight,
  Plus,
  X,
  Settings2,
  User,
  Eye,
} from "lucide-react";
import { useGongCalls, useAnalyzeGongCalls, GongCall } from "../hooks/use-gong-calls";
import { useAssessment } from "../hooks/use-assessments";
import {
  useQualifyingFilters,
  useUpdateFilters,
  useAddPattern,
  useRemovePattern,
  QualifyingFilter,
} from "../hooks/use-qualifying-filters";

interface GongCallsProps {
  onViewAssessment?: (assessmentId: number) => void;
}

const GongCalls: React.FC<GongCallsProps> = ({ onViewAssessment }) => {
  const { data, isLoading, error, refetch } = useGongCalls();
  const analyzeMutation = useAnalyzeGongCalls();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showInfo, setShowInfo] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const calls = data?.calls || [];
  const newCalls = calls.filter((c) => !c.alreadyAnalyzed);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllNew = () => {
    setSelectedIds(new Set(newCalls.map((c) => c.conversationId)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleAnalyze = (ids: string[]) => {
    analyzeMutation.mutate(ids, {
      onSuccess: () => {
        setSelectedIds(new Set());
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#248567" }} />
        <span className="ml-3 text-sm font-medium" style={{ color: "#87B5A7" }}>
          Loading qualifying calls from Gong...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-8 text-center" style={{ border: "1px solid #EEE9E1" }}>
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#FF8B6C" }} />
        <h3 className="text-lg font-bold mb-2" style={{ color: "#242424" }}>
          Unable to load calls from Gong
        </h3>
        <p className="text-sm mb-4" style={{ color: "#87B5A7" }}>
          {error.message.includes("not configured")
            ? "Snowflake integration is not configured. Contact your administrator."
            : "Please try again later."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
        <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#242424" }}>
              Gong Calls
            </h2>
            <p className="text-sm mt-1" style={{ color: "#87B5A7" }}>
              {newCalls.length > 0
                ? `${newCalls.length} new qualifying call${newCalls.length === 1 ? "" : "s"} ready for analysis`
                : "All qualifying calls have been analyzed"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              title="Refresh calls"
              className="p-2 rounded-lg text-sm font-semibold transition-colors hover:bg-gray-100"
              style={{ color: "#87B5A7" }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {selectedIds.size > 0 ? (
              <>
                <button
                  onClick={clearSelection}
                  className="px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ color: "#87B5A7" }}
                >
                  Clear ({selectedIds.size})
                </button>
                <button
                  onClick={() => handleAnalyze(Array.from(selectedIds))}
                  disabled={analyzeMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-colors shadow-lg disabled:opacity-50"
                  style={{ backgroundColor: "#248567" }}
                >
                  {analyzeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Analyze Selected ({selectedIds.size})
                </button>
              </>
            ) : (
              <>
                {newCalls.length > 0 && (
                  <>
                    <button
                      onClick={selectAllNew}
                      className="px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                      style={{ color: "#248567", backgroundColor: "#E7F6EE" }}
                    >
                      Select All New
                    </button>
                    <button
                      onClick={() =>
                        handleAnalyze(newCalls.map((c) => c.conversationId))
                      }
                      disabled={analyzeMutation.isPending}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-colors shadow-lg disabled:opacity-50"
                      style={{ backgroundColor: "#248567" }}
                    >
                      {analyzeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Analyze All New ({newCalls.length})
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Progress bar during analysis */}
        {analyzeMutation.isPending && (
          <div className="px-8 pb-4">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#E7F6EE" }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#248567" }} />
              <span className="text-sm font-medium" style={{ color: "#248567" }}>
                Analyzing calls... This may take a minute.
              </span>
            </div>
          </div>
        )}

        {/* Results summary after analysis */}
        {analyzeMutation.isSuccess && (
          <div className="px-8 pb-4">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#E7F6EE" }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: "#248567" }} />
              <span className="text-sm font-medium" style={{ color: "#248567" }}>
                {analyzeMutation.data.succeeded} call{analyzeMutation.data.succeeded === 1 ? "" : "s"} analyzed successfully
                {analyzeMutation.data.failed > 0 &&
                  `, ${analyzeMutation.data.failed} failed`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* How it works - collapsible info panel */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="w-full px-6 py-4 flex items-center justify-between text-left transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" style={{ color: "#248567" }} />
            <span className="text-sm font-semibold" style={{ color: "#248567" }}>
              How does this work?
            </span>
          </div>
          {showInfo ? (
            <ChevronUp className="w-4 h-4" style={{ color: "#87B5A7" }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: "#87B5A7" }} />
          )}
        </button>

        {showInfo && (
          <div className="px-6 pb-6 border-t" style={{ borderColor: "#EEE9E1" }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-5">

              {/* Filtering Funnel */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: "#242424" }}>
                    <Filter className="w-4 h-4" style={{ color: "#248567" }} />
                    Qualifying Call Filters
                  </h4>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: showFilters ? "#248567" : "#E7F6EE",
                      color: showFilters ? "#fff" : "#248567",
                    }}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    {showFilters ? "Done Editing" : "Edit Filters"}
                  </button>
                </div>
                {showFilters ? (
                  <EditableFilters />
                ) : (
                  <StaticFilterList />
                )}
              </div>

              {/* Right column: Refresh + Analyze info */}
              <div className="space-y-5">
                <div className="p-4 rounded-xl" style={{ backgroundColor: "#F8FAF9" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="w-4 h-4" style={{ color: "#248567" }} />
                    <h4 className="text-sm font-bold" style={{ color: "#242424" }}>How often new calls appear</h4>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#87B5A7" }}>
                    Call data is pulled live from the data warehouse each time you visit this tab or click the refresh button.
                    New calls appear as soon as they're processed by the Gong-to-Snowflake pipeline.
                  </p>
                </div>

                <div className="p-4 rounded-xl" style={{ backgroundColor: "#F8FAF9" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4" style={{ color: "#248567" }} />
                    <h4 className="text-sm font-bold" style={{ color: "#242424" }}>What "Analyze" does</h4>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#87B5A7" }}>
                    Sends the full call transcript to AI for scoring against the MOVE rubric
                    (Discovery, Motivation, Opportunity, Validation, Execution). Results are saved and viewable anytime in the History tab.
                  </p>
                </div>

                <div className="p-4 rounded-xl" style={{ backgroundColor: "#F8FAF9" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4" style={{ color: "#248567" }} />
                    <h4 className="text-sm font-bold" style={{ color: "#242424" }}>Data sources</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: "#E7F6EE", color: "#248567" }}>Gong</span>
                    <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: "#EEF0FF", color: "#4A5ABA" }}>Salesforce</span>
                    <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: "#FFF8E7", color: "#B58A1B" }}>Transcript</span>
                  </div>
                  <p className="text-xs leading-relaxed mt-2" style={{ color: "#87B5A7" }}>
                    Calls are cross-referenced across these sources via Snowflake to ensure only relevant coaching opportunities surface.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Call Cards */}
      {calls.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft p-12 text-center" style={{ border: "1px solid #EEE9E1" }}>
          <Phone className="w-12 h-12 mx-auto mb-4" style={{ color: "#B9CDC7" }} />
          <h3 className="text-lg font-bold mb-2" style={{ color: "#242424" }}>
            No qualifying calls found
          </h3>
          <p className="text-sm" style={{ color: "#87B5A7" }}>
            No Gong calls match the current filter criteria for your account.
            Your email may differ between PandaDoc and Gong.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {calls.map((call) => (
            <CallCard
              key={call.conversationId}
              call={call}
              selected={selectedIds.has(call.conversationId)}
              onToggle={() => toggleSelect(call.conversationId)}
              onViewAssessment={onViewAssessment}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface CallCardProps {
  call: GongCall;
  selected: boolean;
  onToggle: () => void;
  onViewAssessment?: (assessmentId: number) => void;
}

const CallCard: React.FC<CallCardProps> = ({ call, selected, onToggle, onViewAssessment }) => {
  return (
    <div
      onClick={call.alreadyAnalyzed ? undefined : onToggle}
      className={`bg-white rounded-xl shadow-soft overflow-hidden transition-all ${
        call.alreadyAnalyzed ? "" : "cursor-pointer hover:shadow-md"
      }`}
      style={{
        border: selected
          ? "2px solid #248567"
          : "1px solid #EEE9E1",
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm truncate" style={{ color: "#242424" }}>
              {call.title}
            </h4>
            {call.opportunityName && (
              <p className="text-xs mt-0.5 truncate" style={{ color: "#87B5A7" }}>
                {call.opportunityName}
              </p>
            )}
            {call.csmName && (
              <p className="text-xs mt-0.5 truncate flex items-center gap-1" style={{ color: "#87B5A7" }}>
                <User className="w-3 h-3" />
                {call.csmName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            {call.alreadyAnalyzed ? (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase"
                  style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {call.assessmentScore != null ? `${call.assessmentScore}/20` : "Analyzed"}
                </span>
                {call.assessmentId && onViewAssessment && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewAssessment(call.assessmentId!);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-colors hover:shadow-sm"
                    style={{ backgroundColor: "#EEF0FF", color: "#4A5ABA" }}
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                )}
              </div>
            ) : selected ? (
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ backgroundColor: "#248567" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            ) : (
              <div
                className="w-5 h-5 rounded-md"
                style={{ border: "2px solid #EEE9E1" }}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#87B5A7" }}>
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(call.callDate).toLocaleDateString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {call.durationMins} min
          </span>
          {call.daysUntilRenewal != null && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {call.daysUntilRenewal}d to renewal
            </span>
          )}
          {call.callUrl && (
            <a
              href={call.callUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Gong
            </a>
          )}
        </div>

        {call.matchedKeywords && (
          <div className="mt-2 flex flex-wrap gap-1">
            {call.matchedKeywords.split(', ').map((kw, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: "#FFF8E7", color: "#B58A1B" }}
              >
                <Sparkles className="w-2.5 h-2.5" />
                {kw}
              </span>
            ))}
          </div>
        )}

        {call.alreadyAnalyzed && call.analyzedBy && (
          <div className="mt-2 text-[10px] font-medium" style={{ color: "#87B5A7" }}>
            Analyzed by {call.analyzedBy}
          </div>
        )}
      </div>
    </div>
  );
}

const StaticFilterList: React.FC = () => {
  const { data: filters, isLoading } = useQualifyingFilters();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#248567" }} />
        <span className="text-xs" style={{ color: "#87B5A7" }}>Loading filters...</span>
      </div>
    );
  }

  const staticSteps = [
    { label: "All Gong calls", desc: "Every recorded call in the system", source: "Gong", alwaysOn: true },
  ];

  const activeFilters = (filters || []).filter((f) => f.enabled);

  const displaySteps = [
    ...staticSteps,
    ...activeFilters.map((f) => {
      let desc = f.description || "";
      if (f.key === "min_duration" && f.params) {
        desc = `Calls shorter than ${(f.params as any).minutes || 30} minutes are excluded`;
      }
      if (f.key === "min_days_renewal" && f.params) {
        desc = `Close date is at least ${(f.params as any).days || 90} days from today`;
      }
      if (f.key === "call_start_date" && f.params) {
        desc = `Only calls on or after ${(f.params as any).date || "2025-07-01"}`;
      }
      if (f.key === "transcript_patterns" && f.params) {
        const patterns = (f.params as any).patterns || [];
        desc = `${patterns.length} keyword pattern${patterns.length === 1 ? "" : "s"} checked`;
      }
      if (f.key === "call_title_patterns" && f.params) {
        const patterns = (f.params as any).patterns || [];
        desc = `${patterns.length} call title${patterns.length === 1 ? "" : "s"} matched`;
      }
      return { label: f.label, desc, source: f.source || "Gong" };
    }),
  ];

  return (
    <div className="space-y-0">
      {displaySteps.map((step, i, arr) => (
        <div key={i} className="flex items-stretch">
          <div className="flex flex-col items-center mr-3" style={{ width: "24px" }}>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
              style={{ backgroundColor: i === arr.length - 1 ? "#248567" : "#87B5A7", fontSize: "10px" }}
            >
              {i + 1}
            </div>
            {i < arr.length - 1 && (
              <div className="w-px flex-1 my-1" style={{ backgroundColor: "#D1E5DC" }} />
            )}
          </div>
          <div className={`flex-1 ${i < arr.length - 1 ? "pb-3" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "#242424" }}>{step.label}</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: step.source === "Gong" ? "#E7F6EE" : step.source === "Salesforce" ? "#EEF0FF" : "#FFF8E7",
                  color: step.source === "Gong" ? "#248567" : step.source === "Salesforce" ? "#4A5ABA" : "#B58A1B",
                  fontSize: "10px",
                }}
              >
                {step.source}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "#87B5A7" }}>{step.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const EditableFilters: React.FC = () => {
  const { data: filters, isLoading } = useQualifyingFilters();
  const updateMutation = useUpdateFilters();
  const addPatternMutation = useAddPattern();
  const removePatternMutation = useRemovePattern();
  const [newPattern, setNewPattern] = useState("");
  const [newPatternKey, setNewPatternKey] = useState<string | null>(null);
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [tempParamValue, setTempParamValue] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#248567" }} />
        <span className="text-xs" style={{ color: "#87B5A7" }}>Loading filters...</span>
      </div>
    );
  }

  const handleToggle = (filter: QualifyingFilter) => {
    updateMutation.mutate([{ key: filter.key, enabled: !filter.enabled }]);
  };

  const handleParamSave = (filter: QualifyingFilter, paramKey: string, value: number | string) => {
    const currentParams = (filter.params || {}) as Record<string, any>;
    updateMutation.mutate([{
      key: filter.key,
      params: { ...currentParams, [paramKey]: value },
    }]);
    setEditingParam(null);
  };

  const handleAddPattern = (filterKey: string) => {
    const trimmed = newPattern.trim();
    if (!trimmed) return;
    addPatternMutation.mutate({ pattern: trimmed, filterKey }, {
      onSuccess: () => { setNewPattern(""); setNewPatternKey(null); },
    });
  };

  const handleRemovePattern = (pattern: string, filterKey: string) => {
    removePatternMutation.mutate({ pattern, filterKey });
  };

  const sortedFilters = [...(filters || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="space-y-3">
      {sortedFilters.map((filter) => {
        const isPatternFilter = filter.key === "transcript_patterns" || filter.key === "call_title_patterns";
        const isDateFilter = filter.key === "call_start_date";
        const hasEditableParam = filter.key === "min_duration" || filter.key === "min_days_renewal";
        const paramKey = filter.key === "min_duration" ? "minutes" : "days";
        const paramValue = hasEditableParam ? ((filter.params as any)?.[paramKey] || (filter.key === "min_duration" ? 30 : 90)) : null;
        const paramLabel = filter.key === "min_duration" ? "minutes" : "days";

        return (
          <div
            key={filter.key}
            className="rounded-xl p-3 transition-all"
            style={{
              backgroundColor: filter.enabled ? "#F8FAF9" : "#FAFAFA",
              border: `1px solid ${filter.enabled ? "#D1E5DC" : "#EEE9E1"}`,
              opacity: filter.enabled ? 1 : 0.7,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                  style={{
                    backgroundColor: filter.source === "Gong" ? "#E7F6EE" : filter.source === "Salesforce" ? "#EEF0FF" : "#FFF8E7",
                    color: filter.source === "Gong" ? "#248567" : filter.source === "Salesforce" ? "#4A5ABA" : "#B58A1B",
                    fontSize: "10px",
                  }}
                >
                  {filter.source}
                </span>
                <span className="text-xs font-semibold truncate" style={{ color: "#242424" }}>
                  {filter.label}
                </span>
              </div>
              <button
                onClick={() => handleToggle(filter)}
                disabled={updateMutation.isPending}
                className="flex-shrink-0 ml-2"
                title={filter.enabled ? "Disable filter" : "Enable filter"}
              >
                {filter.enabled ? (
                  <ToggleRight className="w-6 h-6" style={{ color: "#248567" }} />
                ) : (
                  <ToggleLeft className="w-6 h-6" style={{ color: "#B9CDC7" }} />
                )}
              </button>
            </div>
            <p className="text-xs mt-1 ml-0" style={{ color: "#87B5A7" }}>
              {filter.description}
            </p>

            {hasEditableParam && filter.enabled && (
              <div className="mt-2 flex items-center gap-2">
                {editingParam === filter.key ? (
                  <>
                    <input
                      type="number"
                      value={tempParamValue}
                      onChange={(e) => setTempParamValue(e.target.value)}
                      className="w-20 px-2 py-1 text-xs rounded-md border focus:outline-none focus:ring-1"
                      style={{ borderColor: "#D1E5DC", color: "#242424" }}
                      min={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseInt(tempParamValue);
                          if (val > 0) handleParamSave(filter, paramKey, val);
                        }
                        if (e.key === "Escape") setEditingParam(null);
                      }}
                      autoFocus
                    />
                    <span className="text-xs" style={{ color: "#87B5A7" }}>{paramLabel}</span>
                    <button
                      onClick={() => {
                        const val = parseInt(tempParamValue);
                        if (val > 0) handleParamSave(filter, paramKey, val);
                      }}
                      className="px-2 py-1 rounded text-xs font-semibold"
                      style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingParam(null)}
                      className="px-2 py-1 rounded text-xs"
                      style={{ color: "#87B5A7" }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setEditingParam(filter.key);
                      setTempParamValue(String(paramValue));
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:bg-white"
                    style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
                  >
                    {paramValue} {paramLabel}
                    <Settings2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {isDateFilter && filter.enabled && (
              <div className="mt-2 flex items-center gap-2">
                {editingParam === filter.key ? (
                  <>
                    <input
                      type="date"
                      value={tempParamValue}
                      onChange={(e) => setTempParamValue(e.target.value)}
                      className="px-2 py-1 text-xs rounded-md border focus:outline-none focus:ring-1"
                      style={{ borderColor: "#D1E5DC", color: "#242424" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && tempParamValue) {
                          handleParamSave(filter, "date", tempParamValue);
                        }
                        if (e.key === "Escape") setEditingParam(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (tempParamValue) handleParamSave(filter, "date", tempParamValue);
                      }}
                      className="px-2 py-1 rounded text-xs font-semibold"
                      style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingParam(null)}
                      className="px-2 py-1 rounded text-xs"
                      style={{ color: "#87B5A7" }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setEditingParam(filter.key);
                      setTempParamValue((filter.params as any)?.date || "2025-07-01");
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:bg-white"
                    style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
                  >
                    {(filter.params as any)?.date || "2025-07-01"}
                    <Settings2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {isPatternFilter && filter.enabled && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {((filter.params as any)?.patterns || []).map((pattern: string, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                      style={{
                        backgroundColor: filter.key === "call_title_patterns" ? "#E7F6EE" : "#FFF8E7",
                        color: filter.key === "call_title_patterns" ? "#248567" : "#B58A1B",
                      }}
                    >
                      <code className="font-mono text-[10px]">{pattern}</code>
                      <button
                        onClick={() => handleRemovePattern(pattern, filter.key)}
                        disabled={removePatternMutation.isPending}
                        className="hover:opacity-70 ml-0.5"
                        title="Remove pattern"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPatternKey === filter.key ? newPattern : ""}
                    onChange={(e) => { setNewPattern(e.target.value); setNewPatternKey(filter.key); }}
                    onFocus={() => setNewPatternKey(filter.key)}
                    placeholder={filter.key === "call_title_patterns" ? "e.g. Success Sync" : "e.g. not using%product%"}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-md border focus:outline-none focus:ring-1"
                    style={{ borderColor: "#D1E5DC", color: "#242424" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddPattern(filter.key);
                    }}
                  />
                  <button
                    onClick={() => handleAddPattern(filter.key)}
                    disabled={!newPattern.trim() || newPatternKey !== filter.key || addPatternMutation.isPending}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-40"
                    style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
                  >
                    {addPatternMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GongCalls;
