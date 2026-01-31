import React from 'react';
import { GithubIssue } from '../types';
import { AlertCircle, CheckCircle2, CircleDot } from 'lucide-react';

interface Props {
  issues: GithubIssue[];
  selectedIssueId: number | null;
  onSelectIssue: (issue: GithubIssue) => void;
  isLoading: boolean;
}

export const IssueSidebar: React.FC<Props> = ({ issues, selectedIssueId, onSelectIssue, isLoading }) => {
  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Active Issues</h2>
        {isLoading && <div className="h-4 w-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 && !isLoading && (
          <div className="p-4 text-center text-sm text-slate-500">
            No open issues found or not connected.
          </div>
        )}
        {issues.map(issue => (
          <div 
            key={issue.id}
            onClick={() => onSelectIssue(issue)}
            className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${
              selectedIssueId === issue.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : 'border-l-4 border-l-transparent'
            }`}
          >
            <div className="flex items-start gap-2 mb-1">
              <CircleDot size={16} className="text-green-600 mt-1 shrink-0" />
              <h3 className="text-sm font-medium text-slate-900 leading-snug line-clamp-2">
                {issue.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 ml-6 text-xs text-slate-500">
              <span>#{issue.number}</span>
              <span>•</span>
              <span>{new Date(issue.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex flex-wrap gap-1 ml-6 mt-2">
              {issue.labels.map(l => (
                <span 
                  key={l.name} 
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: `#${l.color}20`, color: `#${l.color}` }}
                >
                  {l.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
