import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface QualifyingFilter {
  id: number;
  key: string;
  label: string;
  description: string | null;
  source: string | null;
  enabled: boolean | null;
  params: Record<string, any> | null;
  sortOrder: number | null;
}

export function useQualifyingFilters() {
  return useQuery<QualifyingFilter[]>({
    queryKey: ["/api/qualifying-filters"],
    queryFn: async () => {
      const response = await fetch("/api/qualifying-filters", {
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch filters");
      }
      return response.json();
    },
    staleTime: 30 * 1000,
  });
}

export function useUpdateFilters() {
  const queryClient = useQueryClient();

  return useMutation<QualifyingFilter[], Error, Array<{ key: string; enabled?: boolean; params?: any }>>({
    mutationFn: async (updates) => {
      const response = await fetch("/api/qualifying-filters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update filters");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/qualifying-filters"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/gong/qualifying-calls"] });
    },
  });
}

export function useAddPattern() {
  const queryClient = useQueryClient();

  return useMutation<QualifyingFilter[], Error, { pattern: string; filterKey: string }>({
    mutationFn: async ({ pattern, filterKey }) => {
      const response = await fetch("/api/qualifying-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pattern, filterKey }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to add pattern");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/qualifying-filters"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/gong/qualifying-calls"] });
    },
  });
}

export function useRemovePattern() {
  const queryClient = useQueryClient();

  return useMutation<QualifyingFilter[], Error, { pattern: string; filterKey: string }>({
    mutationFn: async ({ pattern, filterKey }) => {
      const response = await fetch("/api/qualifying-filters/pattern", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pattern, filterKey }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to remove pattern");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/qualifying-filters"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/gong/qualifying-calls"] });
    },
  });
}

export const useAddTranscriptPattern = useAddPattern;
export const useRemoveTranscriptPattern = useRemovePattern;
