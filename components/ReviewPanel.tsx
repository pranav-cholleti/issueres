import React, { useState } from 'react';
import { WorkflowState, WorkflowStatus } from '../types';
import { Check, X, MessageSquare, ExternalLink, FileCode } from 'lucide-react';

interface Props {
  state: WorkflowState;
  onSubmit: (approved: boolean, feedback?: string) => void;
}

export const ReviewPanel: React.FC<Props> = ({ state, onSubmit }) => {
  const [feedback, setFeedback] = useState('');
  const isActive = state.status === WorkflowStatus.AWAITING_HUMAN;
  const isCompleted = state.status === WorkflowStatus.COMPLETED;
  const isFailed = state.status === WorkflowStatus.FAILED;

  if (isCompleted && state.prUrl) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Check size={24} className="text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-green-900 mb-2">Issue Resolved!</h3>
        <p className="text-green-700 mb-4">The Pull Request has been created successfully.</p>
        <a 
          href={state.prUrl} 
          target="_blank" 
          rel="noreferrer"
          className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-all shadow-sm font-medium"
        >
          View Pull Request <ExternalLink size={16} />
        </a>
      </div>
    );
  }

  if (isFailed && state.error) {
    return (
       <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-red-900 mb-2">Workflow Failed</h3>
        <p className="text-red-700 text-sm">{state.error}</p>
      </div>
    );
  }

  if (!isActive) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-brand-200 overflow-hidden ring-4 ring-brand-50">
      <div className="bg-brand-50 px-6 py-4 border-b border-brand-100">
        <h3 className="font-bold text-brand-900 flex items-center gap-2">
          <MessageSquare size={18} />
          Human Review Required
        </h3>
        <p className="text-sm text-brand-700 mt-1">
          The agent has generated fixes for <strong>{state.patches.length} file{state.patches.length !== 1 ? 's' : ''}</strong>.
          Please review the changes in the preview panel above.
        </p>
      </div>

      <div className="p-6">
        {/* File List Summary */}
        <div className="mb-4 bg-slate-50 rounded-lg border border-slate-200 p-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Files to Modify</h4>
          <ul className="space-y-1">
            {state.patches.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                <FileCode size={14} className="text-brand-500" />
                <span className="font-mono">{p.file}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Feedback / Changes Requested (Optional)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="E.g., Please rename the variable 'x' to 'isValid'..."
            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none h-24 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onSubmit(false, feedback)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
          >
            <X size={18} />
            Request Changes
          </button>
          <button
            onClick={() => onSubmit(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors shadow-sm"
          >
            <Check size={18} />
            Approve & Create PR
          </button>
        </div>
      </div>
    </div>
  );
};