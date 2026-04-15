import { useQuery } from "@tanstack/react-query";

export interface CSQLLinkedAssessment {
  assessmentId: number;
  totalScore: number | null;
  callDate: string | null;
  gongConversationId: string | null;
  scores: any[];
}

export interface CSQLOutcome {
  oppId: string;
  oppName: string;
  accountName: string;
  amount: number | null;
  stageName: string;
  createdDate: string;
  closeDate: string | null;
  createdByName: string;
  closedStatus: "Open" | "Closed Won" | "Closed Lost";
  creatorSegment: string | null;
  creatorManager: string | null;
  isOverridden?: boolean;
  isExcluded?: boolean;
  linkedAssessment: CSQLLinkedAssessment | null;
  matchConfidence: { confidence: "green" | "yellow" | "red"; reasoning: string | null; isManual: boolean } | null;
}

export interface CSQLSummary {
  totalCSQLs: number;
  linkedCount: number;
  closedWonCount: number;
  closedLostCount: number;
  openCount: number;
  totalPipeline: number;
  wonPipeline: number;
  avgLinkedScore: number | null;
  avgWonScore: number | null;
  avgLostScore: number | null;
  winRate: number | null;
  stageDistribution: Record<string, { count: number; pipeline: number }>;
}

export interface CSQLOutcomesData {
  csqls: CSQLOutcome[];
  roster: { name: string; manager: string }[];
  summary: CSQLSummary;
}

export function useCSQLOutcomes() {
  return useQuery<CSQLOutcomesData>({
    queryKey: ["/api/csql-outcomes"],
    queryFn: async () => {
      const response = await fetch("/api/csql-outcomes", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch CSQL outcomes");
      }
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export interface StageAverage {
  stage: string;
  avgDaysWon: number | null;
  avgDaysLost: number | null;
  wonCount: number;
  lostCount: number;
}

export interface CSQLStageHistoryData {
  perOpp: Record<string, number>;
  stageAverages: StageAverage[];
}

export function useCSQLStageHistory(from?: string, to?: string) {
  return useQuery<CSQLStageHistoryData>({
    queryKey: ["/api/csql-stage-history", from ?? "all", to ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const url = `/api/csql-stage-history${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stage history");
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useCSQLUnscoredCount() {
  return useQuery<{ unscoredCount: number }>({
    queryKey: ["/api/csql-unscored-count"],
    queryFn: async () => {
      const response = await fetch("/api/csql-unscored-count", {
        credentials: "include",
      });
      if (!response.ok) {
        return { unscoredCount: 0 };
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
