
import React from 'react';
import { CheckCircle2, XCircle, MinusCircle, ShieldCheck } from 'lucide-react';
import { QAItem } from '../types';

interface QAChecklistProps {
  items: QAItem[];
  onChange: (id: string, status: 'yes' | 'no' | 'n/a') => void;
}

const QAChecklist: React.FC<QAChecklistProps> = ({ items, onChange }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#EEE9E1] overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#A496FF]" />
        <h3 className="font-bold text-slate-800">Quality Assurance</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors group">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 pr-4">
                <div className="font-semibold text-slate-700 text-sm mb-1">{item.label}</div>
                <div className="text-xs text-slate-500">{item.question}</div>
              </div>
              <div className="flex items-center bg-slate-100 rounded-lg p-1 shrink-0">
                <button
                  onClick={() => onChange(item.id, 'yes')}
                  className={`p-1.5 rounded-md transition-all ${
                    item.status === 'yes'
                      ? 'bg-[#248567] text-white shadow-sm'
                      : 'text-slate-400 hover:text-[#248567]'
                  }`}
                  title="Pass"
                  aria-pressed={item.status === 'yes'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onChange(item.id, 'no')}
                  className={`p-1.5 rounded-md transition-all ${
                    item.status === 'no'
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-red-600'
                  }`}
                  title="Fail"
                  aria-pressed={item.status === 'no'}
                >
                  <XCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onChange(item.id, 'n/a')}
                  className={`p-1.5 rounded-md transition-all ${
                    item.status === 'n/a'
                      ? 'bg-slate-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="N/A"
                  aria-pressed={item.status === 'n/a'}
                >
                  <MinusCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* AI Evidence / Reasoning Display */}
            {(item.evidence) && (
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic">
                 "{item.evidence}"
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-sm">
                No QA items loaded.
            </div>
        )}
      </div>
    </div>
  );
};

export default QAChecklist;
