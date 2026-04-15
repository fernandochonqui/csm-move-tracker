import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTrends, useTeamTrends } from '../hooks/use-assessments';
import { useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Target, Award, BarChart3, Users, User, Filter, X, Calendar } from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  BarChart,
  Bar
} from 'recharts';

const MANAGERS = ["Jeff", "Jenna", "Julie", "Zach"];

const PRE_FY_LABEL = 'Pre-Q3 2025';
const FY_START = new Date(2025, 6, 1);

interface QuarterDef {
  label: string;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
}

function getQuarters(includePreFY: boolean): QuarterDef[] {
  const quarters: QuarterDef[] = [];
  if (includePreFY) {
    quarters.push({ label: PRE_FY_LABEL, startMonth: 0, startYear: 2024, endMonth: 5, endYear: 2025 });
  }
  const now = new Date();
  let year = 2025;
  let q = 3;
  while (true) {
    const startMonth = (q - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    if (startDate > now) break;
    quarters.push({ label: `Q${q} ${year}`, startMonth, startYear: year, endMonth: startMonth + 2, endYear: year });
    q++;
    if (q > 4) { q = 1; year++; }
  }
  return quarters;
}

function dateToQuarterLabel(dateStr: string | Date | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  if (d < FY_START) return PRE_FY_LABEL;
  const month = d.getMonth();
  const year = d.getFullYear();
  const q = Math.floor(month / 3) + 1;
  return `Q${q} ${year}`;
}

function formatMonth(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const categories = [
  { id: 'discovery', label: 'Discovery', color: '#248567' },
  { id: 'motivation', label: 'Motivation', color: '#A496FF' },
  { id: 'opportunity', label: 'Opportunity', color: '#FF8B6C' },
  { id: 'validation', label: 'Validation', color: '#87B5A7' },
  { id: 'execution', label: 'Execution', color: '#C5BCFF' },
];

const TrendsView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'personal' | 'team'>('team');
  const [granularity, setGranularity] = useState<'monthly' | 'quarterly'>('monthly');
  const [managerFilter, setManagerFilter] = useState<string>('');
  const [csmFilter, setCsmFilter] = useState<string>('');
  const personalTrends = useTrends();
  const teamTrends = useTeamTrends();
  const queryClient = useQueryClient();
  const backfillRan = useRef(false);

  const { data, isLoading, error } = viewMode === 'personal' ? personalTrends : teamTrends;

  useEffect(() => {
    if (backfillRan.current) return;
    backfillRan.current = true;
    fetch('/api/gong/backfill-call-dates', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(result => {
        if (result.updated > 0) {
          queryClient.invalidateQueries({ queryKey: ['/api/trends'] });
          queryClient.invalidateQueries({ queryKey: ['/api/trends/team'] });
        }
      })
      .catch(() => {});
  }, [queryClient]);

  useEffect(() => {
    setCsmFilter('');
  }, [managerFilter]);

  const availableCsms = useMemo(() => {
    if (!data?.trends || viewMode !== 'team') return [];
    const csms = new Set<string>();
    for (const t of data.trends as any[]) {
      const name = t.csmName;
      if (!name) continue;
      if (managerFilter && t.manager !== managerFilter) continue;
      csms.add(name);
    }
    return Array.from(csms).sort();
  }, [data?.trends, viewMode, managerFilter]);

  const filteredTrends = useMemo(() => {
    if (!data?.trends) return [];
    if (viewMode !== 'team') return data.trends;
    return (data.trends as any[]).filter(t => {
      if (managerFilter && t.manager !== managerFilter) return false;
      if (csmFilter && t.csmName !== csmFilter) return false;
      return true;
    });
  }, [data?.trends, viewMode, managerFilter, csmFilter]);

  const activeFilterCount = (managerFilter ? 1 : 0) + (csmFilter ? 1 : 0);

  const filteredStats = useMemo(() => {
    const catIds = categories.map(c => c.id);
    const totalAssessments = filteredTrends.length;
    const avgTotal = totalAssessments > 0
      ? Math.round((filteredTrends.reduce((sum: number, t: any) => sum + (t.totalScore || 0), 0) / totalAssessments) * 10) / 10
      : 0;
    const averages: Record<string, number> = {};
    catIds.forEach(cat => {
      const scores = filteredTrends.map((t: any) => t[cat]).filter(Boolean);
      averages[cat] = scores.length > 0
        ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
        : 0;
    });
    return { totalAssessments, averageTotalScore: avgTotal, averages };
  }, [filteredTrends]);

  const trendsByMonth = useMemo(() => {
    const catIds = categories.map(c => c.id);
    const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
    const dataMap = new Map<string, { scores: Record<string, number[]>; totalScores: number[] }>();
    for (const t of filteredTrends as any[]) {
      const label = formatMonth(t.date);
      if (!label) continue;
      if (!dataMap.has(label)) {
        dataMap.set(label, { scores: Object.fromEntries(catIds.map(c => [c, []])), totalScores: [] });
      }
      const bucket = dataMap.get(label)!;
      if (t.totalScore != null) bucket.totalScores.push(t.totalScore);
      for (const c of catIds) {
        if (t[c] != null) bucket.scores[c].push(t[c]);
      }
    }
    const startDate = new Date(2025, 6, 1);
    const now = new Date();
    const months: { year: number; month: number; label: string }[] = [];
    let cursor = new Date(startDate);
    while (cursor <= now) {
      const label = cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth(), label });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return months.map(m => {
      const bucket = dataMap.get(m.label);
      if (bucket && bucket.totalScores.length > 0) {
        return {
          month: m.label,
          totalScore: avg(bucket.totalScores),
          assessmentCount: bucket.totalScores.length,
          ...Object.fromEntries(catIds.map(c => [c, avg(bucket.scores[c])])),
        };
      }
      return { month: m.label, totalScore: null, assessmentCount: 0, ...Object.fromEntries(catIds.map(c => [c, null])) };
    });
  }, [filteredTrends]);

  const hasPreFYData = useMemo(() => {
    if (!data?.trends) return false;
    return (data.trends as any[]).some(t => {
      const d = t.date ? new Date(t.date) : null;
      return d && !isNaN(d.getTime()) && d < FY_START;
    });
  }, [data?.trends]);

  const quarters = useMemo(() => getQuarters(hasPreFYData), [hasPreFYData]);

  const quarterlyData = useMemo(() => {
    const catIds = categories.map(c => c.id);
    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
    const dataMap = new Map<string, { scores: Record<string, number[]>; totalScores: number[] }>();
    if (data?.trends) {
      for (const t of data.trends as any[]) {
        const qLabel = dateToQuarterLabel(t.date);
        if (!qLabel) continue;
        if (!dataMap.has(qLabel)) {
          dataMap.set(qLabel, { scores: Object.fromEntries(catIds.map(c => [c, []])), totalScores: [] });
        }
        const bucket = dataMap.get(qLabel)!;
        if (t.totalScore != null) bucket.totalScores.push(t.totalScore);
        for (const c of catIds) {
          if (t[c] != null) bucket.scores[c].push(t[c]);
        }
      }
    }
    return quarters.map(q => {
      const bucket = dataMap.get(q.label);
      if (bucket && bucket.totalScores.length > 0) {
        return {
          quarter: q.label,
          totalScore: avg(bucket.totalScores),
          assessmentCount: bucket.totalScores.length,
          ...Object.fromEntries(catIds.map(c => [c, avg(bucket.scores[c])])),
        };
      }
      return { quarter: q.label, totalScore: null, assessmentCount: 0, ...Object.fromEntries(catIds.map(c => [c, null])) };
    });
  }, [data?.trends, quarters]);

  const summaryStats = useMemo(() => {
    const withData = quarterlyData.filter(q => q.assessmentCount > 0);
    const totalCalls = withData.reduce((sum, q) => sum + q.assessmentCount, 0);
    const avgTotal = withData.length
      ? Math.round((withData.reduce((sum, q) => sum + (q.totalScore || 0), 0) / withData.length) * 10) / 10
      : 0;
    const catAvgs: Record<string, number> = {};
    for (const cat of categories) {
      const vals = withData.map(q => (q as any)[cat.id]).filter((v: any) => v != null);
      catAvgs[cat.id] = vals.length
        ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10
        : 0;
    }
    let trend = '';
    if (withData.length >= 2) {
      const last = withData[withData.length - 1].totalScore || 0;
      const prev = withData[withData.length - 2].totalScore || 0;
      const diff = last - prev;
      if (diff > 0) trend = `+${diff.toFixed(1)}`;
      else if (diff < 0) trend = diff.toFixed(1);
      else trend = '0';
    }
    return { totalCalls, avgTotal, catAvgs, trend, quartersWithData: withData.length };
  }, [quarterlyData]);

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
        <p className="text-red-600">Failed to load trends data</p>
      </div>
    );
  }

  const noMonthlyData = !data || filteredTrends.length === 0;
  const noQuarterlyData = quarterlyData.every(q => q.assessmentCount === 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#242424" }}>
            {viewMode === 'team' ? 'Team Trends' : 'My Trends'}
          </h2>
          <p className="text-sm mt-1" style={{ color: "#87B5A7" }}>
            {granularity === 'monthly'
              ? viewMode === 'team'
                ? 'Performance trends across all analyzed calls by the team'
                : 'Your personal performance trends over time'
              : viewMode === 'team'
                ? 'Performance by fiscal quarter across all team assessments'
                : 'Your personal performance trends by fiscal quarter'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex p-0.5 rounded-full" style={{ backgroundColor: '#F8F5F3', border: '1px solid #EEE9E1' }}>
            <button
              onClick={() => setGranularity('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 ${granularity === 'monthly' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              style={granularity === 'monthly' ? { color: '#248567', border: '1px solid #EEE9E1' } : { color: '#87B5A7' }}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Monthly
            </button>
            <button
              onClick={() => setGranularity('quarterly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 ${granularity === 'quarterly' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              style={granularity === 'quarterly' ? { color: '#248567', border: '1px solid #EEE9E1' } : { color: '#87B5A7' }}
            >
              <Calendar className="w-3.5 h-3.5" />
              Quarterly
            </button>
          </div>
          <div className="flex p-0.5 rounded-full" style={{ backgroundColor: '#F8F5F3', border: '1px solid #EEE9E1' }}>
            <button
              onClick={() => setViewMode('team')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 ${viewMode === 'team' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              style={viewMode === 'team' ? { color: '#248567', border: '1px solid #EEE9E1' } : { color: '#87B5A7' }}
            >
              <Users className="w-3.5 h-3.5" />
              Team
            </button>
            <button
              onClick={() => setViewMode('personal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 ${viewMode === 'personal' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
              style={viewMode === 'personal' ? { color: '#248567', border: '1px solid #EEE9E1' } : { color: '#87B5A7' }}
            >
              <User className="w-3.5 h-3.5" />
              Personal
            </button>
          </div>
        </div>
      </div>

      {granularity === 'monthly' && viewMode === 'team' && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" style={{ color: '#87B5A7' }} />
              <span className="text-sm font-medium text-slate-500">Filters:</span>
            </div>
            <select
              value={managerFilter}
              onChange={e => setManagerFilter(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ borderColor: '#EEE9E1', color: managerFilter ? '#242424' : '#87B5A7' }}
            >
              <option value="">All Managers</option>
              {MANAGERS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={csmFilter}
              onChange={e => setCsmFilter(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ borderColor: '#EEE9E1', color: csmFilter ? '#242424' : '#87B5A7' }}
            >
              <option value="">All CSMs</option>
              {availableCsms.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setManagerFilter(''); setCsmFilter(''); }}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-red-50"
                style={{ color: '#e53e3e', border: '1px solid #fed7d7' }}
              >
                <X className="w-3 h-3" />
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      )}

      {granularity === 'monthly' && (
        noMonthlyData ? (
          <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-dark mb-2">
              {activeFilterCount > 0 ? 'No Matching Data' : 'No Trends Yet'}
            </h3>
            <p className="text-slate-500">
              {activeFilterCount > 0
                ? 'No assessments match the selected filters. Try adjusting or clearing them.'
                : viewMode === 'team'
                  ? 'No assessments have been completed yet. Analyze some calls to see team trends.'
                  : 'Complete some assessments to see your performance trends over time.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-slate-500">Total Assessments</span>
                </div>
                <p className="text-3xl font-bold text-dark">{filteredStats.totalAssessments}</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#D0EBE5' }}>
                    <Award className="w-5 h-5" style={{ color: '#248567' }} />
                  </div>
                  <span className="text-sm font-medium text-slate-500">Avg. Total Score</span>
                </div>
                <p className="text-3xl font-bold text-dark">{filteredStats.averageTotalScore}/20</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 sm:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EEE8FF' }}>
                    <Target className="w-5 h-5" style={{ color: '#A496FF' }} />
                  </div>
                  <span className="text-sm font-medium text-slate-500">Average by Category</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                      <span className="text-sm font-medium text-slate-600">{cat.label}:</span>
                      <span className="text-sm font-bold text-dark">{filteredStats.averages[cat.id] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-dark mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Score Trends Over Time
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                  <LineChart data={trendsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#EEE9E1' }} />
                    <YAxis domain={[0, 4]} ticks={[1, 2, 3, 4]} tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#EEE9E1' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #EEE9E1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(value, payload) => {
                        const count = payload?.[0]?.payload?.assessmentCount;
                        return `${value} (${count || 0} assessment${count === 1 ? '' : 's'})`;
                      }}
                    />
                    <Legend />
                    {categories.map(cat => (
                      <Line key={cat.id} type="monotone" dataKey={cat.id} name={cat.label} stroke={cat.color} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-dark mb-6">Average Total Score By Month</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                  <BarChart data={trendsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#EEE9E1' }} />
                    <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#EEE9E1' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #EEE9E1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(value, payload) => {
                        const count = payload?.[0]?.payload?.assessmentCount;
                        return `${value} (${count || 0} assessment${count === 1 ? '' : 's'})`;
                      }}
                      formatter={(value: any) => [value, 'Avg Total Score']}
                    />
                    <Bar dataKey="totalScore" fill="#248567" radius={[4, 4, 0, 0]} name="Avg Total Score" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )
      )}

      {granularity === 'quarterly' && (
        noQuarterlyData ? (
          <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-dark mb-2">No Quarterly Data Yet</h3>
            <p className="text-slate-500">
              {viewMode === 'team'
                ? 'No assessments with call dates found. Analyze some Gong calls to see quarterly trends.'
                : 'Complete some assessments to see your quarterly performance.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-slate-500">Total Calls Scored</span>
                </div>
                <p className="text-3xl font-bold text-dark">{summaryStats.totalCalls}</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#D0EBE5' }}>
                    <Award className="w-5 h-5" style={{ color: '#248567' }} />
                  </div>
                  <span className="text-sm font-medium text-slate-500">Avg. Total Score</span>
                </div>
                <p className="text-3xl font-bold text-dark">{summaryStats.avgTotal}/20</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EEE8FF' }}>
                    <TrendingUp className="w-5 h-5" style={{ color: '#A496FF' }} />
                  </div>
                  <span className="text-sm font-medium text-slate-500">QoQ Trend</span>
                </div>
                <p className="text-3xl font-bold" style={{
                  color: summaryStats.trend.startsWith('+') ? '#248567' : summaryStats.trend.startsWith('-') ? '#e53e3e' : '#242424'
                }}>
                  {summaryStats.trend || '—'}
                </p>
                {summaryStats.quartersWithData >= 2 && (
                  <p className="text-xs text-slate-400 mt-1">vs previous quarter</p>
                )}
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EEE8FF' }}>
                    <Target className="w-5 h-5" style={{ color: '#A496FF' }} />
                  </div>
                  <span className="text-sm font-medium text-slate-500">Avg by Category</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></div>
                      <span className="text-xs font-medium text-slate-600">{cat.label}:</span>
                      <span className="text-xs font-bold text-dark">{summaryStats.catAvgs[cat.id] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-dark mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Category Scores by Quarter
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                  <BarChart data={quarterlyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#EEE9E1' }} />
                    <YAxis domain={[0, 4]} ticks={[1, 2, 3, 4]} tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#EEE9E1' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #EEE9E1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(value, payload) => {
                        const count = payload?.[0]?.payload?.assessmentCount;
                        return `${value} (${count || 0} call${count === 1 ? '' : 's'})`;
                      }}
                    />
                    <Legend />
                    {categories.map(cat => (
                      <Bar key={cat.id} dataKey={cat.id} name={cat.label} fill={cat.color} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-dark mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Total Score Trend by Quarter
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200}>
                  <LineChart data={quarterlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE9E1" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#EEE9E1' }} />
                    <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#EEE9E1' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #EEE9E1', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(value, payload) => {
                        const count = payload?.[0]?.payload?.assessmentCount;
                        return `${value} (${count || 0} call${count === 1 ? '' : 's'})`;
                      }}
                      formatter={(value: any) => [value, 'Avg Total Score']}
                    />
                    <Line type="monotone" dataKey="totalScore" name="Avg Total Score" stroke="#248567" strokeWidth={3} dot={{ r: 6, fill: '#248567' }} activeDot={{ r: 8 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
              <h3 className="text-lg font-semibold text-dark mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Quarter Details
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: '#EEE9E1' }}>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Quarter</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600">Calls</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-600">Total</th>
                      {categories.map(cat => (
                        <th key={cat.id} className="text-center py-3 px-4 font-semibold" style={{ color: cat.color }}>
                          {cat.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quarterlyData.map(q => (
                      <tr key={q.quarter} className="border-b last:border-0" style={{ borderColor: '#F5F0EC' }}>
                        <td className="py-3 px-4 font-medium text-dark">{q.quarter}</td>
                        <td className="text-center py-3 px-4 text-slate-500">{q.assessmentCount}</td>
                        <td className="text-center py-3 px-4">
                          {q.totalScore != null
                            ? <span className="font-bold" style={{ color: '#248567' }}>{q.totalScore}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        {categories.map(cat => (
                          <td key={cat.id} className="text-center py-3 px-4">
                            {(q as any)[cat.id] != null
                              ? <span className="font-semibold" style={{ color: cat.color }}>{(q as any)[cat.id]}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
};

export default TrendsView;
