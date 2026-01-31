import { WorkflowState, WorkflowStatus, GithubIssue, GithubConfig } from '../types';
import { GitHubService } from './github';
import { analyzeAndPlan, generateFileFix, getResearchStep } from './gemini';
import { StateGraph } from './engine';

// --- Graph Nodes ---

const researchDecisionNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  if (!state.issue) throw new Error("No issue in context");

  // Safety break
  if (state.researchLoopCount > 15) {
    return { 
      logs: [...state.logs, "[System] Research loop limit reached. Forcing plan."],
    };
  }

  let currentHistory = [...state.researchHistory];
  let logs = [...state.logs];

  // Initialize history with system prompt if empty
  if (currentHistory.length === 0) {
    const initialPrompt = `
      You are a Senior Software Engineer investigating a GitHub Issue.
      
      Issue Title: ${state.issue.title}
      Issue Description: ${state.issue.body}
      
      Your goal is to "walk" the repository to locate the relevant files and understand the bug.
      You have tools to:
      1. List directories (listFiles)
      2. Read file contents (readFile)
      3. Search code (searchCode)
      
      Start by exploring the repository structure or searching for keywords from the issue. 
      Read the code of files you suspect are involved.
      Once you have read the code and understand the problem, call 'finishResearch'.
      
      DO NOT guess file paths. List directories to see what exists.
    `;
    
    const userMsg = { role: 'user', parts: [{ text: initialPrompt }] };
    currentHistory.push(userMsg);
  }

  // Call Agent (this may throw QuotaExhaustedError)
  const response = await getResearchStep(currentHistory);
  const candidates = response.candidates;
  
  if (!candidates || candidates.length === 0) {
    throw new Error("No response from Research Agent");
  }

  const modelTurn = candidates[0].content;
  
  // Append model response to history
  currentHistory.push({ role: 'model', parts: modelTurn.parts });

  // Logs
  const logMsg = modelTurn.parts
    .filter((p: any) => p.text)
    .map((p: any) => `[Agent] ${p.text}`)
    .join('\n') || "[Agent] (Thinking/Calling Tool...)";

  logs.push(logMsg);

  return {
    researchHistory: currentHistory,
    logs: logs
  };
};

const researchToolNode = async (state: WorkflowState, github: GitHubService): Promise<Partial<WorkflowState>> => {
  const lastMessage = state.researchHistory[state.researchHistory.length - 1];
  const parts = lastMessage.parts || [];
  
  const functionCalls = parts.filter((p: any) => !!p.functionCall);
  if (functionCalls.length === 0) {
    return { logs: [...state.logs, "[System] No tool call found."] };
  }

  const newHistory = [...state.researchHistory];
  const logs = [...state.logs];
  const newRelevantFiles = [...state.relevantFiles];

  for (const part of functionCalls) {
    const call = part.functionCall;
    const { name, args } = call;
    let result: any = "Done";

    logs.push(`[Tool] Executing ${name}(${JSON.stringify(args)})`);

    try {
      if (name === 'listFiles') {
        result = await github.listDirectory(args.path);
        result = JSON.stringify(result);
      } else if (name === 'readFile') {
        const content = await github.getFileContent(args.path);
        result = content ? `File Content (${content.length} chars):\n${content}` : "File empty or not found.";
        
        if (content) {
          if (!newRelevantFiles.find(f => f.path === args.path)) {
            newRelevantFiles.push({ path: args.path, reason: 'Read by Research Agent', content });
          }
        }
      } else if (name === 'searchCode') {
        result = await github.searchCode(args.query);
        result = JSON.stringify(result);
      } else if (name === 'finishResearch') {
        result = "Research Completed.";
      }
    } catch (e: any) {
      result = `Error: ${e.message}`;
    }

    newHistory.push({
      role: 'user',
      parts: [{
        functionResponse: {
          name: name,
          response: { result: result } 
        }
      }]
    });
  }

  return {
    researchHistory: newHistory,
    relevantFiles: newRelevantFiles,
    logs: logs,
    researchLoopCount: state.researchLoopCount + 1
  };
};

