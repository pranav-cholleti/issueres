import React, { useState, useEffect } from 'react';
import { Settings, Zap, Home } from 'lucide-react';
import { api } from '../client/api';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [tempConfig, setTempConfig] = useState({ token: '', owner: '', repo: '' });

  useEffect(() => {
    const handler = () => setShowSettings(true);
    document.addEventListener('open-settings', handler);
    return () => document.removeEventListener('open-settings', handler);
  }, []);

  const handleSave = async () => {
    if (tempConfig.token && tempConfig.owner && tempConfig.repo) {
      await api.connectRepo(tempConfig.owner, tempConfig.repo, tempConfig.token);
      setShowSettings(false);
      window.location.reload(); // Simple reload to refresh list
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="bg-brand-600 text-white p-1.5 rounded-lg">
              <Zap size={20} fill="currentColor" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Issue<span className="text-brand-600">Res</span>
            </h1>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors">
                <Home size={16} />
                Dashboard
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] max-w-full m-4">
            <h2 className="text-lg font-bold mb-4">Connect Repository</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GitHub Personal Access Token</label>
                <input 
                  type="password" 
                  value={tempConfig.token}
                  onChange={(e) => setTempConfig({...tempConfig, token: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="ghp_... or github_pat_..."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
                  <input 
                    type="text" 
                    value={tempConfig.owner}
                    onChange={(e) => setTempConfig({...tempConfig, owner: e.target.value})}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="facebook"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Repo</label>
                  <input 
                    type="text" 
                    value={tempConfig.repo}
                    onChange={(e) => setTempConfig({...tempConfig, repo: e.target.value})}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="react"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};