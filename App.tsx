
import React, { useState, useMemo } from 'react';
import { MOVE_RUBRIC } from './constants';
import RubricSection from './components/RubricSection';
import TranscriptInput from './components/TranscriptInput';
import LandingPage from './components/LandingPage';
import AssessmentHistory from './components/AssessmentHistory';
import TrendsView from './components/TrendsView';
import SharedWithMe from './components/SharedWithMe';
import GongCalls from './components/GongCalls';
import Leaderboard from './components/Leaderboard';

import CSQLOutcomes from './components/CSQLOutcomes';
import { useAuth } from './hooks/use-auth';
import { useGongCalls } from './hooks/use-gong-calls';
import { useCSQLUnscoredCount } from './hooks/use-csql-outcomes';
import { Assessment } from './hooks/use-assessments';
import { AIAnalysisResult, CategoryAnalysis, QAItem, Stakeholder } from './types';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  Tooltip 
} from 'recharts';
import { 
  Sparkles, RefreshCw, Trophy, ThumbsUp, TrendingUp, FileText, 
  LayoutDashboard, PlusCircle, User, Tag, Zap, LogOut, History, Share2,
  Target, CheckCircle2, ArrowUpRight, Users, Smile, Meh, Frown, HelpCircle,
  Crown, Briefcase, ShieldAlert, Signal, Lightbulb, Flame, Phone,
  DollarSign, ChevronDown, BarChart3
} from 'lucide-react';

