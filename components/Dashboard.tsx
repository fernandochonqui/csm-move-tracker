import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  ChevronRight, 
  TrendingUp, 
  User, 
  FileText,
  BarChart3,
  ArrowUpRight
} from 'lucide-react';
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

interface DashboardProps {
  history: AssessmentHistoryItem[];
  onLoad: (item: AssessmentHistoryItem) => void;
  onDelete: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ history, onLoad, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [csmFilter, setCsmFilter] = useState('');

  // Filter Data
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesSearch = item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.csmName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCsm = csmFilter ? item.csmName.toLowerCase().includes(csmFilter.toLowerCase()) : true;
      return matchesSearch && matchesCsm;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history, searchTerm, csmFilter]);

  // Unique CSMs for autocomplete/dropdown suggestion
  const uniqueCsms = useMemo(() => {
    return Array.from(new Set(history.map(h => h.csmName))).filter(Boolean);
  }, [history]);

  // Chart Data (Chronological)
  const chartData = useMemo(() => {
    return [...filteredHistory].reverse().map(item => ({
      name: item.csmName,
      date: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      discovery: item.scores['discovery'] || 0,
      motivation: item.scores['motivation'] || 0,
      opportunity: item.scores['opportunity'] || 0,
      validation: item.scores['validation'] || 0,
      execution: item.scores['execution'] || 0,
      label: item.label
    }));
  }, [filteredHistory]);

  // Stats
  const stats = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    const totalCalls = filteredHistory.length;
    const avgScore = Math.round(filteredHistory.reduce((acc, curr) => acc + curr.totalScore, 0) / totalCalls * 10) / 10;
    
    // Calculate best category across filtered history
    const categoryScores: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    
    filteredHistory.forEach(h => {
      Object.entries(h.scores).forEach(([catId, score]) => {
        categoryScores[catId] = (categoryScores[catId] || 0) + (score as number);
        categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
      });
    });

    let bestCategory = 'N/A';
    let maxAvg = -1;

    Object.keys(categoryScores).forEach(catId => {
      const avg = categoryScores[catId] / categoryCounts[catId];
      if (avg > maxAvg) {
        maxAvg = avg;
        bestCategory = catId.charAt(0).toUpperCase() + catId.slice(1);
      }
    });

    return { totalCalls, avgScore, bestCategory };
  }, [filteredHistory]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm text-center px-4">
        <div className="bg-slate-50 p-6 rounded-full mb-6 ring-1 ring-slate-100">
          <BarChart3 className="w-12 h-12 text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-dark mb-2">No History Yet</h3>
        <p className="text-slate-500 max-w-sm mb-8 leading-relaxed">
          Complete and save an assessment to see performance trends, coaching insights, and call history here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search call labels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary w-full outline-none transition-shadow placeholder:text-slate-300 text-dark"
            />
          </div>
          <div className="relative w-full md:w-64">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by CSM Name..."
              value={csmFilter}
              onChange={(e) => setCsmFilter(e.target.value)}
              list="csm-list"
              className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary w-full outline-none transition-shadow placeholder:text-slate-300 text-dark"
            />
            <datalist id="csm-list">
              {uniqueCsms.map(csm => <option key={csm} value={csm} />)}
            </datalist>
          </div>
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
          Showing {filteredHistory.length} calls
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-soft transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Assessments</span>
            </div>
            <div className="text-4xl font-extrabold text-dark ml-1">{stats.totalCalls}</div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-soft transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Average Score</span>
            </div>
            <div className="text-4xl font-extrabold text-dark ml-1">
                {stats.avgScore} <span className="text-xl text-slate-400 font-medium">/ 20</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-soft transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#EEE8FF', color: '#A496FF' }}>
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Top Skill</span>
            </div>
            <div className="text-3xl font-bold text-dark ml-1 truncate" title={stats.bestCategory}>{stats.bestCategory}</div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-soft">
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-dark">Performance Trend</h3>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wide bg-slate-50 px-3 py-1.5 rounded-lg">Last {Math.min(filteredHistory.length, 20)} calls</div>
        </div>
        
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE9E1" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{fill: '#242424', fontSize: 11, fontWeight: 500}}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{fill: '#242424', fontSize: 11, fontWeight: 500}}
                domain={[0, 4]}
                ticks={[0, 1, 2, 3, 4]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  padding: '12px'
                }}
                labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '8px', paddingBottom: '4px' }}
                itemStyle={{ fontSize: '12px', padding: '2px 0' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="circle" />
              
              <Line type="monotone" dataKey="discovery" name="Discovery" stroke="#248567" strokeWidth={2} dot={{r: 0}} activeDot={{r: 6}} />
              <Line type="monotone" dataKey="motivation" name="Motivation" stroke="#A496FF" strokeWidth={2} dot={{r: 0}} activeDot={{r: 6}} />
              <Line type="monotone" dataKey="opportunity" name="Opportunity" stroke="#FF8B6C" strokeWidth={2} dot={{r: 0}} activeDot={{r: 6}} />
              <Line type="monotone" dataKey="validation" name="Validation" stroke="#87B5A7" strokeWidth={2} dot={{r: 0}} activeDot={{r: 6}} />
              <Line type="monotone" dataKey="execution" name="Execution" stroke="#C5BCFF" strokeWidth={2} dot={{r: 0}} activeDot={{r: 6}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
           <h3 className="font-bold text-dark text-lg">Call History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-white border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 font-bold tracking-wider">Date</th>
                <th className="px-8 py-4 font-bold tracking-wider">CSM Name</th>
                <th className="px-8 py-4 font-bold tracking-wider">Call Label</th>
                <th className="px-8 py-4 font-bold tracking-wider text-center">Score</th>
                <th className="px-8 py-4 font-bold tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="font-semibold text-dark">{new Date(item.date).toLocaleDateString()}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </td>
                  <td className="px-8 py-5 font-medium text-dark">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-emerald-200 flex items-center justify-center text-xs font-bold text-primary border-2 border-white shadow-sm">
                            {item.csmName.charAt(0)}
                        </div>
                        {item.csmName}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-slate-600">
                    {item.label}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                      item.scorePercentage >= 80 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' :
                      item.scorePercentage >= 60 ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-100' :
                      'bg-red-50 text-red-700 ring-1 ring-red-100'
                    }`}>
                      {item.totalScore} / {item.maxScore}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button 
                        onClick={() => onLoad(item)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Load Assessment"
                      >
                         <ChevronRight className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this record?')) {
                            onDelete(item.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;