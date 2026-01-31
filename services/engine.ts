import { WorkflowStatus } from "../types";

// A lightweight implementation of LangGraph's StateGraph for browser environments
// This avoids heavy Node.js dependencies while providing the exact same architecture.
// ENHANCED: Quota exhaustion detection and checkpoint-based resumption

export type Reducer<T> = (state: T, update: Partial<T>) => T;
export type NodeAction<T> = (state: T) => Promise<Partial<T>>;
export type Condition<T> = (state: T) => string;

export const END = "__END__";
export const START = "__START__";

// Error classification utilities
export class QuotaExhaustedError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
}

/**
 * Detects if an error is due to API quota exhaustion (HTTP 429)
 */
export function isQuotaError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message || String(error);
  const statusCode = error.status || error.statusCode;
  
  // Check for explicit 429 status
  if (statusCode === 429) return true;
  
  // Check for quota-related error messages
  const quotaKeywords = [
    'RESOURCE_EXHAUSTED',
    'quota exceeded',
    'rate limit',
    'too many requests',
    '429',
  ];
  
  return quotaKeywords.some(keyword => 
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Wrap an error as QuotaExhaustedError if it's quota-related
 */
export function classifyError(error: any): Error {
  if (isQuotaError(error)) {
    return new QuotaExhaustedError(
      'API quota exhausted. Workflow paused and can be resumed after quota reset.',
      error
    );
  }
  return error;
}

export class StateGraph<T extends { status: string; lastCompletedCheckpoint?: string | null }> {
  private nodes: Map<string, NodeAction<T>> = new Map();
  private edges: Map<string, string | Condition<T>> = new Map();
  private entryPoint: string = "";
  private interruptBefore: string[] = [];
  
  constructor(private reducer: Reducer<T>) {}

  addNode(name: string, action: NodeAction<T>) {
    this.nodes.set(name, action);
    return this;
  }

  addEdge(from: string, to: string | Condition<T>) {
    this.edges.set(from, to);
    return this;
  }

  setEntryPoint(node: string) {
    this.entryPoint = node;
    return this;
  }

  setInterruptBefore(nodes: string[]) {
    this.interruptBefore = nodes;
    return this;
  }

  compile() {
    return new CompiledGraph(this.nodes, this.edges, this.entryPoint, this.reducer, this.interruptBefore);
  }
}

export class CompiledGraph<T extends { status: string; lastCompletedCheckpoint?: string | null; pauseContext?: any }> {
  constructor(
    private nodes: Map<string, NodeAction<T>>,
    private edges: Map<string, string | Condition<T>>,
    private entryPoint: string,
    private reducer: Reducer<T>,
    private interruptBefore: string[]
  ) {}

  /**
   * Invoke the workflow graph with resumption support
   * If state.lastCompletedCheckpoint is set, resume from that point
   */
  async invoke(initialState: T, callbacks?: { onStateChange: (state: T) => void }): Promise<T> {
    let currentState = initialState;
    let currentNode = this.entryPoint;

    // Helper to emit state updates
    const emit = (s: T) => callbacks?.onStateChange(s);

    // RESUMPTION LOGIC: Determine starting point
    if (currentState.lastCompletedCheckpoint) {
      console.log(`[Resumption] Last completed checkpoint: ${currentState.lastCompletedCheckpoint}`);
      
      // If we're resuming from PAUSED_QUOTA, continue from the paused step
      const pausedStep = (currentState as any).pauseContext?.stepName;
      if (pausedStep && this.nodes.has(pausedStep)) {
        currentNode = pausedStep;
        console.log(`[Resumption] Resuming from paused step: ${pausedStep}`);
      } else {
        // Otherwise, find the next step after the checkpoint
        currentNode = this.getNextNodeAfterCheckpoint(currentState.lastCompletedCheckpoint);
        console.log(`[Resumption] Resuming from next node: ${currentNode}`);
      }
      
      // Clear pause state on resume
      currentState = this.reducer(currentState, {
        pauseReason: null,
        pauseContext: null 
      } as Partial<T>);
      emit(currentState);
    }

    while (currentNode !== END) {
      // Check for interrupts (Human in the loop)
      if (this.interruptBefore.includes(currentNode)) {
        if (currentState.status !== currentNode) {
          currentState = this.reducer(currentState, { status: currentNode } as Partial<T>);
          emit(currentState);
          return currentState;
        }
      }

      const action = this.nodes.get(currentNode);
      if (!action) throw new Error(`Node ${currentNode} not found`);

      // 1. Update status to current node (Processing...)
      currentState = this.reducer(currentState, { status: currentNode } as Partial<T>);
      emit(currentState);

      // 2. Execute Node Action with quota error handling
      try {
        console.groupCollapsed(`[LangSmith] Trace: ${currentNode}`);
        console.log("Input State:", currentState);
        
        const update = await action(currentState);
        
        console.log("Output Update:", update);
        console.groupEnd();

        // 3. Apply Update
        currentState = this.reducer(currentState, update);
        
        // 4. Mark checkpoint as completed
        currentState = this.reducer(currentState, { 
          lastCompletedCheckpoint: currentNode 
        } as Partial<T>);
        
      } catch (e: any) {
        console.error(`Error in node ${currentNode}:`, e);
        
        // QUOTA ERROR HANDLING
        const classifiedError = classifyError(e);
        
        if (classifiedError instanceof QuotaExhaustedError) {
          console.warn('[Quota Exhausted] Pausing workflow for resumption');
          
          const attemptCount = ((currentState as any).pauseContext?.attemptCount || 0) + 1;
          
          currentState = this.reducer(currentState, {
            status: 'PAUSED_QUOTA',
            pauseReason: 'QUOTA_EXHAUSTED',
            pauseContext: {
              stepName: currentNode,
              attemptCount: attemptCount,
              lastError: classifiedError.message,
              timestamp: new Date().toISOString(),
            }
          } as unknown as Partial<T>);
          
          emit(currentState);
          return currentState; // Pause here, can be resumed
        }
        
        // NON-QUOTA ERRORS: Fail workflow
        let errorMessage = e?.message || 'Unknown error';
        currentState = this.reducer(currentState, { 
          error: errorMessage, 
          status: 'FAILED' 
        } as unknown as Partial<T>);
        emit(currentState);
        return currentState;
      }

      // 5. Determine Next Node
      const edge = this.edges.get(currentNode);
      if (!edge) {
        currentNode = END;
      } else if (typeof edge === 'function') {
        currentNode = edge(currentState);
      } else {
        currentNode = edge;
      }
    }

    // Final state
    currentState = this.reducer(currentState, { status: 'COMPLETED' } as Partial<T>);
    emit(currentState);
    return currentState;
  }
  
  /**
   * Get the next node to execute after a completed checkpoint
   * This is a simple linear progression for now, but could be enhanced
   * to use the edge map for more complex graphs
   */
  private getNextNodeAfterCheckpoint(checkpoint: string): string {
    const edge = this.edges.get(checkpoint);
    if (typeof edge === 'string') return edge;
    // If conditional edge, we'd need state to evaluate - default to entry
    return this.entryPoint;
  }
}