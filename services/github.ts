import { Octokit } from "octokit";
import { GithubIssue } from "../types";

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  async getIssues(): Promise<GithubIssue[]> {
    const response = await this.octokit.rest.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state: 'open',
      per_page: 20,
    });
    
    return response.data.map((issue: any) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || "",
      state: issue.state,
      user: {
        login: issue.user?.login || "unknown",
        avatar_url: issue.user?.avatar_url || "",
      },
      created_at: issue.created_at,
      labels: issue.labels.map((l: any) => ({ name: l.name, color: l.color })),
      html_url: issue.html_url
    }));
  }

  // Used for initial broad context if needed, or by tools
  async getFileTree(recursive: boolean = true): Promise<string[]> {
    try {
      const repo = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      const defaultBranch = repo.data.default_branch;

      const tree = await this.octokit.rest.git.getTree({
        owner: this.owner,
        repo: this.repo,
        tree_sha: defaultBranch,
        recursive: recursive ? 'true' : undefined,
      });

      return tree.data.tree
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => item.path);
    } catch (e) {
      console.error("Error fetching file tree:", e);
      return [];
    }
  }

  async getFileContent(path: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      });

      if ('content' in response.data) {
        return atob(response.data.content.replace(/\n/g, ''));
      }
      return "";
    } catch (e) {
      console.error(`Error fetching file content for ${path}:`, e);
      return "";
    }
  }

  // --- New Tool Methods ---

  async listDirectory(path: string = ''): Promise<string[]> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: path === '.' ? '' : path,
      });

      if (Array.isArray(response.data)) {
        return response.data.map(item => `${item.path} (${item.type})`);
      }
      return [];
    } catch (e: any) {
      // If path doesn't exist or is a file, return empty or error
      return [`Error: ${e.message}`];
    }
  }

  async searchCode(query: string): Promise<string[]> {
    try {
      const q = `${query} repo:${this.owner}/${this.repo}`;
      const response = await this.octokit.rest.search.code({
        q,
        per_page: 5
      });
      return response.data.items.map(item => item.path);
    } catch (e: any) {
      console.warn("Search API limit or error:", e);
      return ["Error: Search API unavailable or rate limited."];
    }
  }

  async createPR(
    issueNumber: number, 
    files: { path: string; content: string }[], 
    title: string, 
    body: string
  ): Promise<string> {
    // 1. Get default branch
    const repoData = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo,
    });
    const baseBranch = repoData.data.default_branch;
    const branchName = `fix/issue-${issueNumber}-${Date.now()}`;

    // 2. Get reference to base branch
    const baseRef = await this.octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${baseBranch}`,
    });
    const baseSha = baseRef.data.object.sha;

    // 3. Create new branch ref
    await this.octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    // 4. Create blobs and tree
    const treeData = await Promise.all(files.map(async (file) => {
      const blob = await this.octokit.rest.git.createBlob({
        owner: this.owner,
        repo: this.repo,
        content: file.content,
        encoding: 'utf-8',
      });
      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.data.sha,
      };
    }));

    const newTree = await this.octokit.rest.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: baseSha,
      tree: treeData,
    });

    // 5. Create commit
    const commit = await this.octokit.rest.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message: `Fix for issue #${issueNumber}: ${title}`,
      tree: newTree.data.sha,
      parents: [baseSha],
    });

    // 6. Update branch ref
    await this.octokit.rest.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branchName}`,
      sha: commit.data.sha,
    });

    // 7. Create PR
    const pr = await this.octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: `Fix: ${title}`,
      body: `Resolves #${issueNumber}\n\n${body}`,
      head: branchName,
      base: baseBranch,
    });

    return pr.data.html_url;
  }
}