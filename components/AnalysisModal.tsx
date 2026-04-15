import React, { useState, useRef } from 'react';
import { X, Sparkles, Loader2, Upload } from 'lucide-react';
import { analyzeCallTranscript } from '../services/geminiService';
import { AIAnalysisResult } from '../types';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (result: AIAnalysisResult) => void;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, onAnalysisComplete }) => {
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
    
    // Reset value to allow selecting same file again
    event.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeCallTranscript(transcript);
      onAnalysisComplete(result);
      onClose();
    } catch (err) {
      setError("Failed to analyze. Please check your API key and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#EEE8FF] rounded-lg">
              <Sparkles className="w-5 h-5 text-[#A496FF]" />
            </div>
            <div>
              <h2 id="modal-title" className="text-xl font-bold text-slate-800">AI Auto-Score</h2>
              <p className="text-sm text-slate-500">Attach a transcript file or paste notes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors duration-200" aria-label="Close modal">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto flex flex-col">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm flex items-center gap-2 text-[#A496FF] hover:text-[#8B7AE6] font-medium transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-[#EEE8FF]"
              aria-label="Upload transcript file"
            >
              <Upload className="w-4 h-4" />
              Upload Transcript File (.txt, .vtt)
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

          <div className="relative flex-1">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your Gong/Zoom/Meet transcript or raw notes here..."
              className="w-full h-64 p-4 bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm text-slate-700 placeholder:text-slate-400 font-mono transition-colors duration-200"
            />
             {transcript.length > 0 && (
                <div className="absolute bottom-4 right-4 text-xs text-slate-400 bg-white/80 px-2 py-1 rounded">
                    {transcript.length} chars
                </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-[#FFEAE7] text-[#FF8B6C] text-sm rounded-lg border border-[#FFC9BF]">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#6B7280] hover:text-slate-800 font-medium border border-[#D1D5DB] rounded-lg transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !transcript.trim()}
            className="h-12 flex items-center gap-2 px-6 bg-[#248567] hover:bg-[#1F9A57] disabled:bg-slate-300 text-white rounded-lg font-bold transition-colors duration-200 shadow-sm hover:shadow focus:ring-2 focus:ring-primary focus:outline-none"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Scores
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;