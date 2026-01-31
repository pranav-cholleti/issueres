const API_BASE = 'http://localhost:4000/api';

const handleJson = async (res: Response) => {
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json();
      if (data && typeof data === 'object' && 'error' in data && (data as any).error) {
        message = (data as any).error as string;
      }
    } catch {
    }
    throw new Error(message);
  }
  return res.json();
};

export const api = {
  getRepos: async () => {
    const res = await fetch(`${API_BASE}/repos`);
    return handleJson(res);
  },
  
  connectRepo: async (owner: string, repo: string, token: string) => {
    const res = await fetch(`${API_BASE}/repos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, repo, token })
    });
    return handleJson(res);
  },
  
  getIssues: async (owner: string, repo: string) => {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/issues`);
    return handleJson(res);
  },
  
  getWorkflowState: async (owner: string, repo: string, issueId: number) => {
    const res = await fetch(`${API_BASE}/workflow/${owner}/${repo}/${issueId}`);
    if (res.status === 404) return null;
    return handleJson(res);
  },
  
  startWorkflow: async (owner: string, repo: string, issueId: number, issue: any) => {
    const res = await fetch(`${API_BASE}/workflow/${owner}/${repo}/${issueId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue })
    });
    return handleJson(res);
  },
  
  resumeWorkflow: async (owner: string, repo: string, issueId: number) => {
    const res = await fetch(`${API_BASE}/workflow/${owner}/${repo}/${issueId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleJson(res);
  },
  
  submitFeedback: async (owner: string, repo: string, issueId: number, approved: boolean, feedback?: string) => {
    const res = await fetch(`${API_BASE}/workflow/${owner}/${repo}/${issueId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, feedback })
    });
    return handleJson(res);
  },

  getRepoWorkflows: async (owner: string, repo: string) => {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/workflows`);
    if (!res.ok) {
      throw new Error(`Failed to get repo workflows: ${res.status} ${res.statusText}`);
    }
    return res.json();
  },

  getRecentWorkflows: async (limit: number = 20) => {
    const res = await fetch(`${API_BASE}/workflows/recent?limit=${encodeURIComponent(limit)}`);
    if (!res.ok) {
      throw new Error(`Failed to get recent workflows: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }
};