const App: React.FC = () => {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { data: gongData } = useGongCalls();
  const newGongCallCount = gongData?.calls?.filter(c => !c.alreadyAnalyzed).length || 0;
  const { data: csqlCountData } = useCSQLUnscoredCount();
  const unscoredCSQLCount = csqlCountData?.unscoredCount || 0;

  // --- State (ALL hooks must be declared before any conditional returns) ---
  const [view, setView] = useState<'form' | 'history' | 'trends' | 'shared' | 'gong' | 'leaderboard' | 'csql'>('form');
  const [sessionId, setSessionId] = useState(0);
  
  // Assessment Data
  const [accountName, setAccountName] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [aiData, setAiData] = useState<Record<string, CategoryAnalysis>>({});
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [aiSummary, setAiSummary] = useState<{
    executiveSummary: string;
    keyStrengths: string[];
    coachingTips: string[];
  } | null>(null);
  const [currentAssessmentId, setCurrentAssessmentId] = useState<number | null>(null);
  const [isRescoring, setIsRescoring] = useState(false);

  // --- Computed (useMemo must be called before conditional returns) ---
  const totalScore = (Object.values(scores) as number[]).reduce((a, b) => a + b, 0);
  const maxScore = MOVE_RUBRIC.length * 4;
  const scorePercentage = Math.round((totalScore / maxScore) * 100) || 0;

  const chartData = useMemo(() => {
    return MOVE_RUBRIC.map(cat => ({
      subject: cat.title.split('-')[0].trim(),
      fullTitle: cat.title,
      score: scores[cat.id] || 0,
      fullMark: 4
    }));
  }, [scores]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Show landing page if not authenticated
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // --- Handlers ---

  const handleAIComplete = (result: AIAnalysisResult & { id?: number }) => {
    const newScores: Record<string, number> = {};
    const newAiData: Record<string, CategoryAnalysis> = {};

    result.scores.forEach(item => {
      newScores[item.categoryId] = item.score;
      newAiData[item.categoryId] = item;
    });

    setScores(newScores);
    setAiData(newAiData);
    setQaItems(result.qa || []); 
    setStakeholders(result.stakeholders || []);
    if (result.id) setCurrentAssessmentId(result.id);

    setAiSummary({
      executiveSummary: result.executiveSummary,
      keyStrengths: result.keyStrengths,
      coachingTips: result.coachingTips
    });
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all scores?")) {
      setScores({});
      setAiData({});
      setQaItems([]);
      setStakeholders([]);
      setAiSummary(null);
      setAccountName('');
      setCurrentAssessmentId(null);
      setSessionId(prev => prev + 1);
    }
  };

  const handleNewSession = () => {
    const hasData = Object.keys(scores).length > 0 || accountName || aiSummary;
    
    if (hasData) {
      if (window.confirm("Start a new assessment?\n\n• OK: Clears current form and starts fresh\n• Cancel: Keeps current data")) {
        setScores({});
        setAiData({});
        setQaItems([]);
        setStakeholders([]);
        setAiSummary(null);
        setAccountName('');
        setCurrentAssessmentId(null);
        setSessionId(prev => prev + 1);
        setView('form');
      } else {
        setView('form');
      }
    } else {
      setView('form');
    }
  };

  const handleViewGongAssessment = async (assessmentId: number) => {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch assessment");
      const assessment = await response.json();
      handleViewAssessment(assessment);
    } catch (error) {
      console.error("Error viewing assessment:", error);
    }
  };

  const handleViewAssessment = (assessment: Assessment) => {
    const scoresData = assessment.scores as any[];
    const newScores: Record<string, number> = {};
    const newAiData: Record<string, CategoryAnalysis> = {};
    
    scoresData?.forEach((item: any) => {
      newScores[item.categoryId] = item.score;
      newAiData[item.categoryId] = item;
    });
    
    setAccountName(assessment.accountName || '');
    setScores(newScores);
    setAiData(newAiData);
    setQaItems((assessment.qa as QAItem[]) || []);
    setStakeholders((assessment.stakeholders as Stakeholder[]) || []);
    setAiSummary({
      executiveSummary: assessment.executiveSummary || '',
      keyStrengths: (assessment.keyStrengths as string[]) || [],
      coachingTips: (assessment.coachingTips as string[]) || [],
    });
    setCurrentAssessmentId(assessment.id ? Number(assessment.id) : null);
    setSessionId(prev => prev + 1);
    setView('form');
  };

  const handleRescore = async () => {
    if (!currentAssessmentId) return;
    setIsRescoring(true);
    try {
      const response = await fetch(`/api/assessments/${currentAssessmentId}/rescore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Rescore failed');
      }
      const result = await response.json();
      const newScores: Record<string, number> = {};
      const newAiData: Record<string, CategoryAnalysis> = {};
      result.scores?.forEach((item: any) => {
        newScores[item.categoryId] = item.score;
        newAiData[item.categoryId] = item;
      });
      setScores(newScores);
      setAiData(newAiData);
      setQaItems(result.qa || []);
      setStakeholders(result.stakeholders || []);
      setAiSummary({
        executiveSummary: result.executiveSummary || '',
        keyStrengths: result.keyStrengths || [],
        coachingTips: result.coachingTips || [],
      });
      setSessionId(prev => prev + 1);
    } catch (error: any) {
      console.error('Rescore error:', error);
      alert(error.message || 'Failed to rescore. Please try again.');
    } finally {
      setIsRescoring(false);
    }
  };
  
  const handleRescoreById = async (assessmentId: number) => {
    const response = await fetch(`/api/assessments/${assessmentId}/rescore`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Rescore failed');
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    const s = sentiment.toLowerCase();
    if (s.includes('positive')) return <Smile className="w-4 h-4" style={{ color: '#248567' }} />;
    if (s.includes('negative')) return <Frown className="w-4 h-4" style={{ color: '#FF8B6C' }} />;
    if (s.includes('skeptical')) return <HelpCircle className="w-4 h-4" style={{ color: '#FF8B6C' }} />;
    if (s.includes('neutral')) return <Meh className="w-4 h-4" style={{ color: '#87B5A7' }} />;
    return <Meh className="w-4 h-4" style={{ color: '#87B5A7' }} />;
  };

  const handleExportPDF = () => {
    if (totalScore === 0) {
      alert("Please complete the assessment before exporting.");
      return;
    }

    const date = new Date().toLocaleDateString();
    
    // Updated styling to match PandaDoc Green (#248567)
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>PandaDoc MOVE Assessment</title>
        <style>
          body { font-family: 'Graphik LC Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', Helvetica, Arial, sans-serif; line-height: 1.6; color: #242424; max-width: 800px; margin: 0 auto; padding: 40px; background: #fff; }
          @media print {
            body { max-width: 100%; padding: 20px; margin: 0; background: #fff; }
            .no-print { display: none; }
          }
          h1 { color: #248567; border-bottom: 2px solid #D6CEFF; padding-bottom: 20px; margin-bottom: 30px; }
          h2 { color: #242424; margin-top: 40px; margin-bottom: 15px; border-bottom: 1px solid #EEE9E1; padding-bottom: 8px; page-break-after: avoid; }
          h3 { color: #248567; margin-top: 25px; margin-bottom: 10px; font-size: 1.1em; page-break-after: avoid; }
          .meta-row { display: flex; gap: 20px; margin-bottom: 30px; border-bottom: 1px solid #EEE9E1; padding-bottom: 20px; }
          .meta-item { flex: 1; }
          .meta-label { font-size: 0.85em; text-transform: uppercase; color: #B9CDC7; font-weight: bold; }
          .meta-value { font-size: 1.1em; font-weight: 500; color: #242424; }
          .score-large { font-size: 2em; font-weight: bold; color: #248567; }
          .category { margin-bottom: 30px; page-break-inside: avoid; border: 1px solid #EEE9E1; padding: 20px; border-radius: 8px; background: #fff; }
          .category-header { display: flex; justify-content: space-between; align-items: baseline; background: #E7F6EE; padding: 10px 15px; border-radius: 6px; margin-bottom: 15px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .category-title { font-weight: bold; color: #242424; font-size: 1.1em; }
          .category-score { font-weight: bold; color: #248567; }
          .quote { font-style: italic; color: #242424; border-left: 3px solid #D6CEFF; padding-left: 15px; margin: 10px 0; background: #F8F5F3; padding: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .section-box { background: #fff; border: 1px solid #EEE9E1; padding: 15px; border-radius: 6px; margin-top: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .section-label { font-size: 0.85em; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; display: block; }
          .strength-item { background: #E7F6EE; border: 1px solid #87B5A7; color: #248567; padding: 10px; margin-bottom: 8px; border-radius: 6px; font-size: 0.9em; }
          .action-item { background: #EEE8FF; border: 1px solid #C5BCFF; color: #A496FF; padding: 10px; margin-bottom: 8px; border-radius: 6px; font-size: 0.9em; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          ul { margin-top: 5px; padding-left: 20px; }
          li { margin-bottom: 5px; }
          .stakeholder-card { border: 1px solid #EEE9E1; border-radius: 8px; padding: 15px; background: #F8F5F3; page-break-inside: avoid; margin-bottom: 15px; }
          .sh-section { margin-top: 10px; padding-top: 10px; border-top: 1px solid #EEE9E1; }
          .sh-label { font-size: 0.7em; text-transform: uppercase; font-weight: bold; color: #B9CDC7; display: block; margin-bottom: 4px; }
          .sh-val { font-size: 0.9em; color: #242424; }
        </style>
      </head>
      <body>
        <h1>MOVE Assessment Report</h1>
        
        <div class="meta-row">
            <div class="meta-item">
                <div class="meta-label">Account</div>
                <div class="meta-value">${accountName || 'N/A'}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Assessed By</div>
                <div class="meta-value">${user?.firstName || user?.email || 'N/A'}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Date</div>
                <div class="meta-value">${date}</div>
            </div>
        </div>

        <div style="background: #E7F6EE; border: 1px solid #248567; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <div style="margin-bottom: 10px; color: #248567;"><strong>Total Score</strong></div>
          <div class="score-large">${totalScore} / ${maxScore} <span style="font-size: 0.5em; color: #B9CDC7; font-weight: normal;">(${scorePercentage}%)</span></div>
        </div>

        ${aiSummary ? `
          <h2>Executive Summary</h2>
          <p>${aiSummary.executiveSummary}</p>
          
          <table style="width: 100%; border-collapse: separate; border-spacing: 0 10px; margin-top: 20px; break-inside: avoid;">
            <tr style="vertical-align: top;">
              <td style="width: 50%; padding-right: 20px;">
                <h3 style="margin-top: 0; color: #248567;">Key Strengths</h3>
                <div>
                  ${aiSummary.keyStrengths.map(s => `<div class="strength-item">✓ ${s}</div>`).join('')}
                </div>
              </td>
              <td style="width: 50%;">
                <h3 style="margin-top: 0; color: #A496FF;">Actionable Recommendations</h3>
                <div>
                  ${aiSummary.coachingTips.map(t => `<div class="action-item">➜ ${t}</div>`).join('')}
                </div>
              </td>
            </tr>
          </table>
        ` : ''}

        ${stakeholders.length > 0 ? `
          <h2>Stakeholder Map</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px;">
            ${stakeholders.map(s => `
              <div class="stakeholder-card" style="border-color: ${s.missingInfo ? '#FFB3A6' : '#EEE9E1'}; background: ${s.missingInfo ? '#FFEAE7' : '#F8F5F3'};">
                 <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; background: ${s.missingInfo ? '#FFEAE7' : '#fff'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: ${s.missingInfo ? '#FF8B6C' : '#B9CDC7'}; border: 1px solid ${s.missingInfo ? '#FFB3A6' : '#EEE9E1'};">${s.missingInfo ? '?' : s.name.charAt(0)}</div>
                        <div>
                            <div style="font-weight: bold; color: ${s.missingInfo ? '#FF8B6C' : '#242424'}; font-size: 0.95em;">${s.name} ${s.missingInfo ? '(Missing Info)' : ''}</div>
                            <div style="font-size: 0.8em; color: ${s.missingInfo ? '#FF8B6C' : '#B9CDC7'};">${s.title}</div>
                        </div>
                    </div>
                 </div>
                 <div style="display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap;">
                    <span style="font-size: 0.7em; text-transform: uppercase; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #D4C7B1; background: #fff; color: #242424;">${s.persona}</span>
                    <span style="font-size: 0.7em; text-transform: uppercase; font-weight: bold; padding: 2px 6px; border-radius: 4px; ${
                      s.sentiment === 'Positive' ? 'background: #E7F6EE; color: #248567;' :
                      s.sentiment === 'Neutral' ? 'background: #F8F5F3; color: #87B5A7;' :
                      s.sentiment === 'Skeptical' ? 'background: #FFEAE7; color: #FF8B6C;' :
                      s.sentiment === 'Negative' ? 'background: #FFEAE7; color: #FF8B6C;' :
                      'background: #F8F5F3; color: #242424;'
                    }">${s.sentiment}</span>
                    ${s.influence ? `<span style="font-size: 0.7em; text-transform: uppercase; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: #EEE8FF; color: #A496FF;">${s.influence} Inf.</span>` : ''}
                 </div>
                 
                 ${s.painPoints && s.painPoints.length > 0 ? `
                 <div class="sh-section" style="background: #FFEAE7; padding: 8px; border-radius: 4px; margin-top: 8px;">
                    <span class="sh-label" style="color: #FF8B6C;">Pain</span>
                    <ul style="margin: 0; padding-left: 15px; font-size: 0.85em; color: #FF8B6C;">
                        ${s.painPoints.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                 </div>` : ''}

                 ${s.businessGoal ? `
                 <div class="sh-section" style="background: #E7F6EE; padding: 8px; border-radius: 4px; margin-top: 8px;">
                    <span class="sh-label" style="color: #248567;">Goal</span>
                    <div class="sh-val" style="color: #248567; font-size: 0.85em;">${s.businessGoal}</div>
                 </div>` : ''}

                 ${s.additionalNotes ? `
                 <div class="sh-section" style="background: #F8F5F3; padding: 8px; border-radius: 4px; margin-top: 8px; border: 1px solid #EEE9E1;">
                    <span class="sh-label" style="color: #B9CDC7;">Notes</span>
                    <div class="sh-val" style="color: #242424; font-size: 0.85em; font-style: italic;">${s.additionalNotes}</div>
                 </div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <h2>Methodology Breakdown</h2>
        ${MOVE_RUBRIC.map(cat => {
          const score = scores[cat.id] || 0;
          const data = aiData[cat.id];
          const scoreDesc = cat.levels.find(l => l.value === score)?.description || 'Not scored';
          
          return `
            <div class="category">
              <div class="category-header">
                <span class="category-title">${cat.title}</span>
                <span class="category-score">Score: ${score}/4</span>
              </div>
              <p><strong>Rubric Criteria:</strong> ${scoreDesc}</p>
              
              ${data ? `
                <div style="margin-top: 15px;">
                  <span class="section-label" style="color: #B9CDC7;">Observation</span>
                  <p>${data.reasoning}</p>
                </div>

                <div class="grid-2">
                  <div class="section-box" style="border-left: 3px solid #B9CDC7;">
                    <span class="section-label" style="color: #B9CDC7;">Evidence</span>
                    ${data.quotes.length > 0 ? data.quotes.map(q => `<div style="font-style: italic; font-size: 0.9em; margin-bottom: 5px;">"${q}"</div>`).join('') : '<span style="font-style:italic; color:#B9CDC7;">No quotes found</span>'}
                  </div>

                  <div class="section-box" style="border-left: 3px solid #FF8B6C; background: #FFEAE7;">
                    <span class="section-label" style="color: #FF8B6C;">The Gap</span>
                    <p style="color: #FF8B6C;">${data.gap}</p>
                  </div>
                </div>

                <div class="grid-2">
                   <div class="section-box" style="border-left: 3px solid #A496FF; background: #EEE8FF;">
                    <span class="section-label" style="color: #A496FF;">Recommendation</span>
                    <p style="color: #A496FF;">${data.recommendation || ''}</p>
                  </div>

                  <div class="section-box" style="border-left: 3px solid #248567; background: #E7F6EE;">
                    <span class="section-label" style="color: #248567;">Better Question</span>
                    <p style="font-style: italic; color: #248567;">"${data.betterQuestion || ''}"</p>
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-light font-sans text-dark">
      {/* Modern Header */}
      <header className="bg-white border-b sticky top-0 z-30" style={{ borderColor: '#EEE9E1' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <img src="/pandadoc-logo.png" alt="PandaDoc Logo" className="w-9 h-9 rounded-lg" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-dark leading-none tracking-tight">PandaDoc <span className="text-primary">MOVE</span> Scorer</h1>
              <p className="text-[10px] font-medium uppercase tracking-widest mt-0.5" style={{ color: '#87B5A7' }}>Sales Excellence</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 p-1 rounded-full overflow-x-auto scrollbar-hide" style={{ backgroundColor: '#F8F5F3', border: '1px solid #EEE9E1' }}>
            {[
              { key: 'form', label: 'New', icon: <PlusCircle className="w-4 h-4" />, onClick: handleNewSession },
              { key: 'history', label: 'History', icon: <History className="w-4 h-4" />, onClick: () => setView('history') },
              { key: 'gong', label: 'Gong', icon: <Phone className="w-4 h-4" />, onClick: () => setView('gong'), badge: newGongCallCount },
              { key: 'csql', label: 'CSQL', icon: <DollarSign className="w-4 h-4" />, onClick: () => setView('csql'), badge: unscoredCSQLCount },
              { key: 'trends', label: 'Trends', icon: <TrendingUp className="w-4 h-4" />, onClick: () => setView('trends') },
              { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="w-4 h-4" />, onClick: () => setView('leaderboard') },
              { key: 'shared', label: 'Shared', icon: <Share2 className="w-4 h-4" />, onClick: () => setView('shared') },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={tab.onClick}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 whitespace-nowrap flex-shrink-0 ${
                  view === tab.key ? 'bg-white text-primary shadow-sm' : 'hover:text-dark'
                }`}
                style={view === tab.key ? { border: '1px solid #EEE9E1' } : { color: '#87B5A7' }}
                aria-current={view === tab.key ? 'page' : undefined}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {'badge' in tab && tab.badge > 0 && (
                  <span
                    className="inline-flex items-center justify-center text-[10px] font-bold leading-none rounded-full"
                    style={{
                      backgroundColor: '#248567',
                      color: '#fff',
                      minWidth: '18px',
                      height: '18px',
                      padding: '0 5px',
                    }}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            {view === 'form' && (
              <>
                <button
                  onClick={handleExportPDF}
                  className="p-2 hover:text-primary rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-primary focus:outline-none"
                  style={{ color: '#87B5A7', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E7F6EE'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="Export as PDF"
                  aria-label="Export as PDF"
                >
                  <FileText className="w-5 h-5" />
                </button>

                <button
                  onClick={handleReset}
                  className="p-2 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-primary focus:outline-none"
                  style={{ color: '#B9CDC7', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#FF8B6C'; e.currentTarget.style.backgroundColor = '#FFEAE7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#B9CDC7'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  title="Reset Form"
                  aria-label="Reset Form"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </>
            )}

            <button
              onClick={() => logout()}
              className="p-2 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-primary focus:outline-none"
              style={{ color: '#B9CDC7' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#242424'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#B9CDC7'}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {view === 'history' ? (
           <AssessmentHistory onViewAssessment={handleViewAssessment} onRescore={handleRescoreById} />
        ) : view === 'trends' ? (
           <TrendsView />
        ) : view === 'shared' ? (
           <SharedWithMe onViewAssessment={handleViewAssessment} />
        ) : view === 'gong' ? (
           <GongCalls onViewAssessment={handleViewGongAssessment} />
        ) : view === 'leaderboard' ? (
           <Leaderboard />
        ) : view === 'csql' ? (
           <CSQLOutcomes onViewAssessment={handleViewGongAssessment} />
        ) : (
          <>
          {/* Gong Notification Banner */}
          {newGongCallCount > 0 && (
            <div
              onClick={() => setView('gong')}
              className="mb-6 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
              style={{ backgroundColor: '#E7F6EE', border: '1px solid #87B5A7' }}
            >
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5" style={{ color: '#248567' }} />
                <span className="text-sm font-semibold" style={{ color: '#248567' }}>
                  You have {newGongCallCount} new qualifying Gong call{newGongCallCount === 1 ? '' : 's'} ready for analysis
                </span>
              </div>
              <span className="text-sm font-bold" style={{ color: '#248567' }}>
                View &rarr;
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Form */}
            <div className="lg:col-span-2 space-y-6">

              {/* Modern Score Summary Card (Overall Performance) - Moved to TOP */}
              <div className="bg-white rounded-2xl shadow-soft overflow-hidden relative" style={{ border: '1px solid #EEE9E1' }}>
                  {/* Decorative Background */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/5 to-secondary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                  <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                      <div>
                          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#87B5A7' }}>Overall Performance</div>
                          <div className="flex items-baseline gap-3">
                              <span className={`text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r ${
                                  totalScore > 0
                                  ? (scorePercentage >= 80 ? 'from-primary to-emerald-400' : scorePercentage >= 60 ? 'from-coral to-orange-500' : 'from-coral to-pink-500')
                                  : ''
                              }`}
                              style={totalScore === 0 ? { color: '#B9CDC7', backgroundImage: 'none', backgroundClip: 'border-box', WebkitTextFillColor: 'inherit' } : {}}>
                                  {totalScore}
                              </span>
                              <span className="text-2xl font-medium" style={{ color: '#B9CDC7' }}>/ {maxScore}</span>
                          </div>
                      </div>

                      {totalScore > 0 && (
                        <div className="flex items-center gap-3">
                          {currentAssessmentId && (
                            <button
                              onClick={handleRescore}
                              disabled={isRescoring}
                              className="px-4 py-3 rounded-xl border flex items-center gap-2 text-sm font-semibold transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{
                                backgroundColor: '#F8F5F0',
                                borderColor: '#EEE9E1',
                                color: '#4A5ABA',
                              }}
                            >
                              <RefreshCw className={`w-4 h-4 ${isRescoring ? 'animate-spin' : ''}`} />
                              {isRescoring ? 'Rescoring...' : 'Rescore'}
                            </button>
                          )}
                          <div className={`px-6 py-4 rounded-xl border flex flex-col items-center shadow-sm`}
                          style={{
                              backgroundColor: scorePercentage >= 80 ? '#E7F6EE' : scorePercentage >= 60 ? '#fff7ed' : '#FFEAE7',
                              borderColor: scorePercentage >= 80 ? '#87B5A7' : scorePercentage >= 60 ? '#ffedd5' : '#FFB3A6',
                              color: scorePercentage >= 80 ? '#248567' : scorePercentage >= 60 ? '#c2410c' : '#FF8B6C'
                          }}>
                              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-1">
                                  {scorePercentage >= 80 ? <Sparkles className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                                  Rating
                              </div>
                              <div className="font-bold text-2xl">
                                  {scorePercentage >= 80 ? 'Excellent' : scorePercentage >= 60 ? 'Average' : 'Needs Focus'}
                              </div>
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Sleek Progress Bar */}
                  <div className="h-1 w-full" style={{ backgroundColor: '#F8F5F3' }}>
                    <div
                        className={`h-full shadow-[0_0_10px_rgba(0,0,0,0.1)] transition-all duration-1000 ease-out bg-gradient-to-r ${
                           scorePercentage >= 80 ? 'from-primary to-emerald-400' :
                           scorePercentage >= 60 ? 'from-coral to-orange-500' :
                           'from-coral to-pink-500'
                        }`}
                        style={{ width: `${scorePercentage}%` }}
                    />
                  </div>
                  
                  <div className="p-8 bg-white border-t" style={{ borderColor: '#F8F5F3' }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="group">
                          <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#B9CDC7' }}>Account Name</label>
                          <div className="relative">
                              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 group-focus-within:text-primary transition-colors" style={{ color: '#B9CDC7' }} />
                              <input
                                  type="text"
                                  value={accountName}
                                  onChange={(e) => setAccountName(e.target.value)}
                                  placeholder="e.g. Acme Corporation"
                                  className="w-full pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-dark font-medium"
                                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
                              />
                          </div>
                        </div>
                        <div className="flex items-end">
                          <div className="text-sm" style={{ color: '#87B5A7' }}>
                            <span className="font-medium">Logged in as:</span> {user?.firstName || user?.email}
                          </div>
                        </div>
                      </div>
                  </div>
              </div>

              {/* AI Transcript Input - Moved to Second */}
              <TranscriptInput key={sessionId} onAnalysisComplete={handleAIComplete} accountName={accountName} />
              
              {/* Stakeholder Map - Third */}
              {stakeholders.length > 0 && (
                <div className="bg-white rounded-2xl shadow-soft overflow-hidden mb-8 animate-in fade-in slide-in-from-top-4" style={{ border: '1px solid #EEE9E1' }}>
                  <div className="px-8 py-5 border-b flex items-center gap-3" style={{ borderColor: '#F8F5F3', backgroundColor: '#F8F5F3' }}>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: '#EEE8FF', color: '#A496FF' }}>
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-dark text-lg">Stakeholder Map</h3>
                        <p className="text-xs font-medium" style={{ color: '#87B5A7' }}>Buying committee analysis & expansion opportunities</p>
                    </div>
                  </div>
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {stakeholders.map((s, idx) => (
                      <div key={idx} className="flex flex-col rounded-xl border shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                      style={{
                          borderColor: s.missingInfo ? '#FFB3A6' : '#EEE9E1',
                          backgroundColor: s.missingInfo ? '#FFEAE7' : '#FFFFFF'
                      }}>
                        {/* Top Accent Bar based on Sentiment */}
                        <div className="absolute top-0 left-0 w-full h-1"
                        style={{
                          backgroundColor: s.missingInfo ? '#FF8B6C' :
                          s.sentiment === 'Positive' ? '#248567' :
                          s.sentiment === 'Negative' ? '#FF8B6C' :
                          s.sentiment === 'Skeptical' ? '#FF8B6C' : '#B9CDC7'
                        }}></div>

                        <div className="p-5 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full border flex items-center justify-center font-bold shadow-sm transition-colors"
                                style={{
                                    backgroundColor: s.missingInfo ? '#FFEAE7' : '#F8F5F3',
                                    color: s.missingInfo ? '#FF8B6C' : '#87B5A7',
                                    borderColor: s.missingInfo ? '#FFB3A6' : '#EEE9E1'
                                }}
                                onMouseEnter={(e) => {
                                    if (!s.missingInfo) {
                                        e.currentTarget.style.backgroundColor = '#248567';
                                        e.currentTarget.style.color = '#FFFFFF';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!s.missingInfo) {
                                        e.currentTarget.style.backgroundColor = '#F8F5F3';
                                        e.currentTarget.style.color = '#87B5A7';
                                    }
                                }}>
                                {s.missingInfo ? '?' : s.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-sm truncate max-w-[120px]" title={s.name}
                                    style={{
                                        color: s.missingInfo ? '#FF8B6C' : '#242424',
                                        fontStyle: s.missingInfo ? 'italic' : 'normal'
                                    }}>
                                    {s.name}
                                    {s.missingInfo && <span className="ml-1 text-xs font-normal not-italic" style={{ color: '#FF8B6C' }}>(Unknown)</span>}
                                    </div>
                                    <div className="text-xs truncate max-w-[120px]" title={s.title}
                                    style={{ color: s.missingInfo ? '#FF8B6C' : '#87B5A7' }}>{s.title}</div>
                                </div>
                            </div>
                            
                            {/* Sentiment Icon */}
                            <div title={`Sentiment: ${s.sentiment}`}>
                                {getSentimentIcon(s.sentiment)}
                            </div>
                            </div>

                            {/* Badges Row */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {/* Persona Badge */}
                                <div className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border"
                                style={{
                                    backgroundColor: s.persona.toLowerCase().includes('champion') ? '#fff7ed' :
                                        s.persona.toLowerCase().includes('decision') || s.persona.toLowerCase().includes('economic') ? '#EEE8FF' :
                                        s.persona.toLowerCase().includes('blocker') ? '#FFEAE7' : '#F8F5F3',
                                    color: s.persona.toLowerCase().includes('champion') ? '#c2410c' :
                                        s.persona.toLowerCase().includes('decision') || s.persona.toLowerCase().includes('economic') ? '#A496FF' :
                                        s.persona.toLowerCase().includes('blocker') ? '#FF8B6C' : '#242424',
                                    borderColor: s.persona.toLowerCase().includes('champion') ? '#ffedd5' :
                                        s.persona.toLowerCase().includes('decision') || s.persona.toLowerCase().includes('economic') ? '#C5BCFF' :
                                        s.persona.toLowerCase().includes('blocker') ? '#FFB3A6' : '#EEE9E1'
                                }}>
                                    {s.persona.toLowerCase().includes('champion') && <Trophy className="w-3 h-3" />}
                                    {s.persona.toLowerCase().includes('decision') && <Crown className="w-3 h-3" />}
                                    {s.persona.toLowerCase().includes('blocker') && <ShieldAlert className="w-3 h-3" />}
                                    {!s.persona.toLowerCase().match(/champion|decision|economic|blocker/) && <Briefcase className="w-3 h-3" />}
                                    {s.persona}
                                </div>

                                {/* Influence Badge */}
                                {s.influence && (
                                    <div className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border"
                                    style={{
                                        backgroundColor: s.influence === 'High' ? '#EEE8FF' :
                                            s.influence === 'Medium' ? '#D6CEFF' : '#F8F5F3',
                                        color: s.influence === 'High' ? '#A496FF' :
                                            s.influence === 'Medium' ? '#A496FF' : '#87B5A7',
                                        borderColor: s.influence === 'High' ? '#C5BCFF' :
                                            s.influence === 'Medium' ? '#C5BCFF' : '#EEE9E1'
                                    }}>
                                        <Signal className="w-3 h-3" />
                                        {s.influence} Inf.
                                    </div>
                                )}

                                {/* Sentiment Badge */}
                                <div className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border"
                                style={{
                                    backgroundColor: s.sentiment === 'Positive' ? '#E7F6EE' :
                                        s.sentiment === 'Neutral' ? '#F8F5F3' :
                                        s.sentiment === 'Skeptical' ? '#FFEAE7' :
                                        s.sentiment === 'Negative' ? '#FFEAE7' : '#F8F5F3',
                                    color: s.sentiment === 'Positive' ? '#248567' :
                                        s.sentiment === 'Neutral' ? '#87B5A7' :
                                        s.sentiment === 'Skeptical' ? '#FF8B6C' :
                                        s.sentiment === 'Negative' ? '#FF8B6C' : '#242424',
                                    borderColor: s.sentiment === 'Positive' ? '#87B5A7' :
                                        s.sentiment === 'Neutral' ? '#EEE9E1' :
                                        s.sentiment === 'Skeptical' ? '#FFB3A6' :
                                        s.sentiment === 'Negative' ? '#FFB3A6' : '#EEE9E1'
                                }}>
                                    {s.sentiment}
                                </div>
                            </div>

                            <div className="space-y-3 mt-auto">
                                {/* Pain Points */}
                                {s.painPoints && s.painPoints.length > 0 && (
                                    <div className="rounded-lg p-3 border" style={{ backgroundColor: '#FFEAE7', borderColor: '#FFB3A6' }}>
                                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#FF8B6C' }}>
                                            <Flame className="w-3 h-3" />
                                            Pain
                                        </div>
                                        <ul className="list-disc list-inside text-xs leading-snug space-y-1" style={{ color: '#242424' }}>
                                            {s.painPoints.map((pain, i) => (
                                                <li key={i}>{pain}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Business Goal */}
                                {s.businessGoal && (
                                    <div className="rounded-lg p-3 border" style={{ backgroundColor: '#E7F6EE', borderColor: '#87B5A7' }}>
                                        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#248567' }}>
                                            <Target className="w-3 h-3" />
                                            Goal
                                        </div>
                                        <p className="text-xs leading-snug font-medium" style={{ color: '#242424' }}>
                                            {s.businessGoal}
                                        </p>
                                    </div>
                                )}

                                {/* Additional Notes */}
                                {s.additionalNotes && (
                                    <div className="rounded-lg p-3 border mt-2" style={{ backgroundColor: '#F8F5F3', borderColor: '#EEE9E1' }}>
                                        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#B9CDC7' }}>
                                            <FileText className="w-3 h-3" />
                                            Notes
                                        </div>
                                        <p className="text-xs leading-snug italic" style={{ color: '#242424' }}>
                                            "{s.additionalNotes}"
                                        </p>
                                    </div>
                                )}

                                {/* General Interest (Fallback or additional) */}
                                {!s.businessGoal && s.keyInterest && (
                                    <div className="rounded-lg p-3 border" style={{ backgroundColor: '#F8F5F3', borderColor: '#EEE9E1' }}>
                                        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#B9CDC7' }}>
                                            <Lightbulb className="w-3 h-3" />
                                            Key Interest
                                        </div>
                                        <p className="text-xs leading-snug font-medium" style={{ color: '#242424' }}>
                                            "{s.keyInterest}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Summary Card (Always Visible) - Fourth */}
              {aiSummary && (
                <div className="bg-white rounded-2xl shadow-soft overflow-hidden relative group hover:shadow-lg transition-shadow duration-200 mb-8" style={{ border: '1px solid #EEE8FF' }}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>

                  {/* Executive Summary Header */}
                  <div className="p-8 border-b relative z-10" style={{ borderColor: '#EEE8FF' }}>
                    <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#EEE8FF', color: '#A496FF' }}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                        Executive Summary
                      </span>
                    </h3>
                    <p className="leading-relaxed text-lg" style={{ color: '#242424' }}>
                      {aiSummary.executiveSummary}
                    </p>
                  </div>
                  
                  {/* Analysis Grid */}
                  <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: '#EEE8FF' }}>
                      {/* Key Strengths */}
                      <div className="p-8" style={{ backgroundColor: '#F8F5F3' }}>
                          <div className="flex items-center gap-2 mb-6">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: '#E7F6EE', color: '#248567' }}>
                                  <ThumbsUp className="w-4 h-4" />
                              </div>
                              <h4 className="font-bold text-dark text-sm uppercase tracking-wide">
                                  Key Strengths
                              </h4>
                          </div>
                          <ul className="space-y-4">
                              {aiSummary.keyStrengths.map((strength, i) => (
                                  <li key={i} className="flex gap-3 text-sm leading-relaxed bg-white p-3 rounded-xl border shadow-sm" style={{ color: '#242424', borderColor: '#EEE9E1' }}>
                                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#248567' }} />
                                      <span>{strength}</span>
                                  </li>
                              ))}
                          </ul>
                      </div>

                      {/* Actionable Recommendations */}
                      <div className="p-8 bg-white">
                          <div className="flex items-center gap-2 mb-6">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: '#EEE8FF', color: '#A496FF' }}>
                                  <Target className="w-4 h-4" />
                              </div>
                              <h4 className="font-bold text-dark text-sm uppercase tracking-wide">
                                  Actionable Recommendations
                              </h4>
                          </div>
                          <ul className="space-y-4">
                              {aiSummary.coachingTips.map((tip, i) => (
                                  <li key={i} className="flex gap-3 text-sm leading-relaxed p-3 rounded-xl border transition-colors" style={{ color: '#242424', backgroundColor: '#EEE8FF', borderColor: '#C5BCFF' }}
                                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#A496FF'}
                                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#C5BCFF'}>
                                      <div className="mt-0.5">
                                        <ArrowUpRight className="w-5 h-5 shrink-0" style={{ color: '#A496FF' }} />
                                      </div>
                                      <span>{tip}</span>
                                  </li>
                              ))}
                          </ul>
                      </div>
                  </div>
                </div>
              )}

              {/* Rubric Sections */}
              {MOVE_RUBRIC.map((category) => (
                <RubricSection
                key={category.id}
                category={category}
                currentScore={scores[category.id] || 0}
                aiInsights={aiData[category.id]}
                />
              ))}
            </div>

            {/* Right Column: Sticky Scorecard */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                
                {/* Score Card */}
                <div className="bg-white rounded-2xl shadow-soft p-6 relative overflow-hidden" style={{ border: '1px solid #EEE9E1' }}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-emerald-300"></div>
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center justify-between" style={{ color: '#B9CDC7' }}>
                    Snapshot
                    <img src="/pandadoc-logo.png" alt="PandaDoc Logo" className="w-6 h-6 rounded" />
                  </h3>

                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <span className="text-4xl font-bold text-dark tracking-tight">{totalScore}</span>
                      <span className="text-lg font-medium" style={{ color: '#B9CDC7' }}> / {maxScore}</span>
                    </div>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-4 shadow-inner"
                    style={{
                        backgroundColor: scorePercentage >= 80 ? '#E7F6EE' : scorePercentage >= 60 ? '#fff7ed' : '#FFEAE7',
                        color: scorePercentage >= 80 ? '#248567' : scorePercentage >= 60 ? '#c2410c' : '#FF8B6C',
                        borderColor: scorePercentage >= 80 ? '#87B5A7' : scorePercentage >= 60 ? '#ffedd5' : '#FFB3A6'
                    }}>
                      {scorePercentage}%
                    </div>
                  </div>

                  {/* Radar Chart */}
                  <div className="mb-6" style={{ width: '100%', height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                        <PolarGrid stroke="#EEE9E1" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#242424', fontSize: 10, fontWeight: 600 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 4]} tick={false} axisLine={false} />
                        <Radar
                          name="Score"
                          dataKey="score"
                          stroke="#248567"
                          strokeWidth={2}
                          fill="#248567"
                          fillOpacity={0.2}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                          itemStyle={{ color: '#242424', fontWeight: 'bold' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend/Breakdown */}
                  <div className="space-y-4 pt-6 border-t" style={{ borderColor: '#F8F5F3' }}>
                    {chartData.map((item) => (
                      <div key={item.subject} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold group-hover:text-primary transition-colors" style={{ color: '#87B5A7' }}>{item.fullTitle}</span>
                            <span className="text-xs font-bold"
                            style={{
                                color: item.score === 4 ? '#248567' :
                                    item.score === 3 ? '#87B5A7' :
                                    item.score === 2 ? '#c2410c' :
                                    item.score === 1 ? '#FF8B6C' : '#B9CDC7'
                            }}>{item.score}/4</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: '#F8F5F3' }}>
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  item.score === 4 ? 'bg-primary' :
                                  item.score === 3 ? '' :
                                  item.score === 2 ? '' :
                                  item.score === 1 ? '' : 'bg-transparent'
                                }`}
                                style={{
                                    width: `${(item.score / 4) * 100}%`,
                                    backgroundColor: item.score === 4 ? '#248567' :
                                        item.score === 3 ? '#87B5A7' :
                                        item.score === 2 ? '#f59e0b' :
                                        item.score === 1 ? '#FF8B6C' : 'transparent'
                                }}
                              />
                          </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
