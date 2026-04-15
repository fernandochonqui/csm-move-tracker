
import React from 'react';
import { RubricCategory, CategoryAnalysis } from '../types';
import { CheckCircle2, Quote, Lightbulb, Info, AlertCircle, Sparkles, MessageSquare, GraduationCap } from 'lucide-react';

interface RubricSectionProps {
  category: RubricCategory;
  currentScore: number;
  aiInsights?: CategoryAnalysis;
}

const RubricSection: React.FC<RubricSectionProps> = ({ category, currentScore, aiInsights }) => {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-[#EEE9E1] overflow-hidden mb-8 transition-shadow hover:shadow-lg duration-200">
      {/* Header Section */}
      <div className="p-8 border-b border-slate-50">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xl font-bold text-dark tracking-tight">
                {category.title}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {category.subtitle}
                </span>
            </div>
            <p className="text-slate-600 text-lg font-medium leading-relaxed">"{category.question}"</p>
          </div>
          
          <div className="flex-shrink-0">
             <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl transition-all shadow-inner ${
                 currentScore > 0
                 ? (currentScore >= 3 ? 'bg-emerald-50 text-emerald-600 ring-2 ring-emerald-100' : 'bg-[#FFEAE7] text-[#FF8B6C] ring-2 ring-[#FFC9BF]')
                 : 'bg-slate-50 text-slate-300'
             }`}>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Score</span>
                <span className="text-3xl font-extrabold leading-none">
                    {currentScore}<span className="text-sm font-semibold opacity-40">/4</span>
                </span>
             </div>
          </div>
        </div>
        
        {/* AI Analysis Section */}
        {aiInsights && (
          <div className="mt-8 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-[#EEE8FF] rounded-md">
                    <Sparkles className="w-4 h-4 text-[#A496FF]" />
                </div>
                <span className="text-sm font-bold text-[#A496FF] uppercase tracking-wide">AI Analysis</span>
            </div>

            {/* 1. Observation */}
            <div className="p-6 bg-gradient-to-r from-slate-50 to-white border border-[#EEE9E1] rounded-xl mb-4 shadow-sm">
                <div className="flex gap-4">
                    <Info className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                        <h4 className="font-bold text-dark text-sm mb-1 uppercase tracking-wider text-xs text-slate-500">Observation</h4>
                        <p className="text-slate-700 text-sm leading-relaxed">{aiInsights.reasoning}</p>
                    </div>
                </div>
            </div>

            {/* Split View: Evidence & Gap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {/* Evidence */}
                <div className="p-6 bg-white border border-[#EEE9E1] rounded-xl shadow-sm h-full">
                    <div className="flex gap-2 mb-3 pb-2 border-b border-slate-50">
                        <Quote className="w-4 h-4 text-slate-400" />
                        <h4 className="font-bold text-slate-600 text-xs uppercase tracking-wider">Evidence from Call</h4>
                    </div>
                    <ul className="space-y-3">
                        {aiInsights.quotes.map((quote, idx) => (
                             <li key={idx} className="text-slate-600 text-sm italic relative pl-4 border-l-2 border-slate-200">
                                "{quote}"
                             </li>
                        ))}
                        {aiInsights.quotes.length === 0 && <li className="text-slate-400 text-sm italic">No specific quotes found</li>}
                    </ul>
                </div>

                {/* The Gap */}
                <div className="p-6 bg-[#FFEAE7] border border-[#FFC9BF] rounded-xl h-full">
                    <div className="flex gap-2 mb-3 pb-2 border-b border-[#FFC9BF]">
                        <AlertCircle className="w-4 h-4 text-[#FF8B6C]" />
                        <h4 className="font-bold text-[#FF8B6C] text-xs uppercase tracking-wider">The Gap</h4>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">
                        {aiInsights.gap}
                    </p>
                </div>
            </div>

            {/* Split View: Recommendation & Rewrite */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recommended Approach */}
                <div className="p-6 bg-[#EEE8FF] border border-[#D4CBFF] rounded-xl h-full">
                    <div className="flex gap-2 mb-3 pb-2 border-b border-[#D4CBFF]">
                        <GraduationCap className="w-4 h-4 text-[#A496FF]" />
                        <h4 className="font-bold text-[#A496FF] text-xs uppercase tracking-wider">Recommended Approach</h4>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">
                        {aiInsights.recommendation}
                    </p>
                </div>

                {/* Better Question Rewrite */}
                <div className="p-6 bg-emerald-50/40 border border-emerald-100 rounded-xl h-full">
                    <div className="flex gap-2 mb-3 pb-2 border-b border-emerald-100">
                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                        <h4 className="font-bold text-emerald-700 text-xs uppercase tracking-wider">Better Question Rewrite</h4>
                    </div>
                    <div className="flex gap-3">
                         <div className="w-1 bg-emerald-300 rounded-full self-stretch shrink-0"></div>
                         <p className="text-slate-700 text-sm italic font-medium leading-relaxed">
                            "{aiInsights.betterQuestion}"
                         </p>
                    </div>
                </div>
            </div>
          </div>
        )}
      </div>

      {/* Scoring Levels */}
      <div className="p-8 bg-slate-50/50">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Rubric Levels</h4>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {category.levels.map((level) => {
            const isSelected = currentScore === level.value;
            return (
                <div
                key={level.value}
                className={`relative flex flex-col items-start p-6 rounded-2xl border transition-all duration-200 h-full cursor-default focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                    isSelected
                    ? 'border-primary/50 bg-white ring-4 ring-primary/10 shadow-lg transform -translate-y-1 z-10'
                    : 'border-slate-200 bg-white text-slate-400 opacity-70 hover:opacity-100 hover:border-slate-300'
                }`}
                >
                <div className="flex items-center justify-between w-full mb-4">
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shadow-sm ${
                    isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                    {level.value}
                    </span>
                    {isSelected && (
                        <CheckCircle2 className="w-6 h-6 text-primary drop-shadow-sm" />
                    )}
                </div>
                <p className={`text-sm leading-relaxed ${isSelected ? 'text-dark font-semibold' : 'text-slate-500'}`}>
                    {level.description}
                </p>
                </div>
            );
            })}
        </div>
      </div>
    </div>
  );
};

export default RubricSection;
