import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Upload, AlertCircle, X, FileText, Wand2 } from 'lucide-react';
import { analyzeCallTranscript } from '../services/geminiService';
import { AIAnalysisResult } from '../types';

interface TranscriptInputProps {
  onAnalysisComplete: (result: AIAnalysisResult & { id: number }) => void;
  accountName?: string;
}

const TranscriptInput: React.FC<TranscriptInputProps> = ({ onAnalysisComplete, accountName }) => {
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      setError("File is too large. Please upload a smaller text file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setTranscript(text);
        setError(null);
      }
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeCallTranscript(transcript, accountName);
      onAnalysisComplete(result);
    } catch (err) {
      setError("Failed to analyze. Please check your API key and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden mb-8 transition-all hover:shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-white px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-[#A496FF] to-[#8B7AE6] rounded-xl text-white shadow-lg shadow-[#EEE8FF]">
                <Wand2 className="w-5 h-5" />
            </div>
            <div>
                <h3 className="font-bold text-dark leading-tight text-lg">AI Scorer</h3>
                <p className="text-xs text-slate-500 font-medium">Paste a transcript or upload a file to generate scores</p>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <button
            onClick={() => fileInputRef.current?.click()}
            className="text-sm flex items-center gap-2 text-[#6B7280] hover:text-primary bg-white border border-[#D1D5DB] hover:border-primary/50 hover:bg-primary/5 font-semibold transition-colors duration-200 px-4 py-2 rounded-lg shadow-sm"
            aria-label="Upload transcript file"
            >
            <Upload className="w-4 h-4" />
            <span className="">Upload File</span>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.vtt,.srt,.md,.json"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Transcript file upload"
            />
        </div>
      </div>
      
      <div className="p-8">
        <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur opacity-0 group-focus-within:opacity-50 transition-opacity duration-500"></div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your call transcript here (Speaker 1: Hello...)"
              className="relative w-full h-40 p-5 bg-white border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-y text-sm text-dark placeholder:text-slate-400 font-mono transition-colors duration-200 group-hover:bg-white shadow-inner"
            />
            {transcript.length > 0 && (
                <button
                    onClick={() => setTranscript('')}
                    className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-[#FF8B6C] hover:bg-[#FFEAE7] rounded-lg transition-colors duration-200 z-10"
                    title="Clear text"
                    aria-label="Clear transcript text"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
            {transcript.length === 0 && (
                 <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <FileText className="w-12 h-12 text-slate-300" />
                 </div>
            )}
        </div>

        {error && (
            <div className="mt-6 p-4 bg-[#FFEAE7] text-[#FF8B6C] text-sm rounded-xl border border-[#FFC9BF] flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-full">
                {transcript.length > 0 ? `${transcript.length.toLocaleString()} characters` : 'Ready to analyze'}
            </div>
            <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !transcript.trim()}
                className="w-full sm:w-auto h-12 flex items-center justify-center gap-2 px-8 bg-[#248567] hover:bg-[#1F9A57] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors duration-200 shadow-lg shadow-primary/30 hover:shadow-xl focus:ring-2 focus:ring-primary focus:outline-none"
            >
                {isAnalyzing ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Call...
                </>
                ) : (
                <>
                    <Sparkles className="w-5 h-5" />
                    Generate Scores
                </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptInput;