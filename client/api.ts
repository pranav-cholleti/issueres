const API_BASE = 'http://localhost:4000/api';

export const api = {
  getRepos: async () => {
    const res = await fetch(`${API_BASE}/repos`);
    return res.json();
  },
  
  connectRepo: async (owner: string, repo: string, token: string) => {
    const res = await fetch(`${API_BASE}/repos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, repo, token })
    });
    return res.json();
  },
  
  getIssues: async (owner: string, repo: string) => {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/issues`);
    return res.json();
  },
  
  getWorkflowState: async (owner: string, repo: string, issueId: number) => {
    const res = await fetch(`${API_BASE}/workflow/${owner}/${repo}/${issueId}`);
    if (res.status === 404) return null;
    return res.json();
  },
  
  startWorkflow: async (owner: string, repo: string, issueId: number, issue: any) => {
    const res = await fetch(`${API_BASE}/workflow/${owner}/${repo}/${issueId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue })
    });
    return res.json();
  },
  
  submitFeedback: async (owner: string, repo: string, issueId: number, approved: boolean, feedback?: string) => {
    const res = await fetch(`${API_BASE}/workflow/${owner}/${repo}/${issueId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, feedback })
    });
    return res.json();
  },

  getRepoWorkflows: async (owner: string, repo: string) => {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/workflows`);
    return res.json();
  },

  getRecentWorkflows: async (limit: number = 20) => {
    const res = await fetch(`${API_BASE}/workflows/recent?limit=${encodeURIComponent(limit)}`);
    return res.json();
  }
};