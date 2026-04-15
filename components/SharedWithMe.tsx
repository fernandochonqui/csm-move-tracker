import React from 'react';
import { useSharedWithMe, Assessment } from '../hooks/use-assessments';
import { Users, Calendar, Eye, User } from 'lucide-react';

interface SharedWithMeProps {
  onViewAssessment: (assessment: Assessment) => void;
}

const SharedWithMe: React.FC<SharedWithMeProps> = ({ onViewAssessment }) => {
  const { data, isLoading, error } = useSharedWithMe();

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
        <p className="text-red-600">Failed to load shared assessments</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold text-dark mb-2">No Shared Assessments</h3>
        <p className="text-slate-500">When someone shares an assessment with you, it will appear here.</p>
      </div>
    );
  }

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
    if (percentage >= 60) return 'text-coral-600';
    return 'text-coral-600';
  };

  return (
    <div className="space-y-3">
      {data.map((item: any) => (
        <div
          key={item.share.id}
          className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h4 className="font-semibold text-dark truncate">
                  {item.assessment.accountName || 'Untitled Assessment'}
                </h4>
                <span className={`text-lg font-bold ${getScoreColor(item.assessment.totalScore)}`}>
                  {item.assessment.totalScore || 0}/20
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Shared by {item.sharedBy.firstName || item.sharedBy.email}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(item.share.createdAt)}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => onViewAssessment(item.assessment)}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all font-medium text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <Eye className="w-4 h-4" />
              View
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SharedWithMe;
