export enum WorkflowStatus {
  IDLE = 'IDLE',
  LOADING_ISSUES = 'LOADING_ISSUES',
  // Graph Nodes
  RESEARCH_DECISION = 'RESEARCH_DECISION', // AI deciding what to do next
  RESEARCH_TOOL = 'RESEARCH_TOOL',         // Executing a tool (reading file, etc.)
  PLANNING = 'PLANNING',
  GENERATING_FIX = 'GENERATING_FIX',
  AWAITING_HUMAN = 'AWAITING_HUMAN',
  CREATING_PR = 'CREATING_PR',
  // Recoverable Pause States
  PAUSED_QUOTA = 'PAUSED_QUOTA', // Paused due to quota exhaustion, can resume
  // End States
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  labels: { name: string; color: string }[];
  html_url: string;
}

export interface RelevantFile {
  path: string;
  reason: string;
  content?: string;
}

export interface PatchCandidate {
  file: string;
  originalContent: string;
  newContent: string;
  explanation: string;
}

export interface Plan {
  analysis: string;
  steps: string[];
}

// Checkpoint tracking for resumption
export interface PauseContext {
  stepName: string;         // The step that was executing when paused
  attemptCount: number;     // Number of retry attempts for this step
  lastError: string;        // The 429 error message
  timestamp: string;        // When the pause occurred
  partialProgress?: any;    // Any partial progress within the step
}

export interface WorkflowState {
  status: string;
  issue: GithubIssue | null;
  logs: string[];
  relevantFiles: RelevantFile[];
  plan: Plan | null;
  patches: PatchCandidate[];
  prUrl?: string;
  error?: string;
  repoOwner?: string;
  repoName?: string;
  
  // Research State
  researchHistory: any[]; // Stores the conversation history (User, Model, Tool)
  researchLoopCount: number; // Safety breaker for the loop
  
  // Resumption State (NEW)
  lastCompletedCheckpoint: string | null; // Last successfully completed major step
  pauseReason: 'QUOTA_EXHAUSTED' | null;
  pauseContext: PauseContext | null;
}

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
}

// Graph specific types
export interface AgentState extends WorkflowState {
  messages?: any[];
}