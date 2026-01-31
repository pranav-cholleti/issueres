import express, { RequestHandler } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { RepositoryModel, WorkflowStateModel } from './models';
import { IssueResolutionWorkflow } from '../services/workflow';
import { GitHubService } from '../services/github';
import { GithubConfig, WorkflowState } from '../types';


const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors() as unknown as RequestHandler);
app.use(express.json());

// Connect to MongoDB
const MONGO_URI = 'mongodb://localhost:27017/issueres';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- API Routes ---

// 1. Get all repositories
app.get('/api/repos', async (req, res) => {
  try {
    const repos = await RepositoryModel.find();
    const stats = await Promise.all(repos.map(async (repo) => {
      const activeWorkflows = await WorkflowStateModel.countDocuments({ 
        repoId: repo._id, 
        status: { $nin: ['IDLE', 'COMPLETED', 'FAILED', 'PAUSED_QUOTA'] } 
      });
      const failedWorkflows = await WorkflowStateModel.countDocuments({ 
        repoId: repo._id, 
        status: 'FAILED' 
      });
      const pausedWorkflows = await WorkflowStateModel.countDocuments({ 
        repoId: repo._id, 
        status: 'PAUSED_QUOTA' 
      });
      return { 
        ...repo.toObject(), 
        stats: { active: activeWorkflows, failed: failedWorkflows, paused: pausedWorkflows } 
      };
    }));
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Add/Connect Repository
app.post('/api/repos', async (req, res) => {
  try {
    const { owner, repo, token } = req.body;
    const existing = await RepositoryModel.findOne({ owner, repo });
    if (existing) {
      existing.token = token;
      await existing.save();
      return res.json(existing);
    }
    const newRepo = await RepositoryModel.create({ owner, repo, token });
    res.json(newRepo);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Get Issues for a Repo (Live from GitHub)
app.get('/api/repos/:owner/:repo/issues', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const repoDoc = await RepositoryModel.findOne({ owner, repo });
    if (!repoDoc) return res.status(404).json({ error: "Repository not found" });

    const gh = new GitHubService(repoDoc.token, owner, repo);
    const issues = await gh.getIssues();

    const workflows = await WorkflowStateModel.find({ repoId: repoDoc._id });
    const merged = issues.map(issue => {
      const wf = workflows.find(w => w.issueId === issue.id);
      return {
        ...issue,
        workflowStatus: wf ? wf.status : null
      };
    });

    res.json(merged);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Get Workflow State
app.get('/api/workflow/:owner/:repo/:issueId', async (req, res) => {
  try {
    const { owner, repo, issueId } = req.params;
    const repoDoc = await RepositoryModel.findOne({ owner, repo });
    if (!repoDoc) return res.status(404).json({ error: "Repository not found" });

    const id = parseInt(issueId, 10);
    let wfState = await WorkflowStateModel.findOne({ repoId: repoDoc._id, issueId: id });
    if (!wfState) {
        return res.status(404).json({ error: "Workflow not started" });
    }
    res.json(wfState);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 5. Start Workflow
app.post('/api/workflow/:owner/:repo/:issueId/start', async (req, res) => {
  try {
    const { owner, repo, issueId } = req.params;
    const { issue } = req.body;
    const repoDoc = await RepositoryModel.findOne({ owner, repo });
    if (!repoDoc) return res.status(404).json({ error: "Repository not found" });

    const id = parseInt(issueId, 10);

    let wfDoc = await WorkflowStateModel.findOne({ repoId: repoDoc._id, issueId: id });
    if (!wfDoc) {
      wfDoc = new WorkflowStateModel({
        issueId: id,
        repoId: repoDoc._id,
        issue,
        repoOwner: owner,
        repoName: repo,
        status: 'IDLE'
      });
    } else {
        // Reset for restart
        wfDoc.status = 'IDLE';
        wfDoc.logs = [] as any;
        wfDoc.relevantFiles = [] as any;
        wfDoc.patches = [] as any;
        wfDoc.plan = null;
        wfDoc.researchHistory = [] as any;
        wfDoc.researchLoopCount = 0;
        wfDoc.error = undefined;
        wfDoc.lastCompletedCheckpoint = null;
        wfDoc.pauseReason = null;
        wfDoc.pauseContext = null;
    }
    await wfDoc.save();

    const config: GithubConfig = { token: repoDoc.token, owner, repo };
    const workflow = new IssueResolutionWorkflow(config, wfDoc.toObject() as unknown as WorkflowState);
    
    workflow.subscribe(async (state) => {
      try {
        await WorkflowStateModel.updateOne({ _id: wfDoc._id }, {
           status: state.status,
           logs: state.logs,
           relevantFiles: state.relevantFiles,
           patches: state.patches,
           plan: state.plan,
           prUrl: state.prUrl,
           error: state.error,
           researchHistory: state.researchHistory,
           researchLoopCount: state.researchLoopCount,
           lastCompletedCheckpoint: state.lastCompletedCheckpoint,
           pauseReason: state.pauseReason,
           pauseContext: state.pauseContext,
           updatedAt: new Date()
        });
      } catch (err) {
        console.error("Failed to persist state", err);
      }
    });

    workflow.start(issue).catch(err => console.error("Workflow execution failed", err));

    res.json({ message: "Workflow started", workflowId: wfDoc._id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 6. Resume Workflow (NEW)
app.post('/api/workflow/:owner/:repo/:issueId/resume', async (req, res) => {
  try {
    const { owner, repo, issueId } = req.params;
    const repoDoc = await RepositoryModel.findOne({ owner, repo });
    if (!repoDoc) return res.status(404).json({ error: "Repository not found" });

    const id = parseInt(issueId, 10);
    const wfDoc = await WorkflowStateModel.findOne({ repoId: repoDoc._id, issueId: id });
    if (!wfDoc) return res.status(404).json({ error: "Workflow not found" });

    // Verify workflow is in resumable state
    if (wfDoc.status !== 'PAUSED_QUOTA' && wfDoc.status !== 'AWAITING_HUMAN') {
      return res.status(400).json({ 
        error: `Workflow cannot be resumed from status: ${wfDoc.status}` 
      });
    }

    const config: GithubConfig = { token: repoDoc.token, owner, repo };
    const workflow = new IssueResolutionWorkflow(config, wfDoc.toObject() as unknown as WorkflowState);
    
    workflow.subscribe(async (state) => {
        try {
          await WorkflowStateModel.updateOne({ _id: wfDoc._id }, {
             status: state.status,
             logs: state.logs,
             relevantFiles: state.relevantFiles,
             patches: state.patches,
             plan: state.plan,
             prUrl: state.prUrl,
             error: state.error,
             researchHistory: state.researchHistory,
             researchLoopCount: state.researchLoopCount,
             lastCompletedCheckpoint: state.lastCompletedCheckpoint,
             pauseReason: state.pauseReason,
             pauseContext: state.pauseContext,
             updatedAt: new Date()
          });
        } catch (err) {
          console.error("Failed to persist state", err);
        }
      });

    workflow.resume().catch(err => console.error("Resume failed", err));

    res.json({ message: "Workflow resumed" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 7. Submit Feedback / Resume
app.post('/api/workflow/:owner/:repo/:issueId/feedback', async (req, res) => {
  try {
    const { owner, repo, issueId } = req.params;
    const { approved, feedback } = req.body;
    const repoDoc = await RepositoryModel.findOne({ owner, repo });
    if (!repoDoc) return res.status(404).json({ error: "Repository not found" });

    const id = parseInt(issueId, 10);
    const wfDoc = await WorkflowStateModel.findOne({ repoId: repoDoc._id, issueId: id });
    if (!wfDoc) return res.status(404).json({ error: "Workflow not found" });

    const config: GithubConfig = { token: repoDoc.token, owner, repo };
    const workflow = new IssueResolutionWorkflow(config, wfDoc.toObject() as unknown as WorkflowState);
    
    workflow.subscribe(async (state) => {
        try {
          await WorkflowStateModel.updateOne({ _id: wfDoc._id }, {
             status: state.status,
             logs: state.logs,
             relevantFiles: state.relevantFiles,
             patches: state.patches,
             plan: state.plan,
             prUrl: state.prUrl,
             error: state.error,
             lastCompletedCheckpoint: state.lastCompletedCheckpoint,
             pauseReason: state.pauseReason,
             pauseContext: state.pauseContext,
             updatedAt: new Date()
          });
        } catch (err) {
          console.error("Failed to persist state", err);
        }
      });

    workflow.submitHumanFeedback(approved, feedback).catch(err => console.error("Feedback processing failed", err));

    res.json({ message: "Feedback submitted" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 8. List Workflows for a Repository
app.get('/api/repos/:owner/:repo/workflows', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const repoDoc = await RepositoryModel.findOne({ owner, repo });
    if (!repoDoc) return res.status(404).json({ error: "Repository not found" });

    const workflows = await WorkflowStateModel.find({ repoId: repoDoc._id })
      .sort({ updatedAt: -1 });

    res.json(workflows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 9. List Recent Workflows
app.get('/api/workflows/recent', async (req, res) => {
  try {
    const limitParam = (req as any).query?.limit as string | undefined;
    let limit = limitParam ? parseInt(limitParam, 10) : 20;
    if (!Number.isFinite(limit)) limit = 20;
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;

    const workflows = await WorkflowStateModel.find()
      .sort({ updatedAt: -1 })
      .limit(limit);

    res.json(workflows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});