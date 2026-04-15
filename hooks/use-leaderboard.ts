import { useQuery } from "@tanstack/react-query";

export interface LeaderboardEntry {
  csmName: string;
  segment: string | null;
  attachment: string | null;
  manager: string | null;
  assessmentCount: number;
  averageTotal: number;
  maxTotal: number;
  phases: Record<string, { average: number; count: number }>;
}

export interface LeaderboardFilters {
  manager?: string;
  segment?: string;
  attachment?: string;
}

export function useLeaderboard(filters?: LeaderboardFilters) {
  const params = new URLSearchParams();
  if (filters?.manager) params.set("manager", filters.manager);
  if (filters?.segment) params.set("segment", filters.segment);
  if (filters?.attachment) params.set("attachment", filters.attachment);
  const qs = params.toString();
  const url = `/api/leaderboard${qs ? `?${qs}` : ""}`;

  return useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", filters],
    queryFn: async () => {
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch leaderboard");
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}
