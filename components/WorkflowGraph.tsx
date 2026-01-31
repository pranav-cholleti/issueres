import React from 'react';
import { WorkflowStatus, WorkflowState } from '../types';
import { Check, Loader2, Circle, AlertTriangle, Search, Brain } from 'lucide-react';

interface Props {
  state: WorkflowState;
}

// Map the granular internal statuses to visual user-facing steps
const STEPS = [
  { 
    id: 'RESEARCH', 
    label: 'Research', 
    match: [WorkflowStatus.RESEARCH_DECISION, WorkflowStatus.RESEARCH_TOOL] 
  },
  { 
    id: 'PLANNING', 
    label: 'Planning', 
    match: [WorkflowStatus.PLANNING] 
  },
  { 
    id: 'CODING', 
    label: 'Coding', 
    match: [WorkflowStatus.GENERATING_FIX] 
  },
  { 
    id: 'REVIEW', 
    label: 'Review', 
    match: [WorkflowStatus.AWAITING_HUMAN] 
  },
  { 
    id: 'PUBLISHING', 
    label: 'Publishing', 
    match: [WorkflowStatus.CREATING_PR] 
  }
];

export const WorkflowGraph: React.FC<Props> = ({ state }) => {
  const isCompleted = state.status === WorkflowStatus.COMPLETED;
  const isFailed = state.status === WorkflowStatus.FAILED;

  // Determine which step is currently active based on the state status
  let activeIndex = -1;
  
  if (isCompleted) {
    activeIndex = STEPS.length;
  } else if (isFailed) {
    // Find the step where it failed
    activeIndex = STEPS.findIndex(s => s.match.includes(state.status as any));
    if (activeIndex === -1) activeIndex = 0; // Default to first if unknown
  } else {
    activeIndex = STEPS.findIndex(s => s.match.includes(state.status as any));
  }

  // Fallback for IDLE or loading
  if (state.status === WorkflowStatus.IDLE || state.status === WorkflowStatus.LOADING_ISSUES) {
    activeIndex = -1;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6 flex items-center justify-between">
        <span>Agent Workflow</span>
        {activeIndex === 0 && (
           <span className="text-xs text-brand-600 animate-pulse bg-brand-50 px-2 py-1 rounded">
             Iterative Research ({state.researchLoopCount} steps)
           </span>
        )}
      </h3>
      
      <div className="relative flex justify-between items-center px-4">
        {/* Connection Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-100 -z-10"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-brand-500 -z-10 transition-all duration-500"
          style={{ 
            width: activeIndex === -1 ? '0%' : isCompleted ? '100%' : `${Math.max(0, (activeIndex / (STEPS.length - 1)) * 100)}%` 
          }}
        ></div>

        {STEPS.map((step, idx) => {
          let status: 'pending' | 'active' | 'completed' | 'error' = 'pending';
          
          if (isFailed && idx === activeIndex) status = 'error';
          else if (isCompleted || idx < activeIndex) status = 'completed';
          else if (idx === activeIndex) status = 'active';

          return (
            <div key={step.id} className="flex flex-col items-center gap-3 bg-white px-2">
              <div 
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${status === 'completed' ? 'bg-brand-500 border-brand-500 text-white' : ''}
                  ${status === 'active' ? 'bg-white border-brand-500 text-brand-600 shadow-[0_0_0_4px_rgba(14,165,233,0.2)]' : ''}
                  ${status === 'pending' ? 'bg-slate-50 border-slate-200 text-slate-300' : ''}
                  ${status === 'error' ? 'bg-red-50 border-red-500 text-red-500' : ''}
                `}
              >
                {status === 'completed' && <Check size={20} strokeWidth={3} />}
                
                {status === 'active' && step.id === 'RESEARCH' && <Search size={18} className="animate-pulse" />}
                {status === 'active' && step.id !== 'RESEARCH' && <Loader2 size={20} className="animate-spin" />}
                
                {status === 'pending' && step.id === 'RESEARCH' && <Search size={18} />}
                {status === 'pending' && step.id !== 'RESEARCH' && <Circle size={20} />}
                
                {status === 'error' && <AlertTriangle size={20} />}
              </div>
              <span 
                className={`
                  text-xs font-medium whitespace-nowrap transition-colors duration-300
                  ${status === 'active' ? 'text-brand-700' : 'text-slate-500'}
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};