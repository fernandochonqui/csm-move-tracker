import React, { useState } from 'react';
import { useAssessments, useShareAssessment, Assessment } from '../hooks/use-assessments';
import { Calendar, Search, Share2, Eye, Trash2, ChevronRight, X, RefreshCw } from 'lucide-react';

interface AssessmentHistoryProps {
  onViewAssessment: (assessment: Assessment) => void;
  onRescore?: (assessmentId: number) => Promise<void>;
}

const AssessmentHistory: React.FC<AssessmentHistoryProps> = ({ onViewAssessment, onRescore }) => {
  const { data: assessments, isLoading, error, refetch } = useAssessments();
  const shareAssessment = useShareAssessment();
  const [searchTerm, setSearchTerm] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState<number | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [rescoringId, setRescoringId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">Failed to load assessments</p>
      </div>
    );
  }

  const filteredAssessments = assessments?.filter(a => {
    const searchLower = searchTerm.toLowerCase();
    return (
      a.accountName?.toLowerCase().includes(searchLower) ||
      a.executiveSummary?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const handleShare = async (assessmentId: number) => {
    if (!shareEmail.trim()) return;
    
    try {
      await shareAssessment.mutateAsync({ 
        assessmentId, 
        email: shareEmail.trim() 
      });
      setShareModalOpen(null);
      setShareEmail('');
      alert('Assessment shared successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to share assessment');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-slate-400';
    const percentage = (score / 20) * 100;
    if (percentage >= 80) return 'text-emerald-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by account name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
        />
      </div>

      {filteredAssessments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-dark mb-2">No Assessments Yet</h3>
          <p className="text-slate-500">Complete your first assessment to see it here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssessments.map((assessment) => (
            <div
              key={assessment.id}
              className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-dark truncate">
                      {assessment.accountName || 'Untitled Assessment'}
                    </h4>
                    <span className={`text-lg font-bold ${getScoreColor(assessment.totalScore)}`}>
                      {assessment.totalScore || 0}/20
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(assessment.createdAt)}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {onRescore && (
                    <button
                      onClick={async () => {
                        setRescoringId(assessment.id);
                        try {
                          await onRescore(assessment.id);
                          await refetch();
                        } finally {
                          setRescoringId(null);
                        }
                      }}
                      disabled={rescoringId === assessment.id}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Rescore with updated rubric"
                    >
                      <RefreshCw className={`w-5 h-5 ${rescoringId === assessment.id ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  <button
                    onClick={() => setShareModalOpen(assessment.id)}
                    className="p-2 text-slate-400 hover:text-amethyst-600 hover:bg-amethyst-50 rounded-lg transition-colors"
                    title="Share"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onViewAssessment(assessment)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all font-medium text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
              </div>

              {shareModalOpen === assessment.id && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-dark">Share Assessment</h3>
                      <button
                        onClick={() => {
                          setShareModalOpen(null);
                          setShareEmail('');
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                      Enter the email address of the person you want to share this assessment with.
                      They must have logged in at least once.
                    </p>
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
                      style={{ borderColor: '#E5E7EB' }}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShareModalOpen(null);
                          setShareEmail('');
                        }}
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleShare(assessment.id)}
                        disabled={!shareEmail.trim() || shareAssessment.isPending}
                        className="flex-1 px-4 py-2 text-white rounded-lg hover:bg-[#1F9A57] transition-colors disabled:opacity-50"
                        style={{ backgroundColor: '#248567' }}
                      >
                        {shareAssessment.isPending ? 'Sharing...' : 'Share'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssessmentHistory;
