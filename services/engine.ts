import { WorkflowStatus } from "../types";

// A lightweight implementation of LangGraph's StateGraph for browser environments
// This avoids heavy Node.js dependencies while providing the exact same architecture.

export type Reducer<T> = (state: T, update: Partial<T>) => T;
export type NodeAction<T> = (state: T) => Promise<Partial<T>>;
export type Condition<T> = (state: T) => string;

export const END = "__END__";
export const START = "__START__";

export class StateGraph<T extends { status: string }> {
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

export class CompiledGraph<T extends { status: string }> {
  constructor(
    private nodes: Map<string, NodeAction<T>>,
    private edges: Map<string, string | Condition<T>>,
    private entryPoint: string,
    private reducer: Reducer<T>,
    private interruptBefore: string[]
  ) {}

  async invoke(initialState: T, callbacks?: { onStateChange: (state: T) => void }): Promise<T> {
    let currentState = initialState;
    let currentNode = this.entryPoint;

    // Helper to emit state updates
    const emit = (s: T) => callbacks?.onStateChange(s);

    while (currentNode !== END) {
      // Check for interrupts (Human in the loop)
      if (this.interruptBefore.includes(currentNode)) {
        // If we are resuming (state matches the node we are interrupting), we proceed.
        // Otherwise, if we just arrived here, we stop.
        // For simplicity in this engine: we stop if the status doesn't match the node's intent yet,
        // or if we explicitly signal a stop. 
        // In this implementation, the caller is responsible for re-invoking from the interrupt point.
        // We'll return the state as is, effectively pausing.
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

      // 2. Execute Node Action
      try {
        // Mocking LangSmith Trace
        console.groupCollapsed(`[LangSmith] Trace: ${currentNode}`);
        console.log("Input State:", currentState);
        
        const update = await action(currentState);
        
        console.log("Output Update:", update);
        console.groupEnd();

        // 3. Apply Update
        currentState = this.reducer(currentState, update);
        
      } catch (e: any) {
        console.error(`Error in node ${currentNode}:`, e);
        let errorMessage = e?.message || 'Unknown error';
        if (e?.status === 429 || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.toLowerCase().includes('quota')) {
          errorMessage = 'Gemini quota exceeded. Please check your plan/billing or wait for the daily quota reset, then restart the workflow.';
        }
        currentState = this.reducer(currentState, { error: errorMessage, status: 'FAILED' } as unknown as Partial<T>);
        emit(currentState);
        return currentState;
      }

      // 4. Determine Next Node
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
}