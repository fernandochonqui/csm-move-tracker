import { AIAnalysisResult } from "../types";

export const analyzeCallTranscript = async (transcript: string, accountName?: string): Promise<AIAnalysisResult & { id: number }> => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ transcript, accountName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Analysis failed');
  }

  return response.json();
};
