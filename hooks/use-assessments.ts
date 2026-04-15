import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Assessment {
  id: number;
  userId: string;
  accountName: string | null;
  transcript: string;
  scores: any;
  stakeholders: any;
  executiveSummary: string | null;
  keyStrengths: any;
  coachingTips: any;
  qa: any;
  totalScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrendsData {
  trends: Array<{
    index: number;
    date: string;
    accountName: string | null;
    totalScore: number | null;
    discovery?: number;
    motivation?: number;
    opportunity?: number;
    validation?: number;
    execution?: number;
  }>;
  averages: Record<string, number>;
  totalAssessments: number;
  averageTotalScore: number;
}

export function useAssessments() {
  return useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
    queryFn: async () => {
      const response = await fetch("/api/assessments", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch assessments");
      return response.json();
    },
  });
}

export function useAssessment(id: number | null) {
  return useQuery<Assessment>({
    queryKey: ["/api/assessments", id],
    queryFn: async () => {
      const response = await fetch(`/api/assessments/${id}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch assessment");
      return response.json();
    },
    enabled: id !== null,
  });
}

export function useSharedWithMe() {
  return useQuery({
    queryKey: ["/api/assessments/shared/with-me"],
    queryFn: async () => {
      const response = await fetch("/api/assessments/shared/with-me", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch shared assessments");
      return response.json();
    },
  });
}

export function useTrends() {
  return useQuery<TrendsData>({
    queryKey: ["/api/trends"],
    queryFn: async () => {
      const response = await fetch("/api/trends", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch trends");
      return response.json();
    },
  });
}

export interface TeamTrendsData {
  trends: Array<{
    index: number;
    date: string;
    accountName: string | null;
    totalScore: number | null;
    userName: string;
    csmName?: string;
    manager?: string | null;
    discovery?: number;
    motivation?: number;
    opportunity?: number;
    validation?: number;
    execution?: number;
  }>;
  averages: Record<string, number>;
  totalAssessments: number;
  averageTotalScore: number;
}

export function useTeamTrends() {
  return useQuery<TeamTrendsData>({
    queryKey: ["/api/trends/team"],
    queryFn: async () => {
      const response = await fetch("/api/trends/team", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch team trends");
      return response.json();
    },
  });
}

export function useShareAssessment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ assessmentId, email, permission = "view" }: { assessmentId: number; email: string; permission?: string }) => {
      const response = await fetch(`/api/assessments/${assessmentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, permission }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to share assessment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
    },
  });
}

export function useSearchUsers() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(`/api/users/search?email=${encodeURIComponent(email)}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to search users");
      return response.json();
    },
  });
}
