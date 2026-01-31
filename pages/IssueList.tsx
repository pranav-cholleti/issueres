import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../client/api';
import { Layout } from '../components/Layout';
import { CircleDot, Play, RefreshCw, ArrowRight } from 'lucide-react';
import { WorkflowStatus } from '../types';

export const IssueList = () => {
  const { owner, repo } = useParams();
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (owner && repo) {
        setLoading(true);
        api.getIssues(owner, repo).then(data => {
            setIssues(data);
            setLoading(false);
        });
    }
  }, [owner, repo]);

  const getStatusBadge = (status: string | null) => {
    if (!status || status === 'IDLE') return null;
    if (status === 'COMPLETED') return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">Completed</span>;
    if (status === 'FAILED') return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">Failed</span>;
    if (status === 'AWAITING_HUMAN') return <span className="bg-brand-100 text-brand-700 px-2 py-1 rounded text-xs font-medium animate-pulse">Needs Review</span>;
    return <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">In Progress</span>;
  };

  return (
    <Layout>
      <div className="flex flex-col h-full w-full">
         <div className="px-8 py-6 border-b border-slate-200 bg-white flex justify-between items-center">
             <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Link to="/dashboard" className="hover:underline">Dashboard</Link>
                    <span>/</span>
                    <span>{owner}</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{repo} Issues</h1>
             </div>
             <button onClick={() => window.location.reload()} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                <RefreshCw size={20} />
             </button>
         </div>

         <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-sm text-slate-500">Issue</th>
                            <th className="px-6 py-4 font-semibold text-sm text-slate-500">Labels</th>
                            <th className="px-6 py-4 font-semibold text-sm text-slate-500">Agent Status</th>
                            <th className="px-6 py-4 font-semibold text-sm text-slate-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading issues...</td></tr>
                        ) : issues.map(issue => (
                            <tr key={issue.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-start gap-3">
                                        <CircleDot size={18} className="text-green-600 mt-1 shrink-0" />
                                        <div>
                                            <h3 className="font-medium text-slate-900 mb-1">{issue.title}</h3>
                                            <div className="text-xs text-slate-500">
                                                #{issue.number} opened by {issue.user.login}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {issue.labels.map((l: any) => (
                                            <span 
                                                key={l.name}
                                                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                                style={{ backgroundColor: `#${l.color}20`, color: `#${l.color}` }}
                                            >
                                                {l.name}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {getStatusBadge(issue.workflowStatus)}
                                </td>
                                <td className="px-6 py-4">
                                    <Link 
                                        to={`/${owner}/${repo}/workflow/${issue.id}`}
                                        state={{ issue }} // Pass issue data to avoid double fetch if possible
                                        className="inline-flex items-center gap-2 text-brand-600 font-medium text-sm hover:underline"
                                    >
                                        {issue.workflowStatus && issue.workflowStatus !== 'IDLE' ? 'View Workflow' : 'Start Agent'}
                                        <ArrowRight size={16} />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
      </div>
    </Layout>
  );
};