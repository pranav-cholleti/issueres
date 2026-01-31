import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api } from '../client/api';
import { Layout } from '../components/Layout';
import { WorkflowGraph } from '../components/WorkflowGraph';
import { CodePreview } from '../components/CodePreview';
import { Terminal } from '../components/Terminal';
import { ReviewPanel } from '../components/ReviewPanel';
import { GithubIssue, WorkflowStatus } from '../types';
import { Play, ArrowLeft, ExternalLink, Activity } from 'lucide-react';

export const WorkflowDetail = () => {
  const { owner, repo, issueId } = useParams();
  const location = useLocation();
  const [issue, setIssue] = useState<GithubIssue | null>(location.state?.issue || null);
  const [state, setState] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  
  // Polling logic
  useEffect(() => {
    if (!owner || !repo || !issueId) return;
    
    let isMounted = true;
    
    const fetchState = async () => {
      try {
        const data = await api.getWorkflowState(owner, repo, parseInt(issueId));
        if (isMounted) {
            if (data) {
                setState(data);
                if (!issue && data.issue) setIssue(data.issue);
            } else {
                setNotFound(true);
            }
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchState();
    // Poll every 2 seconds
    const interval = setInterval(fetchState, 2000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [owner, repo, issueId]);

  const handleStart = async () => {
    if (!owner || !repo || !issueId) return;

    const effectiveIssue = issue || state?.issue;
    if (!effectiveIssue) return;

    await api.startWorkflow(owner, repo, parseInt(issueId), effectiveIssue);
    setIssue(effectiveIssue);
    setNotFound(false); // Should now exist
  };

  const handleFeedback = async (approved: boolean, feedback?: string) => {
    if (owner && repo && issueId) {
        await api.submitFeedback(owner, repo, parseInt(issueId), approved, feedback);
    }
  };

  if (!issue && notFound) return (
      <Layout>
          <div className="p-8 text-center">Issue data missing. Please go back to issue list.</div>
      </Layout>
  );

  return (
    <Layout>
      <div className="flex flex-col h-full w-full bg-slate-50">
        {/* C1. Persistent Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
                <Link to={`/${owner}/${repo}/issues`} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                     <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                        <span>{owner}/{repo}</span>
                        <span>•</span>
                        <span>#{issue?.number}</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-900 line-clamp-1 max-w-xl">{issue?.title}</h2>
                        <a href={issue?.html_url} target="_blank" className="text-slate-400 hover:text-blue-600">
                            <ExternalLink size={14} />
                        </a>
                     </div>
                </div>
            </div>

            <div className="flex-1 max-w-2xl mx-12">
                 {state && <WorkflowGraph state={state} />}
            </div>

            <div className="flex flex-col items-end gap-2">
                {!state || notFound ? (
                    <button 
                        onClick={handleStart}
                        className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 shadow-sm"
                    >
                        <Play size={16} fill="currentColor" />
                        Start Workflow
                    </button>
                ) : (
                    <>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded text-xs font-mono text-slate-600">
                            <Activity size={12} className={state.status !== 'IDLE' && state.status !== 'COMPLETED' ? 'animate-pulse text-brand-600' : ''} />
                            {state.status}
                        </div>
                        {(state.status === WorkflowStatus.FAILED || state.status === WorkflowStatus.COMPLETED) && (
                            <button
                                onClick={handleStart}
                                className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-md text-xs font-semibold hover:bg-brand-700 shadow-sm"
                            >
                                <Play size={14} fill="currentColor" />
                                Restart Workflow
                            </button>
                        )}
                        {state.status === WorkflowStatus.FAILED && state.error && (
                            <div className="max-w-xs text-xs text-red-600 text-right">
                                {state.error}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>

        {/* C2. Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
            {/* Column A: Context (30%) */}
            <div className="w-[30%] border-r border-slate-200 flex flex-col bg-white overflow-y-auto">
                <div className="p-6 space-y-6">
                    {state?.plan && (
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">AI Plan</h3>
                            <div className="prose prose-sm prose-slate">
                                <p className="text-sm text-slate-700 font-medium mb-2">{state.plan.analysis}</p>
                                <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
                                    {state.plan.steps.map((step: string, i: number) => (
                                        <li key={i}>{step}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Research History</h3>
                        {state?.researchHistory?.filter((h: any) => h.role === 'tool' || h.functionCall || (h.parts && h.parts.some((p: any) => p.functionCall))).map((msg: any, i: number) => {
                             const part = msg.parts ? msg.parts[0] : msg; // Gemini format variations
                             if (part.functionCall) {
                                 return (
                                     <div key={i} className="text-xs bg-white border border-slate-100 p-3 rounded-lg shadow-sm">
                                         <div className="font-mono text-brand-700 font-medium mb-1">{part.functionCall.name}()</div>
                                         <div className="text-slate-500 truncate">{JSON.stringify(part.functionCall.args)}</div>
                                     </div>
                                 );
                             }
                             return null;
                        })}
                        {(!state?.researchHistory || state.researchHistory.length === 0) && (
                            <div className="text-sm text-slate-400 italic text-center py-4">No history yet</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Column B: Diff Viewer (70%) */}
            <div className="flex-1 flex flex-col bg-slate-50/50 min-w-0">
                <div className="flex-1 p-6 overflow-hidden">
                    <CodePreview patches={state?.patches || []} />
                </div>
            </div>
        </div>

        {/* C3. Footer: Logs & Review */}
        <div className="h-64 border-t border-slate-200 bg-white flex shrink-0">
            <div className="flex-1 border-r border-slate-200 p-0 flex flex-col">
                <Terminal logs={state?.logs || []} repo={`${owner}/${repo}`} />
            </div>
            {state?.status === WorkflowStatus.AWAITING_HUMAN && (
                <div className="w-[400px] p-6 bg-slate-50 overflow-y-auto">
                    <ReviewPanel state={state} onSubmit={handleFeedback} />
                </div>
            )}
             {state?.status === WorkflowStatus.COMPLETED && (
                <div className="w-[400px] p-6 bg-green-50 overflow-y-auto flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-green-700 font-bold text-lg mb-2">PR Created</div>
                        <a href={state.prUrl} target="_blank" className="text-green-600 underline text-sm">{state.prUrl}</a>
                    </div>
                </div>
            )}
        </div>
      </div>
    </Layout>
  );
};