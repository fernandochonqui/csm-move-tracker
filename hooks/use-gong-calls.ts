import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface GongCall {
  conversationId: string;
  title: string;
  callDate: string;
  callUrl: string;
  csmName: string;
  durationMins: number;
  opportunityName: string;
  renewalDate: string;
  daysUntilRenewal: number;
  matchedKeywords: string | null;
  alreadyAnalyzed: boolean;
  assessmentId: number | null;
  assessmentScore: number | null;
  analyzedBy: string | null;
}

export interface GongCallsResponse {
  calls: GongCall[];
  total: number;
}

export interface AnalyzeResult {
  conversationId: string;
  assessmentId: number;
  success: boolean;
  error?: string;
}

export interface AnalyzeResponse {
  results: AnalyzeResult[];
  succeeded: number;
  failed: number;
}

export function useGongCalls() {
  return useQuery<GongCallsResponse>({
    queryKey: ["/api/gong/qualifying-calls"],
    queryFn: async () => {
      const response = await fetch("/api/gong/qualifying-calls", {
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch qualifying calls");
      }
      return response.json();
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAnalyzeGongCalls() {
  const queryClient = useQueryClient();

  return useMutation<AnalyzeResponse, Error, string[]>({
    mutationFn: async (conversationIds: string[]) => {
      const response = await fetch("/api/gong/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationIds }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Batch analysis failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gong/qualifying-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assessments/shared/with-me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trends/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/csql-outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
    },
  });
}
