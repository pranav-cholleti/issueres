import React, { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

interface Props {
  logs: string[];
  repo?: string;
}

export const Terminal: React.FC<Props> = ({ logs, repo }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-800 flex flex-col h-full max-h-[300px]">
      <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
        <TerminalIcon size={14} className="text-slate-400" />
        <span className="text-xs font-medium text-slate-400">
          Agent Logs {repo && <span className="text-slate-600 ml-1">@ {repo}</span>}
        </span>
      </div>
      <div className="p-4 overflow-y-auto font-mono text-xs flex-1 space-y-1.5">
        {logs.length === 0 && <span className="text-slate-600 italic">Waiting for workflow start...</span>}
        {logs.map((log, i) => (
          <div key={i} className="text-slate-300 border-l-2 border-transparent hover:border-slate-700 pl-2">
            <span className="text-slate-500 mr-2">{log.split(']')[0]}]</span>
            <span>{log.split(']').slice(1).join(']')}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};