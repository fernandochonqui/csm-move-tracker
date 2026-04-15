import React from 'react';
import { Sparkles, TrendingUp, Users } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <img src="/pandadoc-logo.png" alt="PandaDoc Logo" className="w-16 h-16 rounded-xl mb-8" />
        
        <h1 className="text-4xl sm:text-5xl font-bold text-dark text-center mb-4">
          PandaDoc <span className="text-primary">MOVE</span> Scorer
        </h1>
        
        <p className="text-lg text-slate-600 text-center max-w-xl mb-12">
          AI-powered sales call analysis to help CSMs improve their discovery, 
          motivation, opportunity, validation, and execution skills.
        </p>

        <a
          href="/api/login"
          className="inline-flex items-center gap-3 h-12 px-6 bg-[#248567] text-white font-semibold text-lg rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:bg-[#1F9A57] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#248567] focus-visible:outline-none"
        >
          <Sparkles className="w-5 h-5" />
          Sign In to Get Started
        </a>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 max-w-4xl w-full">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="w-10 h-10 bg-[#EEE8FF] rounded-lg flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-[#A496FF]" />
            </div>
            <h3 className="font-semibold text-dark mb-2">AI Analysis</h3>
            <p className="text-sm text-slate-500">
              Get instant, detailed feedback on your sales calls powered by Gemini AI.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-dark mb-2">Track Progress</h3>
            <p className="text-sm text-slate-500">
              See your improvement over time with performance trends and analytics.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-dark mb-2">Share & Collaborate</h3>
            <p className="text-sm text-slate-500">
              Share assessments with managers and team members for coaching.
            </p>
          </div>
        </div>
      </div>
      
      <footer className="py-6 text-center text-sm text-slate-400">
        Powered by PandaDoc
      </footer>
    </div>
  );
};

export default LandingPage;