const planNode = async (state: WorkflowState) => {
  if (!state.issue) throw new Error("No issue");
  const validFiles = state.relevantFiles.filter(f => f.content);
  
  if (validFiles.length === 0) {
    return {
      plan: { analysis: "No files were read during research. Cannot plan fix.", steps: [] },
      logs: [...state.logs, "[Agent] No relevant files found to fix."]
    };
  }

  const plan = await analyzeAndPlan(state.issue.title, state.issue.body, validFiles as any);
  
  return {
    plan,
    logs: [...state.logs, `[Agent] Plan generated: ${plan.analysis}`]
  };
};

const generateFixNode = async (state: WorkflowState) => {
  if (!state.issue || !state.plan) throw new Error("Missing inputs for generation");
  
  const patches = [];
  for (const file of state.relevantFiles) {
    if (!file.content) continue;
    const fix = await generateFileFix(state.issue.body, state.plan.analysis, file.path, file.content);
    patches.push({
      file: file.path,
      originalContent: file.content,
      newContent: fix.newContent,
      explanation: fix.explanation
    });
  }

  return {
    patches,
    logs: [...state.logs, `[Agent] Generated ${patches.length} patches. Waiting for review.`]
  };
};

const createPrNode = async (state: WorkflowState, github: GitHubService) => {
  if (!state.issue || state.patches.length === 0) throw new Error("Cannot create PR without patches");

  try {
    const files = state.patches.map(p => ({ path: p.file, content: p.newContent }));
    const prUrl = await github.createPR(
      state.issue.number,
      files,
      state.issue.title,
      state.plan?.analysis || "AI Fix"
    );

    return {
      prUrl,
      logs: [...state.logs, `[GitHub] PR Created: ${prUrl}`]
    };
  } catch (e: any) {
    let errorMsg = e.message;
    if (e.message.includes("Resource not accessible") || e.status === 403) {
      errorMsg = "Permission Denied: Check GitHub Token scopes.";
    }
    throw new Error(errorMsg);
  }
};

// --- Workflow Class ---

export class IssueResolutionWorkflow {
  public state: WorkflowState;
  private listeners: ((state: WorkflowState) => void)[] = [];
  private github: GitHubService;
  private headless: boolean;
  private graph: any; 

  constructor(config: GithubConfig, initialState?: WorkflowState, headless: boolean = false) {
    this.github = new GitHubService(config.token, config.owner, config.repo);
    this.headless = headless;
    
    this.state = initialState || {
      status: WorkflowStatus.IDLE,
      issue: null,
      logs: [],
      relevantFiles: [],
      patches: [],
      plan: null,
      repoOwner: config.owner,
      repoName: config.repo,
      researchHistory: [],
      researchLoopCount: 0,
      // Resumption fields
      lastCompletedCheckpoint: null,
      pauseReason: null,
      pauseContext: null
    };

    this.buildGraph();
  }

