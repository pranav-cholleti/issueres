import { IssueResolutionWorkflow } from '../services/workflow';
import { GithubIssue } from '../types';
import * as fs from 'fs';

async function run() {
  const token = process.env.GITHUB_TOKEN;
  const apiKey = process.env.API_KEY;
  const repoString = process.env.GITHUB_REPOSITORY; // "owner/repo"
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!token || !apiKey || !repoString || !eventPath) {
    console.error("Missing required environment variables (GITHUB_TOKEN, API_KEY, GITHUB_REPOSITORY, GITHUB_EVENT_PATH).");
    process.exit(1);
  }

  const [owner, repo] = repoString.split('/');

  console.log(`Starting IssueRes Action for ${owner}/${repo}`);

  try {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    const issue = eventData.issue;

    if (!issue) {
      console.log("No issue found in event data. Skipping.");
      return;
    }

    // Map GitHub webhook payload issue to our GithubIssue type
    const mappedIssue: GithubIssue = {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || "",
      state: issue.state,
      user: {
        login: issue.user.login,
        avatar_url: issue.user.avatar_url,
      },
      created_at: issue.created_at,
      labels: issue.labels || [],
      html_url: issue.html_url
    };

    const workflow = new IssueResolutionWorkflow({
      token,
      owner,
      repo
    }, undefined, true); // true for headless mode

    await workflow.start(mappedIssue);

  } catch (error) {
    console.error("Action execution failed:", error);
    process.exit(1);
  }
}

run();