import React, { useEffect, useState } from 'react';
import { api } from '../client/api';
import { Link } from 'react-router-dom';
import { Github, Plus, Activity, AlertCircle } from 'lucide-react';
import { Layout } from '../components/Layout';

export const Dashboard = () => {
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentWorkflows, setRecentWorkflows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getRepos(),
      api.getRecentWorkflows(5),
    ])
      .then(([reposData, workflowsData]) => {
        setRepos(reposData);
        setRecentWorkflows(workflowsData);
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Failed to load dashboard data';
        setError(message);
        setRepos([]);
        setRecentWorkflows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Connected Repositories</h1>
        {loading && (
          <div className="mb-4 text-sm text-slate-500">Loading...</div>
        )}
        {!loading && error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && recentWorkflows.length > 0 && (
          <div className="mb-8 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Recent Workflows</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {recentWorkflows.map((wf) => (
                <Link
                  key={wf._id}
                  to={`/${wf.repoOwner}/${wf.repoName}/workflow/${wf.issueId}`}
                  state={{ issue: wf.issue }}
                  className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-md transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900 line-clamp-1">
                      {wf.issue?.title || 'Untitled issue'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {wf.repoOwner}/{wf.repoName} · #{wf.issue?.number}
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-xs text-slate-500">
                    <span className="font-mono">{wf.status}</span>
                    {wf.updatedAt && (
                      <span>{new Date(wf.updatedAt).toLocaleTimeString()}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repos.map((repo) => (
            <Link 
              key={repo._id} 
              to={`/${repo.owner}/${repo.repo}/issues`}
              className="group bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-brand-200 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-slate-100 p-2 rounded-lg text-slate-700 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                  <Github size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 group-hover:text-brand-700">{repo.repo}</h3>
                  <p className="text-sm text-slate-500">{repo.owner}</p>
                </div>
              </div>
              
              <div className="flex gap-4 border-t border-slate-100 pt-4">
                 <div className="flex items-center gap-1.5 text-slate-600">
                    <Activity size={16} className="text-brand-500" />
                    <span className="text-sm font-medium">{repo.stats?.active || 0} Active</span>
                 </div>
                 <div className="flex items-center gap-1.5 text-slate-600">
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-sm font-medium">{repo.stats?.failed || 0} Failed</span>
                 </div>
              </div>
            </Link>
          ))}
          
          <button 
            onClick={() => document.dispatchEvent(new CustomEvent('open-settings'))}
            className="flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-6 text-slate-400 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50/50 transition-all min-h-[160px]"
          >
            <div className="bg-white p-3 rounded-full shadow-sm">
              <Plus size={24} />
            </div>
            <span className="font-medium">Connect Repository</span>
          </button>
        </div>
      </div>
    </Layout>
  );
};