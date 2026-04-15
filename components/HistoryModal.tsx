import React, { useMemo } from 'react';
import { X, Trash2, Calendar, ChevronRight, TrendingUp } from 'lucide-react';
import { AssessmentHistoryItem } from '../types';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: AssessmentHistoryItem[];
  onClearHistory: () => void;
  onLoadAssessment: (item: AssessmentHistoryItem) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onClearHistory,
  onLoadAssessment
}) => {
  const chartData = useMemo(() => {
    // Reverse to show oldest to newest left-to-right
    return [...history].reverse().map(item => ({
      name: item.label,
      date: new Date(item.date).toLocaleDateString(),
      score: item.totalScore,
      percentage: item.scorePercentage
    }));
  }, [history]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#EEE8FF' }}>
              <TrendingUp className="w-5 h-5" style={{ color: '#A496FF' }} />
            </div>
            <div>
              <h2 id="history-modal-title" className="text-xl font-bold text-slate-800">Score History</h2>
              <p className="text-sm text-slate-500">Track performance trends over time</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg font-medium mb-2">No history recorded yet</p>
              <p className="text-sm">Save your assessments to see trends here.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Chart Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 px-2">Performance Trend</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid stroke="#EEE9E1" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#242424"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#242424"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 'auto']} // Or fixed domain if max score is known
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          borderRadius: '8px',
                          border: '1px solid #EEE9E1',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        name="Total Score"
                        stroke="#248567"
                        strokeWidth={3}
                        dot={{ fill: '#248567', r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* History List */}
              <div>
                <div className="flex items-center justify-between mb-4 px-1">
                   <h3 className="text-sm font-semibold text-slate-700">Past Assessments</h3>
                   <span className="text-xs text-slate-400">{history.length} records</span>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Date / Label</th>
                        <th className="px-4 py-3 font-medium text-center">Score</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 group transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{item.label}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(item.date).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.scorePercentage >= 80 ? 'bg-emerald-100 text-emerald-800' :
                              item.scorePercentage >= 60 ? 'bg-coral-100 text-coral-800' :
                              'bg-coral-100 text-coral-800'
                            }`}>
                              {item.totalScore}/{item.maxScore} ({item.scorePercentage}%)
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                onLoadAssessment(item);
                                onClose();
                              }}
                              className="font-medium text-xs px-3 py-1 rounded transition-colors mr-2"
                              style={{ color: '#A496FF' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#EEE8FF';
                                e.currentTarget.style.color = '#8B7FE8';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#A496FF';
                              }}
                            >
                              Load
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-between">
          <button
            onClick={() => {
                if(window.confirm('Are you sure you want to clear your entire history? This cannot be undone.')) {
                    onClearHistory();
                }
            }}
            disabled={history.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear History
          </button>
          
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
