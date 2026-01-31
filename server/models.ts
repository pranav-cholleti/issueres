import mongoose from 'mongoose';

const RepoSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  token: { type: String, required: true },
});

// Compound index to ensure uniqueness
RepoSchema.index({ owner: 1, repo: 1 }, { unique: true });

const WorkflowStateSchema = new mongoose.Schema({
  issueId: { type: Number, required: true, index: true }, // GitHub Issue ID (not number)
  repoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
  
  // Flattened WorkflowState
  status: { type: String, default: 'IDLE' },
  logs: [String],
  issue: Object, // Store the full issue object
  relevantFiles: [Object],
  patches: [Object],
  plan: Object,
  prUrl: String,
  error: String,
  
  researchHistory: [Object],
  researchLoopCount: { type: Number, default: 0 },
  
  repoOwner: String,
  repoName: String,
  
  updatedAt: { type: Date, default: Date.now }
});

export const RepositoryModel = mongoose.model('Repository', RepoSchema);
export const WorkflowStateModel = mongoose.model('WorkflowState', WorkflowStateSchema);