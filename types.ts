
export interface ScoreLevel {
  value: number;
  description: string;
}

export interface RubricCategory {
  id: string;
  title: string;
  subtitle?: string;
  question: string;
  levels: ScoreLevel[];
}

export interface ScoredCategory {
  categoryId: string;
  score: number;
  notes?: string;
}

export interface CategoryAnalysis {
  categoryId: string;
  score: number;
  reasoning: string;
  gap: string;
  quotes: string[];
  betterQuestion: string;
  recommendation: string;
}

export interface QAItem {
  id: string;
  label: string;
  question: string;
  status: 'yes' | 'no' | 'n/a';
  evidence?: string;
}

export interface Stakeholder {
  name: string;
  title: string;
  persona: string; // e.g., Decision Maker, Champion, Detractor
  sentiment: 'Positive' | 'Neutral' | 'Skeptical' | 'Negative' | 'Unknown';
  influence?: 'High' | 'Medium' | 'Low';
  keyInterest?: string;
  missingInfo?: boolean;
  painPoints?: string[]; // Alignment with Motivation (M)
  businessGoal?: string; // Alignment with Opportunity (O)
  additionalNotes?: string; // Nuanced details or context
}

export interface AIAnalysisResult {
  scores: CategoryAnalysis[];
  executiveSummary: string;
  keyStrengths: string[];
  coachingTips: string[];
  qa?: QAItem[];
  stakeholders?: Stakeholder[];
}

export interface AssessmentHistoryItem {
  id: string;
  date: string;
  csmName: string;
  label: string;
  totalScore: number;
  maxScore: number;
  scorePercentage: number;
  scores: Record<string, number>;
  qa?: QAItem[];
  stakeholders?: Stakeholder[];
  aiData?: Record<string, CategoryAnalysis>;
  aiSummary?: {
    executiveSummary: string;
    keyStrengths: string[];
    coachingTips: string[];
  };
}
