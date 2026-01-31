import React, { useState, useMemo } from 'react';
import { PatchCandidate } from '../types';
import { FileCode, ChevronLeft, ChevronRight, FileDiff, FileText } from 'lucide-react';
import * as Diff from 'diff';

interface Props {
  patches: PatchCandidate[];
}

export const CodePreview: React.FC<Props> = ({ patches }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);

  const currentPatch = patches && patches.length > 0 ? patches[currentIndex] : null;

  // Memoize diff calculation to prevent re-running on every render
  const diffElements = useMemo(() => {
    if (!currentPatch || showOriginal) return null;
    
    // Generate diff objects, ensuring strings are not null
    const original = currentPatch.originalContent || '';
    const modified = currentPatch.newContent || '';
    
    // Handle potential default export in ESM environment
    const diffFn = (Diff as any).diffLines || (Diff as any).default?.diffLines || Diff.diffLines;
    
    if (typeof diffFn !== 'function') {
      console.error("Diff library not loaded correctly", Diff);
      return <div className="p-4 text-red-500">Error loading diff library</div>;
    }

    const diff = diffFn(original, modified);
    
    return diff.map((part: any, index: number) => {
      // Split block into individual lines for better rendering
      const lines = part.value.split('\n');
      // Remove trailing empty string from split if it exists
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      const colorClass = part.added 
        ? 'bg-green-900/30 text-green-300' 
        : part.removed 
          ? 'bg-red-900/30 text-red-300' 
          : 'text-slate-300';
      
      const prefix = part.added ? '+' : part.removed ? '-' : ' ';

      return lines.map((line: string, lineIndex: number) => (
        <div key={`${index}-${lineIndex}`} className={`px-4 ${colorClass}`}>
          <span className="select-none opacity-50 w-4 inline-block text-center mr-2">{prefix}</span>
          <span>{line}</span>
        </div>
      ));
    });
  }, [currentPatch, showOriginal]);

  if (!patches || patches.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-8">
        <FileCode size={48} className="mb-3 opacity-50" />
        <p className="text-sm">No patches generated yet</p>
      </div>
    );
  }

  if (!currentPatch) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileCode size={16} className="text-brand-600" />
          <span className="font-mono text-sm font-medium text-slate-700">{currentPatch.file}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-200 rounded-lg p-0.5">
            <button 
              onClick={() => setShowOriginal(true)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${showOriginal ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FileText size={12} />
              Original
            </button>
            <button 
              onClick={() => setShowOriginal(false)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${!showOriginal ? 'bg-white shadow text-green-700' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FileDiff size={12} />
              Diff
            </button>
          </div>

          <div className="h-4 w-[1px] bg-slate-300"></div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-slate-500 font-medium tabular-nums">
              {currentIndex + 1} / {patches.length}
            </span>
            <button 
              onClick={() => setCurrentIndex(Math.min(patches.length - 1, currentIndex + 1))}
              disabled={currentIndex === patches.length - 1}
              className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Agent Explanation</h4>
        <p className="text-sm text-slate-700 leading-relaxed">{currentPatch.explanation}</p>
      </div>

      <div className="flex-1 overflow-auto bg-[#0d1117] relative">
        <div className="absolute top-2 right-4 text-[10px] text-slate-500 font-mono uppercase tracking-wider select-none z-10">
          {showOriginal ? 'READ ONLY' : 'DIFF VIEW'}
        </div>
        
        {showOriginal ? (
          <pre className="p-4 text-xs font-mono leading-relaxed tab-4 text-slate-300">
            {currentPatch.originalContent}
          </pre>
        ) : (
          <div className="py-4 text-xs font-mono leading-relaxed tab-4">
            {diffElements}
          </div>
        )}
      </div>
    </div>
  );
};