  private buildGraph() {
    const reducer = (current: WorkflowState, update: Partial<WorkflowState>) => ({
      ...current,
      ...update,
      logs: update.logs ? update.logs : current.logs
    });

    const checkResearchStatus = (state: WorkflowState) => {
      const lastMsg = state.researchHistory[state.researchHistory.length - 1];
      const parts = lastMsg?.parts || [];
      const hasFinish = parts.some((p: any) => p.functionCall?.name === 'finishResearch');
      const hasToolCall = parts.some((p: any) => !!p.functionCall);

      if (hasFinish || state.researchLoopCount > 15) {
        return WorkflowStatus.PLANNING;
      }
      if (hasToolCall) {
        return WorkflowStatus.RESEARCH_TOOL;
      }
      return WorkflowStatus.RESEARCH_DECISION;
    };

    const workflow = new StateGraph<WorkflowState>(reducer)
      .addNode(WorkflowStatus.RESEARCH_DECISION, (s) => researchDecisionNode(s))
      .addNode(WorkflowStatus.RESEARCH_TOOL, (s) => researchToolNode(s, this.github))
      .addNode(WorkflowStatus.PLANNING, (s) => planNode(s))
      .addNode(WorkflowStatus.GENERATING_FIX, (s) => generateFixNode(s))
      .addNode(WorkflowStatus.AWAITING_HUMAN, async (s) => ({ logs: [...s.logs, "[System] Paused for Review."] }))
      .addNode(WorkflowStatus.CREATING_PR, (s) => createPrNode(s, this.github))

      .setEntryPoint(WorkflowStatus.RESEARCH_DECISION)
      
      .addEdge(WorkflowStatus.RESEARCH_DECISION, checkResearchStatus)
      .addEdge(WorkflowStatus.RESEARCH_TOOL, WorkflowStatus.RESEARCH_DECISION)
      .addEdge(WorkflowStatus.PLANNING, WorkflowStatus.GENERATING_FIX)
      .addEdge(WorkflowStatus.GENERATING_FIX, WorkflowStatus.AWAITING_HUMAN);

    if (this.headless) {
      workflow.addEdge(WorkflowStatus.AWAITING_HUMAN, WorkflowStatus.CREATING_PR);
    } else {
      workflow.setInterruptBefore([WorkflowStatus.AWAITING_HUMAN]);
      workflow.addEdge(WorkflowStatus.AWAITING_HUMAN, WorkflowStatus.CREATING_PR);
    }

    this.graph = workflow.compile();
  }

  subscribe(listener: (state: WorkflowState) => void) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private broadcast(state: WorkflowState) {
    this.state = state;
    this.listeners.forEach(l => l(this.state));
  }

  async loadIssues() {
    return await this.github.getIssues();
  }

  async start(issue: GithubIssue) {
    const initialState: WorkflowState = {
      ...this.state,
      status: WorkflowStatus.RESEARCH_DECISION,
      issue,
      logs: [...(this.state.logs || []), `Starting Iterative Research for #${issue.number}...`],
      relevantFiles: [],
      patches: [],
      plan: null,
      error: undefined,
      prUrl: undefined,
      researchHistory: [],
      researchLoopCount: 0,
      lastCompletedCheckpoint: null,
      pauseReason: null,
      pauseContext: null
    };
    
    this.broadcast(initialState);
    
    return this.graph.invoke(initialState, {
      onStateChange: (newState: WorkflowState) => this.broadcast(newState)
    });
  }

  /**
   * Resume a paused workflow (either from PAUSED_QUOTA or AWAITING_HUMAN)
   */
  async resume() {
    if (this.state.status === WorkflowStatus.PAUSED_QUOTA) {
      const resumeLog = `[System] Resuming from ${this.state.pauseContext?.stepName || 'unknown step'} (attempt ${(this.state.pauseContext?.attemptCount || 0) + 1})`;
      const updatedState = {
        ...this.state,
        logs: [...this.state.logs, resumeLog]
      };
      this.broadcast(updatedState);
    }
    
    return this.graph.invoke(this.state, {
      onStateChange: (newState: WorkflowState) => this.broadcast(newState)
    });
  }

  async submitHumanFeedback(approved: boolean, feedback?: string) {
    if (approved) {
      this.broadcast({ 
        ...this.state, 
        logs: [...this.state.logs, "[Human] Approved. Creating PR..."] 
      });

      const resumeState = { ...this.state, status: WorkflowStatus.CREATING_PR };
      
      const partialGraph = new StateGraph<WorkflowState>((s, u) => ({...s, ...u}))
        .addNode(WorkflowStatus.CREATING_PR, (s) => createPrNode(s, this.github))
        .setEntryPoint(WorkflowStatus.CREATING_PR)
        .compile();
        
      return partialGraph.invoke(resumeState, {
         onStateChange: (s) => this.broadcast(s)
      });

    } else {
      this.broadcast({ 
        ...this.state, 
        status: WorkflowStatus.FAILED, 
        error: `Feedback: ${feedback}`,
        logs: [...this.state.logs, `[Human] Changes requested: ${feedback}`] 
      });
      return this.state;
    }
  }
}