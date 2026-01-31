I’ll gather the remaining code context (components, pages, HTML shell, metadata) so the documentation can be precise and complete, then I’ll produce the detailed multi-section document you requested.

# 1. Project Overview

## 1.1 Problem statement

Teams managing GitHub repositories have many open issues, often with incomplete context and limited maintainer time. Manually:

1. Reading and understanding an issue.
2. Discovering relevant code.
3. Designing a fix.
4. Editing code safely.
5. Creating a Pull Request (PR) that references the issue.

…is time‑consuming and error‑prone.

This project provides an **AI‑assisted issue resolution system** that:

- Uses **Gemini** to inspect a GitHub repo and reason about issues.
- Uses **Octokit** to read code and create branches/PRs.
- Persists workflow state in **MongoDB**.
- Provides a **web dashboard** for human‑in‑the‑loop control.
- Provides a **GitHub Action** to run the same workflow headlessly when issues open.

## 1.2 System goals

1. **Automate issue triage and code modification**  
   - Automatically read issue descriptions.
   - Explore the repository (file tree, contents, search).
   - Generate a concrete implementation plan and code patches.

2. **Produce PRs with minimal manual effort**  
   - Apply generated patches to files.
   - Open a PR referencing the original issue.
   - Provide explanations of changes.

3. **Human‑in‑the‑loop safety**  
   - Let humans review generated patches before PR creation.
   - Allow approval or rejection with feedback.

4. **Unified logic across UI and GitHub Action**  
   - Use the same [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) engine for:
     - The **web app backend**.
     - The **GitHub Action** (headless mode).

5. **Persistence & introspection**  
   - Persist workflow state in MongoDB.
   - Allow UI polling to inspect logs, plan, patches, and PR status.

## 1.3 Functional and non‑functional requirements

### 1.3.1 Functional requirements

1. **Repository connection**
   1. User can enter a GitHub **PAT**, `owner`, and `repo` via the UI.
   2. Backend stores this as a `Repository` document.
   3. If the repo is re‑connected, the token is updated.

2. **Dashboard**
   1. List all connected repositories.
   2. Show per‑repo stats:
      - Count of **active workflows** (status neither `IDLE` nor terminal success/failure).
      - Count of **failed workflows**.

3. **Issue listing**
   1. For a given `{owner, repo}`, the system can:
      - Fetch open issues using GitHub REST API.
      - Merge in local workflow state (`workflowStatus`) if any.

4. **Workflow lifecycle**
   1. Start a workflow for a specific issue via:
      - UI: `POST /api/workflow/:owner/:repo/:issueId/start`.
      - GitHub Action: [IssueResolutionWorkflow.start(...)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3) with webhook payload.
   2. Workflow performs:
      - Iterative research (list files, read file contents, search code).
      - Planning (problem analysis and stepwise resolution plan).
      - Patch generation for relevant files.
      - Human review step (non‑headless mode).
      - PR creation.
   3. Persist intermediate workflow state in MongoDB.
   4. Allow human approval/rejection via `feedback` endpoint.

5. **Headless GitHub Action mode**
   1. On issue open/reopen in GitHub:
      - Trigger workflow using repo’s `GITHUB_TOKEN` and a Gemini API key.
      - Run the same graph in headless mode:
        - No human review interruption.
        - Proceeds automatically from patch generation to PR creation.

6. **UI features**
   1. Dashboard to select repo.
   2. Issues list table with:
      - Issue metadata.
      - Labels.
      - Agent workflow status badge.
   3. Workflow detail page with:
      - Status graph.
      - Plan.
      - Research history (tool calls).
      - Code diff preview for patches.
      - Logs.
      - Human review panel for approve/reject actions.

### 1.3.2 Non‑functional requirements

1. **Reliability**
   - If the process fails (e.g., Gemini quota, GitHub permission error), state must:
     - Transition to `FAILED`.
     - Persist error messages.
     - Be visible in the UI.

2. **Security**
   - PATs and tokens are sensitive:
     - Stored as plain strings in MongoDB in this implementation (this is a risk).
     - Must only be used server‑side to call GitHub APIs.
   - CORS is enabled without strong restrictions (development‑friendly; production should restrict origin).

3. **Performance**
   - Targeted for single‑team usage; concurrency is modest.
   - Research loop is bounded:
     - `researchLoopCount` safety limit (max 15).
   - Polling interval (2 seconds) for workflow UI is chosen as a trade‑off between freshness and load.

4. **Maintainability**
   - Shared [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1) types used across:
     - Backend server.
     - GitHub Action.
     - UI components (e.g., [WorkflowGraph](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/WorkflowGraph.tsx:37:0-122:2), [ReviewPanel](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/ReviewPanel.tsx:9:0-104:2)).
   - Workflow logic isolated in [services/workflow.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:0:0-0:0) + [services/engine.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:0:0-0:0).

5. **Extensibility**
   - Adding new workflow steps requires:
     - New node functions.
     - New `WorkflowStatus` entries.
     - New edges in [StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1).
   - Adding UI features can build atop stable HTTP API and state shape.

---

# 2. System Architecture

## 2.1 High‑level architecture (textual diagram)

Textual component diagram:

1. **Browser (React SPA)**
   1. [index.html](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.html:0:0-0:0)
   2. [index.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.tsx:0:0-0:0)
   3. [App.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/App.tsx:0:0-0:0) + pages + components
2. **Backend (Express server)**
   1. [server/server.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/server.ts:0:0-0:0) – HTTP API and workflow orchestration endpoint.
   2. [server/models.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/models.ts:0:0-0:0) – Mongoose schemas.
   3. [services/workflow.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:0:0-0:0) – [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) orchestrator.
   4. [services/engine.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:0:0-0:0) – [StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1) implementation.
   5. [services/github.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:0:0-0:0) – GitHub API abstraction.
   6. [services/gemini.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:0:0-0:0) – Gemini integration utilities.
   7. [types.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:0:0-0:0) – shared domain types.
3. **Database**
   1. MongoDB database (`issueres` or as per `MONGODB_URI`).
4. **GitHub**
   1. GitHub REST API (Issues, Repos, Git Data, Search, Pull Requests).
   2. GitHub Actions runner for [issue-resolution.yml](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/.github/workflows/issue-resolution.yml:0:0-0:0).
5. **Gemini API**
   1. `@google/genai` clients for:
      - Tools‑based research (`gemini-2.5-flash`).
      - Planning and code generation (`gemini-3-pro-preview`).

Control/data flow overview:

- Browser ⇄ Express HTTP API ⇄ MongoDB
- Express server ⇄ GitHub API
- Express server ⇄ Gemini API
- GitHub Action ⇄ GitHub API
- GitHub Action ⇄ Gemini API

## 2.2 Components and responsibilities

1. **Frontend**
   1. [App.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/App.tsx:0:0-0:0) – Defines routes using React Router.
   2. [pages/Dashboard.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/Dashboard.tsx:0:0-0:0) – Fetches repos and shows cards.
   3. [pages/IssueList.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/IssueList.tsx:0:0-0:0) – Shows issues for a repo.
   4. [pages/WorkflowDetail.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:0:0-0:0) – Shows a single issue’s workflow.
   5. [components/Layout.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:0:0-0:0) – Global layout + repository connection modal.
   6. [components/IssueSidebar.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/IssueSidebar.tsx:0:0-0:0) – Side list of issues.
   7. [components/WorkflowGraph.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/WorkflowGraph.tsx:0:0-0:0) – Visual representation of workflow statuses.
   8. [components/CodePreview.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/CodePreview.tsx:0:0-0:0) – Diff viewer for generated patches.
   9. [components/Terminal.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Terminal.tsx:0:0-0:0) – Live log viewer.
   10. [components/ReviewPanel.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/ReviewPanel.tsx:0:0-0:0) – Approve/reject UI.

2. **Backend**
   1. [server/server.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/server.ts:0:0-0:0):
      - HTTP routes.
      - Wiring to Mongoose models.
      - Instantiates [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1).
      - Subscribes to workflow state updates and persists them.
   2. [server/models.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/models.ts:0:0-0:0):
      - `RepositoryModel`.
      - `WorkflowStateModel`.

3. **Workflow engine**
   1. [services/engine.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:0:0-0:0):
      - Minimal [StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1) and [CompiledGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:45:0-125:1) replicating LangGraph structure.
   2. [services/workflow.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:0:0-0:0):
      - Node functions ([researchDecisionNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:7:0-72:2), [researchToolNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:74:0-137:2), [planNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:139:0-157:2), [generateFixNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:159:0-178:2), [createPrNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:180:0-203:2)).
      - [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1):
        - Maintains `state`.
        - Manages Graph lifecycle.
        - Wraps GitHub service.
        - Provides [start](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3), [resume](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:330:2-334:3), and [submitHumanFeedback](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:336:2-363:3).

4. **External API adapters**
   1. [services/github.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:0:0-0:0):
      - Encapsulates Octokit usage.
   2. [services/gemini.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:0:0-0:0):
      - Encapsulates calls to `@google/genai`:
        - Tools‑based research.
        - Planning.
        - File‑level fix generation.

5. **GitHub Action**
   1. [.github/workflows/issue-resolution.yml](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/.github/workflows/issue-resolution.yml:0:0-0:0):
      - Orchestrates Node setup and invokes `npx tsx action/main.ts`.
   2. [action/main.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/action/main.ts:0:0-0:0):
      - Translates GitHub event payload into [GithubIssue](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:15:0-28:1).
      - Runs [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) in headless mode.

## 2.3 Data flow and control flow

### 2.3.1 UI → Backend → GitHub/Gemini → DB

1. User connects repo via UI.
2. UI makes API calls to backend.
3. Backend:
   - Stores repo.
   - On workflow start:
     - Reads issue from body.
     - Creates/updates [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1) doc.
     - Instantiates [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1).
     - Registers a [subscribe](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:288:2-294:3) callback to persist state.
     - Calls [workflow.start(issue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3).
4. Workflow engine:
   - Calls Gemini for research and planning.
   - Calls GitHub through [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1) for:
     - Listing files.
     - Reading file contents.
     - Searching code.
     - Creating PRs.
5. As new state is emitted, backend writes it to MongoDB.
6. The UI polls for new state to render updates.

### 2.3.2 GitHub Action control flow

1. Issue opened or reopened in the repo that includes this code.
2. GitHub Actions framework:
   - Executes workflow `Issue Resolution Agent`.
   - Provides `GITHUB_REPOSITORY`, `GITHUB_EVENT_PATH`, `GITHUB_TOKEN`, and secrets.
3. [action/main.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/action/main.ts:0:0-0:0):
   - Reads `GITHUB_EVENT_PATH`.
   - Constructs [GithubIssue](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:15:0-28:1).
   - Instantiates [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) in `headless = true` mode.
   - Calls [workflow.start(issue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3).
4. Same state graph runs, but without Mongo persistence or interactive UI.

## 2.4 External dependencies and integrations

1. **GitHub API**
   - Libraries:
     - `"octokit": "^4.0.2"`.
   - Used by [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1):
     - `rest.issues.listForRepo`.
     - `rest.repos.get`.
     - `rest.git.getTree`.
     - `rest.repos.getContent`.
     - `rest.search.code`.
     - `rest.git.getRef`.
     - `rest.git.createRef`.
     - `rest.git.createBlob`.
     - `rest.git.createTree`.
     - `rest.git.updateRef`.
     - `rest.pulls.create`.

2. **Gemini API**
   - Library: `"@google/genai": "^1.38.0"`.
   - Models:
     - `gemini-2.5-flash` for tools‑based research.
     - `gemini-3-pro-preview` for planning and file fix generation.
   - Auth via:
     - `process.env.API_KEY` or `process.env.GEMINI_API_KEY`.

3. **MongoDB**
   - Library: `"mongoose": "^9.1.5"`.
   - Default URI: `mongodb://localhost:27017/issueres` or `process.env.MONGODB_URI`.

4. **Express + CORS**
   - `"express": "^5.2.1"`.
   - `"cors": "^2.8.6"`.
   - ESM mode: `"type": "module"`.

5. **React & Vite**
   - `"react": "^19.2.3"`.
   - `"react-dom": "^19.2.3"`.
   - `"react-router-dom": "6.22.3"`.
   - `"vite": "^6.2.0"`.
   - `"@vitejs/plugin-react": "^5.0.0"`.

6. **UI and utilities**
   - `"lucide-react": "^0.563.0"` – icons.
   - `"diff": "5.2.0"` – text diffing library for CodePreview.
   - Tailwind CSS via CDN in [index.html](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.html:0:0-0:0).

7. **TypeScript + tsx**
   - `"typescript": "~5.8.2"`.
   - `"tsx": "^4.19.2"` – to run TypeScript files directly (backend, action).

---

# 3. Design Decisions

## 3.1 Architectural patterns used

1. **Client‑server SPA**
   - React SPA as client.
   - Express REST API backend.

2. **Layered design (UI → API → Orchestrator → Adapters)**
   1. UI: React components and pages.
   2. API layer: Express routes.
   3. Orchestrator: [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) + [StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1).
   4. Adapters: [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1), Gemini wrappers.
   5. Persistence: Mongoose models.

3. **State machine / graph pattern**
   - [StateGraph<T>](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1) models the workflow as nodes and directed edges.
   - [CompiledGraph.invoke](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:54:2-124:3) drives transitions until an `END` is reached or an error occurs.
   - Workflow states are a constrained set of enums in `WorkflowStatus`.

4. **Headless vs interactive modes**
   - Same orchestrator used:
     - `headless = true` (GitHub Action): automatically transitions from `AWAITING_HUMAN` to `CREATING_PR`.
     - `headless = false` (backend/UI): interrupts before `AWAITING_HUMAN` until manual [submitHumanFeedback](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:336:2-363:3).

## 3.2 Key trade‑offs and justifications

1. **Polling vs WebSockets**
   - UI polls `/api/workflow/...` every 2 seconds.
   - Simpler to implement and deploy (no server push channels).
   - Trade‑off: possibly stale by up to 2 seconds; acceptable for human workflows.

2. **MongoDB for workflow persistence**
   - Chosen to:
     - Keep state between HTTP requests.
     - Allow introspection/history for each issue.
   - Trade‑off: additional infra dependency; requires configuration.

3. **Storing GitHub tokens in DB**
   - Simpler approach: store `token` string directly in `Repository` docs.
   - Trade‑off: security risk; must treat DB as highly sensitive.  
     (Improvement path: encryption at rest + key management; not implemented here.)

4. **Inline Tailwind CDN in [index.html](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.html:0:0-0:0)**
   - Suitable for rapid prototyping and AI Studio environment.
   - Trade‑off: not ideal for production (bundle size, CSP, offline, warning from CDN).

5. **Gemini as single LLM provider**
   - Simplifies code; consistent API via `@google/genai`.
   - Trade‑off: system is tightly coupled to Gemini API shape and quotas.

6. **Minimal retry logic**
   - On errors (e.g. Gemini 429), workflow sets `FAILED` with a helpful message.
   - No automatic retry/backoff implemented in orchestration logic.
   - Trade‑off: simpler control; manual restart required.

## 3.3 Scalability, performance, security considerations

1. **Scalability**
   - Scale vector: number of concurrent workflows and polling clients.
   - Key factors:
     - Gemini rate limits (most constraining).
     - GitHub API rate limits.
     - Mongo write frequency (each state update).
   - For many workflows:
     - Consider reducing write frequency (batching or only writing on state changes).
     - Introduce job queue (e.g., Bull) for background execution.

2. **Performance**
   - Node actions in graph combine:
     - Network I/O (GitHub, Gemini).
     - Moderate CPU cost (diffing only on UI).
   - The heaviest step is LLM interaction.

3. **Security**
   - Attack surfaces:
     - HTTP API with CORS open to all origins (in this code).
     - Mongo containing PATs.
     - GitHub Action running with `GITHUB_TOKEN`.
   - Recommended mitigations (not implemented in code but implied):
     - Restrict CORS to trusted domains.
     - Require authentication in front of API.
     - Encrypt PATs in Mongo.
     - Limit PAT scopes to only necessary repos.

---

# 4. Backend Structure

## 4.1 Directory and module layout

- [server/](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server:0:0-0:0)
  - [server.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/server.ts:0:0-0:0) – Express app and routes.
  - [models.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/models.ts:0:0-0:0) – Mongoose schemas and models.

- [services/](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services:0:0-0:0)
  - [engine.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:0:0-0:0) – [StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1) and [CompiledGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:45:0-125:1).
  - [workflow.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:0:0-0:0) – [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) and node functions.
  - [github.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:0:0-0:0) – [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1).
  - [gemini.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:0:0-0:0) – Gemini client and tools.

- Root shared:
  - [types.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:0:0-0:0) – `WorkflowStatus`, [GithubIssue](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:15:0-28:1), [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1), [GithubConfig](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:65:0-69:1), etc.
  - [constants.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/constants.ts:0:0-0:0) – `MOCK_ISSUES`, `MOCK_FILES` (currently not wired into backend).

- [action/](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/action:0:0-0:0)
  - [main.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/action/main.ts:0:0-0:0) – entrypoint for GitHub Action, runs the same workflow engine.

## 4.2 Core services and domain logic

### 4.2.1 [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) (services/workflow.ts)

- Constructor:
  - Inputs:
    - `config: GithubConfig` – `{ token, owner, repo }`.
    - `initialState?: WorkflowState`.
    - `headless?: boolean` (default `false`).
  - Responsibilities:
    1. Instantiate [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1) with token/owner/repo.
    2. Set `this.state` to:
       - `initialState` or
       - Default with:
         - `status: WorkflowStatus.IDLE`
         - `issue: null`
         - `logs: []`
         - `relevantFiles: []`
         - `patches: []`
         - `plan: null`
         - `repoOwner: config.owner`
         - `repoName: config.repo`
         - `researchHistory: []`
         - `researchLoopCount: 0`
    3. Build graph via [this.buildGraph()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:234:2-286:3).

- Methods:
  1. [subscribe(listener)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:288:2-294:3):
     - Adds listener and immediately calls it with current state.
     - Returns an unsubscribe function.
  2. [start(issue: GithubIssue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3):
     - Prepares initial workflow state:
       - Set status to `RESEARCH_DECISION`.
       - Clears previous logs, patches, etc.
       - Resets research history and counters.
     - Broadcasts the state.
     - Invokes compiled graph with [onStateChange](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:326:6-326:74) to broadcast updates.
  3. [resume()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:330:2-334:3):
     - Invokes graph from `this.state` (used after human review).
  4. [submitHumanFeedback(approved, feedback?)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:336:2-363:3):
     - If approved:
       - Broadcasts log `[Human] Approved. Creating PR...`.
       - Creates a short [StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1) starting at `CREATING_PR` only.
       - Invokes it, broadcasting state until PR is created.
     - If rejected:
       - Sets `status` to `FAILED`.
       - Sets `error` to `"Feedback: <feedback>"`.
       - Appends `[Human] Changes requested: <feedback>` to logs.

### 4.2.2 Node functions (services/workflow.ts)

1. **[researchDecisionNode(state)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:7:0-72:2)**
   1. If `state.issue` missing: throws.
   2. If `researchLoopCount > 15`: appends loop warning and returns (no new tools call).
   3. Initializes `researchHistory` with a system‑style user message if empty:
      - Describes tools and goals.
   4. Calls [getResearchStep(history)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:54:0-70:2) from [gemini.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:0:0-0:0):
      - Model: `gemini-2.5-flash` with tools.
   5. Appends Gemini’s model content as a `model` role entry in `researchHistory`.
   6. Appends `[Agent] ...` text to logs.

2. **[researchToolNode(state, github)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:74:0-137:2)**
   1. Inspects last message in `researchHistory`.
   2. Extracts parts with `functionCall`.
   3. For each function call:
      1. Logs `[Tool] Executing name(args)`.
      2. Switch on `name`:
         - `"listFiles"`:
           - Calls [github.listDirectory(args.path)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:83:2-99:3).
         - `"readFile"`:
           - Calls [github.getFileContent(args.path)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:63:2-79:3).
           - Adds file to `relevantFiles` (with content and reason) if not already there.
         - `"searchCode"`:
           - Calls [github.searchCode(args.query)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:101:2-113:3).
         - `"finishResearch"`:
           - Returns `"Research Completed."`.
   4. Appends a `user` message to `researchHistory` carrying the `functionResponse`.

3. **[planNode(state)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:139:0-157:2)**
   1. Requires `state.issue`.
   2. Filters `relevantFiles` to those with `content`.
   3. If none:
      - Sets `plan` to a simple message: “No files were read during research…”.
      - Appends log “[Agent] No relevant files found to fix.”
   4. Else:
      - Calls [analyzeAndPlan(issue.title, issue.body, files)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:74:0-118:2):
        - Model: `gemini-3-pro-preview`, JSON output with `{analysis, steps[]}`.
      - Sets `state.plan` and logs `[Agent] Plan generated: ...`.

4. **[generateFixNode(state)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:159:0-178:2)**
   1. Requires `state.issue` and `state.plan`.
   2. For every file with `content` in `relevantFiles`:
      - Calls [generateFileFix(issue.body, plan.analysis, file.path, file.content)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:120:0-167:2).
      - Collects patches:
        - `{ file, originalContent, newContent, explanation }`.
   3. Logs `[Agent] Generated N patches. Waiting for review.`.

5. **[createPrNode(state, github)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:180:0-203:2)**
   1. Requires `state.issue` and non‑empty `state.patches`.
   2. Maps patches into `{ path, content }[]`.
   3. Calls:
      - [github.createPR(issue.number, files, issue.title, plan.analysis or "AI Fix")](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:115:2-196:3).
   4. Sets `prUrl`.
   5. Logs `[GitHub] PR Created: <url>`.
   6. On error:
      - If message includes “Resource not accessible” or status 403:
        - Maps to friendlier message: `"Permission Denied: Check GitHub Token scopes."`.
      - Rethrows error for engine to handle.

### 4.2.3 [StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1) and [CompiledGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:45:0-125:1) (services/engine.ts)

- [StateGraph<T extends { status: string }>](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1):
  - Methods:
    - [addNode(name, action)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:20:2-23:3).
    - [addEdge(from, to)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:25:2-28:3) where `to` can be string or [Condition<T>](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:7:0-7:48).
    - [setEntryPoint(name)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:30:2-33:3).
    - [setInterruptBefore(nodes[])](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:35:2-38:3).
    - [compile()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:40:2-42:3) → [CompiledGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:45:0-125:1).

- [CompiledGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:45:0-125:1):
  - [invoke(initialState, { onStateChange })](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:54:2-124:3):
    1. While currentNode not `END`:
       - Respect interrupts for `interruptBefore`.
       - Set `state.status` to `currentNode`.
       - Call action and merge update via reducer.
       - Determine next node using edge (or function).
    2. On error:
       - Logs to console.
       - Sets:
         - `status: 'FAILED'`.
         - `error: message` (or friendly message for Gemini quotas).
       - Emits and returns.

### 4.2.4 [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1) (services/github.ts)

- Constructor:
  - `new GitHubService(token, owner, repo)`:
    - Instantiates `Octokit({ auth: token })`.

- Methods:
  1. [getIssues(): Promise<GithubIssue[]>](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:17:2-20:3)
  2. [getFileTree(recursive?: boolean): Promise<string[]>](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:38:2-61:3)
  3. [getFileContent(path: string): Promise<string>](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:63:2-79:3)
  4. [listDirectory(path?: string): Promise<string[]>](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:83:2-99:3)
  5. [searchCode(query: string): Promise<string[]>](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:101:2-113:3)
  6. [createPR(issueNumber, files, title, body): Promise<string>](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:115:2-196:3)

### 4.2.5 Gemini helpers (services/gemini.ts)

- [getClient()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:2:0-6:2):
  - Chooses API key from `process.env.API_KEY || process.env.GEMINI_API_KEY`.

- [getResearchStep(history[])](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:54:0-70:2):
  - `ai.models.generateContent` with:
    - Model: `"gemini-2.5-flash"`.
    - `contents: history`.
    - `tools` configuration with tool function declarations.

- [analyzeAndPlan(issueTitle, issueBody, fileContexts[])](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:74:0-118:2):
  - Construct text prompt with issue and file contents.
  - Calls `"gemini-3-pro-preview"` with:
    - `responseMimeType: "application/json"`.
    - `responseSchema`: `{ analysis: string, steps: string[] }`.
  - Parses `response.text`.

- [generateFileFix(issueBody, plan, filePath, fileContent)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:120:0-167:2):
  - Constructs detailed prompt with constraints.
  - Calls `"gemini-3-pro-preview"` similarly with JSON schema:
    - `{ newContent: string, explanation: string }`.
  - Parses `response.text`.

## 4.3 Database schema and relationships

### 4.3.1 RepositoryModel

- Schema fields:
  - `owner: string` (required).
  - `repo: string` (required).
  - `token: string` (required).
- Index:
  - Compound unique index `{ owner: 1, repo: 1 }`.

### 4.3.2 WorkflowStateModel

- Fields:
  - `issueId: number` – GitHub issue ID (not issue number).
  - `repoId: ObjectId` – Reference to `Repository`.
  - `status: string` – one of `WorkflowStatus` values.
  - `logs: string[]`.
  - `issue: object` – full issue payload (includes `workflowStatus` on responses).
  - `relevantFiles: object[]` – file paths with content and reasons.
  - `patches: object[]` – patch candidates.
  - `plan: object` – `{ analysis, steps[] }`.
  - `prUrl: string`.
  - `error: string`.
  - `researchHistory: object[]` – raw message / toolcall history.
  - `researchLoopCount: number`.
  - `repoOwner: string`.
  - `repoName: string`.
  - `updatedAt: Date` (default `Date.now`).

- Relationship:
  - Many [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1) documents per `Repository` (per issue).

## 4.4 Authentication and authorization flow

1. **UI → Backend**
   - No user authentication implemented:
     - Any client able to reach server can call endpoints.
     - Backend trusts incoming `owner`, `repo`, and `token`.

2. **Backend → GitHub**
   - Uses PAT stored in `Repository.token` or `GITHUB_TOKEN` from GitHub Actions.
   - PAT must have:
     - `repo` scopes sufficient for:
       - reading/writing code.
       - creating branches/PRs.

3. **GitHub Action**
   - Uses built‑in `GITHUB_TOKEN`:
     - Scoped to the repository where the workflow runs.
   - Gemini key taken from `GEMINI_API_KEY` secret.

4. **Gemini**
   - Auth via HTTP API key environment variable.

## 4.5 Error handling, retries, and logging

1. **Express routes**
   - All main routes wrap logic in `try/catch`:
     - On error: `res.status(500).json({ error: e.message })`.

2. **Workflow engine**
   - Each node’s body is wrapped by [CompiledGraph.invoke](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:54:2-124:3):
     - On error:
       - Logs to console.
       - Sets `status = 'FAILED'`.
       - Sets `error`:
         - Friendly message for Gemini quota (429/RESOURCE_EXHAUSTED/quota).
         - Otherwise raw message.
       - Emits final state.

3. **GitHubService**
   - Catches errors in [getFileTree](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:38:2-61:3), [getFileContent](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:63:2-79:3), [listDirectory](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:83:2-99:3), [searchCode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:101:2-113:3):
     - Logs error.
     - Returns safe fallback:
       - `[]` or `""` or `["Error: ..."]`.

4. **Retries**
   - No explicit retries beyond logic in Gemini error message.
   - Workflow must be restarted by user/higher‑level caller.

5. **Logging**
   - Console:
     - `console.groupCollapsed` and `console.log` for each node in graph.
     - `console.error` on node errors and persistence failures.
   - DB:
     - `WorkflowState.logs` collects human‑oriented log messages.

---

# 5. API Specification

Base URL (dev): `http://localhost:4000/api`

All endpoints respond with JSON and assume CORS has been enabled for the frontend’s origin.

## 5.1 List repositories

### 5.1.1 Method and URL

- `GET /api/repos`

### 5.1.2 Request

- Headers:
  - `Accept: application/json` (recommended).
- Parameters:
  - None.

### 5.1.3 Response

- Status codes:
  1. `200 OK` – success.
  2. `500 Internal Server Error` – on unhandled errors.

- Response body (`200 OK`): `RepositoryWithStats[]`

```ts
type RepositoryWithStats = {
  _id: string;
  owner: string;
  repo: string;
  token: string;
  __v?: number;
  stats: {
    active: number; // workflows not IDLE/COMPLETED/FAILED
    failed: number; // workflows with status 'FAILED'
  };
};
```

### 5.1.4 Failure modes

- Mongo connection failure.
- Unexpected error in `.find()` or `.countDocuments()`.

**Example 500 response:**

```json
{
  "error": "MongoDB connection error: ..."
}
```

### 5.1.5 Example

**Request:**

```http
GET /api/repos HTTP/1.1
Host: localhost:4000
Accept: application/json
```

**Response 200:**

```json
[
  {
    "_id": "64fa...",
    "owner": "pranav-cholleti",
    "repo": "calculator",
    "token": "github_pat_***",
    "stats": {
      "active": 1,
      "failed": 0
    }
  }
]
```

---

## 5.2 Connect or update repository

### 5.2.1 Method and URL

- `POST /api/repos`

### 5.2.2 Request

- Headers:
  - `Content-Type: application/json`
- Body:

```json
{
  "owner": "string (required)",
  "repo": "string (required)",
  "token": "string (required, GitHub PAT)"
}
```

- Validation:
  - All fields must be non‑empty strings.
  - No explicit backend validation beyond Mongoose required schema.

### 5.2.3 Response

- Status codes:
  1. `200 OK` – success.
  2. `500 Internal Server Error` – DB errors or unexpected.

- Response body (`200 OK`): `Repository` document

```json
{
  "_id": "64fa...",
  "owner": "pranav-cholleti",
  "repo": "calculator",
  "token": "github_pat_***",
  "__v": 0
}
```

### 5.2.4 Behavior

- If repository with `{owner, repo}` exists:
  - Update `token` and return updated doc.
- Else:
  - Create new document.

### 5.2.5 Example

**Request:**

```http
POST /api/repos HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "owner": "pranav-cholleti",
  "repo": "calculator",
  "token": "github_pat_ABC123"
}
```

**Response 200:**

```json
{
  "_id": "64fa...",
  "owner": "pranav-cholleti",
  "repo": "calculator",
  "token": "github_pat_ABC123",
  "__v": 0
}
```

---

## 5.3 List issues for a repository

### 5.3.1 Method and URL

- `GET /api/repos/:owner/:repo/issues`

### 5.3.2 Request

- Path params:
  - `owner: string` – GitHub owner/org.
  - `repo: string` – GitHub repo name.

- Validation:
  - Repo doc must exist in DB with matching owner/repo; otherwise 404.

### 5.3.3 Response

- Status codes:
  1. `200 OK` – list of issues.
  2. `404 Not Found` – no repository configured.
  3. `500 Internal Server Error` – unexpected or GitHub API failure.

- Response body (`200 OK`): `IssueWithWorkflowStatus[]`

```ts
type IssueWithWorkflowStatus = GithubIssue & {
  workflowStatus: string | null;
};
```

### 5.3.4 Behavior

1. Find `RepositoryModel` by `{owner, repo}`.
2. Use [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1) with repo token to call [getIssues()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:17:2-20:3).
3. Look up all `WorkflowStateModel` docs for `repoId`.
4. Match each GitHub issue by `issue.id` to any workflow state’s `issueId`.
5. Add `workflowStatus`:
   - `null` if no workflow found.
   - Status string otherwise.

### 5.3.5 Example

**Request:**

```http
GET /api/repos/pranav-cholleti/calculator/issues HTTP/1.1
Host: localhost:4000
```

**Response 200:**

```json
[
  {
    "id": 3875734337,
    "number": 8,
    "title": "Subtraction is failing",
    "body": "",
    "state": "open",
    "user": {
      "login": "pranav-cholleti",
      "avatar_url": "https://avatars.githubusercontent.com/u/...v=4"
    },
    "created_at": "2026-01-30T13:34:16Z",
    "labels": [
      { "name": "bug", "color": "d73a4a" }
    ],
    "html_url": "https://github.com/pranav-cholleti/calculator/issues/8",
    "workflowStatus": "FAILED"
  }
]
```

---

## 5.4 Get workflow state

### 5.4.1 Method and URL

- `GET /api/workflow/:owner/:repo/:issueId`

### 5.4.2 Request

- Path params:
  - `owner: string`
  - `repo: string`
  - `issueId: string` (parsed as integer `issue.id`)

### 5.4.3 Response

- Status codes:
  1. `200 OK` – workflow state exists.
  2. `404 Not Found` – repository or workflow not found.
  3. `500 Internal Server Error` – unexpected.

- Response body (`200 OK`): serialized [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1) document with Mongoose metadata fields (`_id`, `__v`, `updatedAt`).

Example (fields trimmed):

```json
{
  "_id": "697e22a939284e319cc586fb",
  "issueId": 3875734337,
  "repoId": "697e229c39284e319cc586e7",
  "status": "FAILED",
  "logs": [
    "Starting Iterative Research for #8...",
    "[Agent] (Thinking/Calling Tool...)",
    "[Tool] Executing listFiles({\"path\":\".\"})"
  ],
  "issue": { /* full issue object */ },
  "relevantFiles": [],
  "patches": [],
  "plan": null,
  "prUrl": null,
  "error": "Gemini quota exceeded. Please check your plan/billing or wait for the daily quota reset, then restart the workflow.",
  "repoOwner": "pranav-cholleti",
  "repoName": "calculator",
  "researchHistory": [ /* message history */ ],
  "researchLoopCount": 1,
  "updatedAt": "2026-01-31T15:41:29.853Z",
  "__v": 0
}
```

---

## 5.5 Start workflow

### 5.5.1 Method and URL

- `POST /api/workflow/:owner/:repo/:issueId/start`

### 5.5.2 Request

- Path params:
  - `owner: string`
  - `repo: string`
  - `issueId: string` (parsed as integer; must equal GitHub issue `id` field, not number)

- Headers:
  - `Content-Type: application/json`

- Body:

```json
{
  "issue": GithubIssue // full issue object as fetched from GitHub
}
```

[GithubIssue](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:15:0-28:1) shape (from [types.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:0:0-0:0)):

```ts
{
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  labels: { name: string; color: string }[];
  html_url: string;
}
```

### 5.5.3 Response

- Status codes:
  1. `200 OK` – workflow started.
  2. `404 Not Found` – repository not configured.
  3. `500 Internal Server Error` – DB or runtime error.

- Response body (`200 OK`):

```json
{
  "message": "Workflow started",
  "workflowId": "697e22a939284e319cc586fb"
}
```

### 5.5.4 Behavior

1. Find `RepositoryModel` by owner/repo.
2. Parse `issueId` as integer.
3. Find or create `WorkflowStateModel` for `{repoId, issueId}`:
   - On new:
     - Initialize:
       - `status: 'IDLE'`
       - `logs: []`
       - `relevantFiles: []`
       - `patches: []`
       - `plan: null`
       - `researchHistory: []`
       - `researchLoopCount: 0`
       - `error: undefined`
   - On existing:
     - Reset state fields to an “IDLE” clean base.
4. Save workflow doc.
5. Instantiate [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) with:
   - `config = { token: repoDoc.token, owner, repo }`.
   - `initialState = wfDoc.toObject()` cast to [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1).
6. Subscribe with a function that:
   - `updateOne` on `WorkflowStateModel` for:
     - `status`
     - `logs`
     - `relevantFiles`
     - `patches`
     - `plan`
     - `prUrl`
     - `error`
     - `researchHistory`
     - `researchLoopCount`
     - `updatedAt`.
7. [workflow.start(issue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3) is called without awaiting completion:
   - Runs asynchronously.
   - Errors during execution are logged to console.

---

## 5.6 Submit feedback

### 5.6.1 Method and URL

- `POST /api/workflow/:owner/:repo/:issueId/feedback`

### 5.6.2 Request

- Path params:
  - `owner: string`
  - `repo: string`
  - `issueId: string`

- Headers:
  - `Content-Type: application/json`

- Body:

```json
{
  "approved": true | false,
  "feedback": "optional string"
}
```

### 5.6.3 Response

- Status codes:
  1. `200 OK` – feedback accepted.
  2. `404 Not Found` – repository or workflow not found.
  3. `500 Internal Server Error`.

- Response body (`200 OK`):

```json
{
  "message": "Feedback submitted"
}
```

### 5.6.4 Behavior

1. Fetch `RepositoryModel` by owner/repo.
2. Fetch `WorkflowStateModel` by repoId and `issueId`.
3. Build [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) with:
   - `config` from repo.
   - `initialState` from `wfDoc`.
4. Subscribe to persist updates as in `/start`.
5. Call [workflow.submitHumanFeedback(approved, feedback)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:336:2-363:3):
   - On approval:
     - `status` moves to `CREATING_PR` and PR is created.
   - On rejection:
     - `status` set to `FAILED`.
     - `error` set to include feedback.
6. Errors are logged and returned as `500`.

---

# 6. Frontend Structure

## 6.1 Directory and component hierarchy

- Root:
  - [index.html](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.html:0:0-0:0) – HTML shell, Tailwind CDN, importmap, root div.
  - [index.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.tsx:0:0-0:0) – ReactDOM root, renders `<App />`.
  - [App.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/App.tsx:0:0-0:0) – sets up `<BrowserRouter>` and routes.

- [pages/](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages:0:0-0:0)
  1. [Dashboard.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/Dashboard.tsx:0:0-0:0)
  2. [IssueList.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/IssueList.tsx:0:0-0:0)
  3. [WorkflowDetail.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:0:0-0:0)

- [components/](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components:0:0-0:0)
  1. [Layout.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:0:0-0:0)
  2. [IssueSidebar.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/IssueSidebar.tsx:0:0-0:0)
  3. [WorkflowGraph.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/WorkflowGraph.tsx:0:0-0:0)
  4. [CodePreview.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/CodePreview.tsx:0:0-0:0)
  5. [ReviewPanel.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/ReviewPanel.tsx:0:0-0:0)
  6. [Terminal.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Terminal.tsx:0:0-0:0)

- [client/api.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:0:0-0:0) – HTTP client for backend APIs.

- Shared:
  - [types.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:0:0-0:0) – used by frontend components ([GithubIssue](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:15:0-28:1), [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1)).
  - [constants.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/constants.ts:0:0-0:0) – mock issues and files (currently not used in pages directly).

## 6.2 State management strategy

1. **Local component state via React hooks**
   - No global store (Redux, Zustand) used.
   - `useState`, `useEffect` for:
     - Dashboard (repos list).
     - IssueList (issues list).
     - WorkflowDetail (issue & workflow state).
     - Layout (settings modal and form data).
     - Terminal (scroll anchor).

2. **Props drilling**
   - [Layout](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:9:0-119:2) wraps pages; passes `children`.
   - [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2) passes `state` into [WorkflowGraph](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/WorkflowGraph.tsx:37:0-122:2), [CodePreview](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/CodePreview.tsx:9:0-141:2), [Terminal](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Terminal.tsx:8:0-35:2), and [ReviewPanel](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/ReviewPanel.tsx:9:0-104:2).

3. **Polling in WorkflowDetail**
   - Every 2 seconds, `GET /api/workflow/:owner/:repo/:issueId`.
   - Updates `state` and, optionally, `issue`.

## 6.3 Routing and navigation

- [App.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/App.tsx:0:0-0:0) routes:

1. `/`:
   - Redirects to `/dashboard` via `<Navigate to="/dashboard" replace />`.

2. `/dashboard`:
   - Renders `<Dashboard>`.

3. `/:owner/:repo/issues`:
   - Renders `<IssueList>`.

4. `/:owner/:repo/workflow/:issueId`:
   - Renders `<WorkflowDetail>`.
   - Navigation from [IssueList](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/IssueList.tsx:7:0-109:2) passes `issue` as `location.state`.

- Navigation flow:
  1. User lands at `/dashboard`.
  2. Chooses a repo card → goes to `/:owner/:repo/issues`.
  3. Chooses an issue → goes to `/:owner/:repo/workflow/:issueId`.

## 6.4 UI ↔ API interaction patterns

1. **API client ([client/api.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:0:0-0:0))**
   - Uses browser `fetch`.
   - No error handling beyond `res.json()` and 404 for [getWorkflowState](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:22:2-26:3).

2. **Dashboard**
   - Calls [api.getRepos()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:3:2-6:3) on mount and after repo connection.
   - Displays `repo.stats.active` and `repo.stats.failed`.

3. **IssueList**
   - On mount and when `owner`/`repo` change:
     - [api.getIssues(owner, repo)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:17:2-20:3).

4. **WorkflowDetail**
   - [fetchState()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:24:4-38:6):
     - [api.getWorkflowState(owner, repo, issueId)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:22:2-26:3).
     - If 404:
       - Sets `notFound = true` (no workflow started).
   - [handleStart()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:46:2-51:4):
     - Requires `issue` to be non‑null:
       - Calls [api.startWorkflow(owner, repo, issueId, issue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:28:2-35:3).
   - [handleFeedback()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:53:2-57:4):
     - Calls [api.submitFeedback(...)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:37:2-44:3).

5. **Repository connection**
   - [Layout](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:9:0-119:2) maintains `tempConfig` for token, owner, repo.
   - On “Connect”:
     - [api.connectRepo(...)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:8:2-15:3).
     - Closes modal and reloads window.

---

# 7. Interaction & Logic Flows

## 7.1 Connect a repository (UI)

**Sequence (textual diagram):**

1. **User** opens `/dashboard`.
2. Clicks **“Connect Repository”** card.
3. [Dashboard](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/Dashboard.tsx:6:0-70:2) dispatches `new CustomEvent('open-settings')`.
4. [Layout](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:9:0-119:2):
   - Listens for `'open-settings'`.
   - Sets `showSettings = true` and shows modal.
5. User fills:
   - GitHub PAT.
   - `owner`.
   - `repo`.
6. Clicks **Connect**:
   - [Layout.handleSave](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:19:2-25:4):
     - Validates that all three fields are non‑empty.
     - Calls [api.connectRepo(owner, repo, token)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:8:2-15:3):
       - `POST /api/repos`.
     - On success:
       - Closes modal.
       - `window.location.reload()` to re‑fetch repos.
7. Dashboard shows new repo card.

## 7.2 Load issues and start workflow

1. From Dashboard, user clicks repo card:
   - Navigates to `/:owner/:repo/issues`.

2. [IssueList](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/IssueList.tsx:7:0-109:2):
   1. `useParams` extracts `owner` and `repo`.
   2. `useEffect` calls [api.getIssues(owner, repo)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:17:2-20:3):
      - Backend makes GitHub API call, merges workflow status.
   3. Issue rows show:
      - Title.
      - Number.
      - Labels.
      - `workflowStatus` badge.

3. User clicks **“Start Agent”** or “View Workflow”:
   - Link: `to={`/${owner}/${repo}/workflow/${issue.id}`}` with `state={{issue}}`.

4. [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2):
   - Extracts `owner`, `repo`, `issueId`.
   - Initializes `issue` state from `location.state.issue`.

5. [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2) header:
   - If there is no `state` and `notFound` is `true`:
     - Shows “Start Workflow” button.
   - On click:
     - Calls [api.startWorkflow(owner, repo, issueId, issue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:28:2-35:3).
     - Backend:
       - Creates/updates `WorkflowStateModel`.
       - Instantiates [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1).
       - Starts graph asynchronously.

6. Polling:
   - [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2) `useEffect`:
     1. Immediately calls [fetchState()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:24:4-38:6).
     2. Sets interval every 2000ms:
        - If workflow exists:
          - `state` updated with current workflow state.
          - `issue` updated from `state.issue` if missing.
        - If workflow not found:
          - `notFound = true`.

## 7.3 Workflow graph execution (non‑headless, via backend)

1. When [workflow.start(issue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3) is called:
   1. State:
      - `status = RESEARCH_DECISION`.
      - Logs: `[Starting Iterative Research for #<number>...]`.
   2. [CompiledGraph.invoke](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:54:2-124:3) enters loop:
      - `currentNode = RESEARCH_DECISION`.

2. **First RESEARCH_DECISION**
   1. [researchDecisionNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:7:0-72:2):
      - Initializes `researchHistory` with system prompt.
      - Calls [getResearchStep(history)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:54:0-70:2):
        - Gemini decides whether to call a tool function.
      - Appends model response to `researchHistory`.
      - Logs `[Agent] ...` message.

3. [checkResearchStatus](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:241:4-256:6):
   - Looks at last message:
     - If it contains tool call: transitions to `RESEARCH_TOOL`.
     - If it contains `finishResearch`: transitions to `PLANNING`.

4. **RESEARCH_TOOL**
   1. Extracts tool calls; for example:
      - `listFiles({ path: "." })`.
   2. Executes through [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1).
   3. Logs tool execution.
   4. Appends tool `functionResponse` to history.
   5. Increments `researchLoopCount`.

5. Back to **RESEARCH_DECISION**:
   - Gemini sees new context (tool results).
   - May:
     - Call more tools, or
     - Call `finishResearch`.

6. When `finishResearch` or loop limit reached:
   - Transition to `PLANNING`.

7. **PLANNING**
   - [planNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:139:0-157:2):
     - Uses [analyzeAndPlan](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:74:0-118:2) to generate:
       - `analysis string`.
       - `steps string[]`.
     - Logs plan summary.

8. Transition to **GENERATING_FIX**
   - [generateFixNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:159:0-178:2):
     - For each `relevantFiles` entry with content:
       - Calls [generateFileFix](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:120:0-167:2).
       - Builds `patches`.
     - Logs `Generated N patches. Waiting for review.`.

9. Transition to **AWAITING_HUMAN**
   - Node sets log `[System] Paused for Review.`.
   - `interruptBefore` includes `AWAITING_HUMAN`.
   - In non‑headless mode:
     - Graph returns, leaving `status = AWAITING_HUMAN`.

10. Human review in UI:
    - [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2):
      - [CodePreview](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/CodePreview.tsx:9:0-141:2) shows diffs.
      - [ReviewPanel](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/ReviewPanel.tsx:9:0-104:2) lists files and collects feedback.
    - On **Approve**:
      - `/feedback` endpoint triggers [submitHumanFeedback(true)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:336:2-363:3).
      - Workflow moves into PR creation node via short graph.
    - On **Request Changes**:
      - `/feedback` with `approved = false`:
        - State becomes `FAILED`.
        - `error = "Feedback: ..."`.

11. **CREATING_PR**
    - [createPrNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:180:0-203:2) uses [GitHubService.createPR](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:115:2-196:3).
    - On success:
      - `status` eventually becomes `'COMPLETED'` in [CompiledGraph.invoke](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:54:2-124:3).
      - `prUrl` set.
    - On failure:
      - Graph error triggers error handling; `status = 'FAILED'`.

## 7.4 Workflow execution (headless, via GitHub Action)

1. GitHub issue event:
   - `issues` event with type `opened` or `reopened`.

2. GitHub Actions:
   1. `Issue Resolution Agent` workflow runs:
      - `npm ci`.
      - `npx tsx action/main.ts`.

3. [action/main.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/action/main.ts:0:0-0:0):
   1. Reads:
      - `GITHUB_TOKEN`.
      - `API_KEY` (Gemini).
      - `GITHUB_REPOSITORY` (`owner/repo`).
      - `GITHUB_EVENT_PATH` (JSON).
   2. Validates env; exits non‑zero if missing.
   3. Reads and parses event JSON.
   4. Extracts `issue`.
   5. Maps to [GithubIssue](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:15:0-28:1).
   6. Creates [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1) with `headless = true`.
   7. Calls [workflow.start(mappedIssue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3).
   8. Allows full graph to run:
      - Because `headless` is true:
        - Graph automatically transitions from `AWAITING_HUMAN` to `CREATING_PR` via additional edge.
      - No DB persistence or UI; all updates remain in memory and logs.

## 7.5 Edge cases and exception paths

1. **Repository not connected**
   - `GET /api/repos/:owner/:repo/issues`:
     - Returns 404 with `{ error: "Repository not found" }`.
   - UI should show no issues and rely on dashboards to connect repo.

2. **Workflow not started**
   - `GET /api/workflow/:owner/:repo/:issueId`:
     - Returns 404 with `{ error: "Workflow not started" }`.
   - [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2):
     - Sets `notFound = true`.
     - Shows “Start Workflow” button.

3. **Gemini quota exceeded**
   - Manifested as 429 with `"RESOURCE_EXHAUSTED"`:
     - Engine maps to user‑friendly message:
       - `"Gemini quota exceeded. Please check your plan/billing or wait for the daily quota reset, then restart the workflow."`
     - Status `FAILED`.
   - UI:
     - [WorkflowGraph](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/WorkflowGraph.tsx:37:0-122:2) shows red “error” node.
     - [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2) header shows error message below status.
     - [ReviewPanel](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/ReviewPanel.tsx:9:0-104:2) shows “Workflow Failed” with error.

4. **Git

Below is a **complete but condensed** technical reference for this project, structured exactly as requested. It is optimized to fit within environment limits while still being explicit enough for humans and agents to re‑implement the system.

---

# 1. Project Overview

## 1.1 Problem statement

GitHub maintainers have many open issues and limited time. Manually:

1. Reading an issue and understanding context.
2. Locating relevant code.
3. Designing and implementing a minimal fix.
4. Creating a PR that references the issue.

…is slow and repetitive.

This system automates that pipeline using Gemini and GitHub, while still allowing humans to supervise critical steps.

## 1.2 System goals

1. Discover and analyze GitHub issues for configured repositories.
2. Use Gemini to:
   - Explore repo structure (via GitHub APIs).
   - Build a plan.
   - Propose code edits as patches.
3. Optionally let humans review/approve patches before creating a PR.
4. Persist workflow state for observability.
5. Support both:
   - A **dashboard UI**.
   - A **GitHub Action** that runs when issues are opened.

## 1.3 Functional and non‑functional requirements

### Functional

1. **Repository management**
   - Connect GitHub repos with PATs.
   - List connected repos with active/failed workflow counts.

2. **Issue handling**
   - Fetch open issues from GitHub.
   - Track per‑issue workflow status.

3. **Workflow automation**
   - Start an “issue resolution” workflow for a specific issue.
   - Perform iterative research, planning, patch generation, and PR creation.
   - Allow human review step with approve/reject + feedback.
   - In headless mode, run to completion and create PRs automatically.

4. **Persistence & introspection**
   - Store repository and workflow state in MongoDB.
   - UI can poll for live workflow state (status, plan, logs, patches, PR URL, errors).

5. **GitHub Action integration**
   - Run the same workflow when issues are opened/reopened in the hosting repo.

### Non‑functional

1. **Reliability** – On failures (Gemini, GitHub, DB), store `FAILED` status and human‑readable `error`.
2. **Security (baseline)** – PATs stored server‑side; CORS open by default (dev); can be hardened.
3. **Performance** – Research loop bounded by `researchLoopCount <= 15`; UI polls every 2s.
4. **Maintainability** – Clear separation between UI, API, workflow engine, and adapters.
5. **Extensibility** – Workflow graph makes it straightforward to add new states or tools.

---

# 2. System Architecture

## 2.1 High‑level architecture

Textual diagram:

1. **Frontend (React / Vite)**
   - [index.html](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.html:0:0-0:0) → [index.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.tsx:0:0-0:0) → [App.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/App.tsx:0:0-0:0) → pages/components.
   - Talks to backend at `http://localhost:4000/api`.

2. **Backend (Express + Mongo + Octokit + Gemini)**
   - [server/server.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/server.ts:0:0-0:0) – HTTP API and workflow orchestration.
   - [server/models.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/models.ts:0:0-0:0) – `Repository` and [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1) schemas.
   - [services/workflow.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:0:0-0:0) – state machine over [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1).
   - [services/engine.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:0:0-0:0) – simplified LangGraph engine.
   - [services/github.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:0:0-0:0) – GitHub adapter.
   - [services/gemini.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:0:0-0:0) – Gemini adapter.

3. **Database**
   - MongoDB (“issueres” or as per `MONGODB_URI`).

4. **GitHub Action**
   - [.github/workflows/issue-resolution.yml](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/.github/workflows/issue-resolution.yml:0:0-0:0) → [action/main.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/action/main.ts:0:0-0:0).

5. **External services**
   - GitHub REST APIs.
   - Gemini APIs.

## 2.2 Components and responsibilities

- **Frontend**
  - [Dashboard](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/Dashboard.tsx:6:0-70:2) – list repos.
  - [IssueList](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/IssueList.tsx:7:0-109:2) – list issues per repo.
  - [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2) – show and control a workflow.
  - Reusable layout and visualization components.

- **Backend**
  - REST API for repos, issues, workflows.
  - Owns Mongo connection.
  - Owns workflow lifecycle and persistence.

- **Workflow engine**
  - Encodes “research → plan → patches → review → PR” as a graph over [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1).

- **Adapters**
  - [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1) – hides Octokit details.
  - Gemini helpers – hide raw Gemini API calls and schemas.

## 2.3 Data and control flow (typical UI run)

1. User connects a repo (via `POST /api/repos` from UI).
2. Dashboard polls `GET /api/repos`.
3. User chooses a repo → IssueList calls `GET /api/repos/:owner/:repo/issues`.
4. From an issue row, user navigates to WorkflowDetail.
5. WorkflowDetail:
   - Polls `GET /api/workflow/:owner/:repo/:issueId`.
   - If none, user clicks “Start Workflow”.
   - `POST /api/workflow/:.../:issueId/start` kicks off [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1).
6. Backend workflow:
   - Interacts with Gemini (research, planning, fixes).
   - Interacts with GitHub (file listing, reading, searching, PR creation).
   - Emits state snapshots that the backend saves to Mongo.
7. UI polls workflow state to show:
   - Status graph.
   - Plan.
   - Logs and patches.
8. If status `AWAITING_HUMAN`:
   - User approves or rejects via `/feedback`.

## 2.4 External dependencies

- **GitHub**
  - Access token: PAT from repo connection, or `GITHUB_TOKEN` in GitHub Action.
- **Gemini**
  - API key from `API_KEY` or `GEMINI_API_KEY`.
- **Mongo**
  - Local or hosted instance.
- **Vite / React / Tailwind CDN / lucide-react / diff** – UI runtime stack.

---

# 3. Design Decisions

## 3.1 Patterns

1. **SPA + REST backend** for clear separation.
2. **State machine** ([StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1)) to encode workflow stages as explicit states.
3. **Headless / interactive mode flag** to reuse workflow in GitHub Actions and UI.
4. **Repository‑scoped workflows** – all workflows are tied to a stored `Repository` doc.

## 3.2 Trade‑offs

- **Polling vs push** – polling is simpler, acceptable for low‑frequency updates.
- **Plain PAT storage** – quick to build, insecure for production without further hardening.
- **Single LLM provider** – simplifies logic but adds strong coupling and quota risk.
- **Tailwind via CDN** – quick dev; not best for production.

## 3.3 Scalability / security

- Primary bottlenecks: Gemini quotas and GitHub API limits.
- Security hardening directions:
  - Add auth in front of Express.
  - Restrict CORS.
  - Encrypt PATs in DB.
  - Limit PAT scope.

---

# 4. Backend Structure

## 4.1 Layout

- [server/server.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/server.ts:0:0-0:0)
- [server/models.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/models.ts:0:0-0:0)
- [services/engine.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:0:0-0:0)
- [services/workflow.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:0:0-0:0)
- [services/github.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:0:0-0:0)
- [services/gemini.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:0:0-0:0)
- [action/main.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/action/main.ts:0:0-0:0)
- [types.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:0:0-0:0)

## 4.2 Core domain logic

- [IssueResolutionWorkflow](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:207:0-364:1):
  - Wraps:
    - [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1).
    - [StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1).
  - Maintains [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1).
  - Exposes:
    - [start(issue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3).
    - [resume()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:330:2-334:3).
    - [submitHumanFeedback(approved, feedback?)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:336:2-363:3).
    - [subscribe(listener)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:288:2-294:3).

- Node responsibilities:
  1. **RESEARCH_DECISION** – Gemini decides next tool or to finish research.
  2. **RESEARCH_TOOL** – Executes tool calls via [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1), enriches `relevantFiles`.
  3. **PLANNING** – Gemini produces `{analysis, steps[]}` based on issue + files.
  4. **GENERATING_FIX** – Gemini generates new file content & explanations for each file.
  5. **AWAITING_HUMAN** – Pause point in interactive mode.
  6. **CREATING_PR** – Uses [GitHubService.createPR](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:115:2-196:3) to open a PR.

- [StateGraph](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:12:0-43:1):
  - One reducer merges partial updates.
  - Edges encoded with either fixed next state or conditional function.

## 4.3 DB schema

- `Repository`:
  - `owner`, `repo`, `token`.
  - Unique `{owner, repo}` index.

- [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1):
  - Keys: `issueId`, `repoId`.
  - Fields: `status`, `logs`, full `issue` object, `relevantFiles`, `patches`, `plan`, `prUrl`, `error`, `researchHistory`, `researchLoopCount`, `repoOwner`, `repoName`, `updatedAt`.

## 4.4 AuthZ & AuthN

- No end‑user auth in backend.
- Authorization to GitHub via:
  - PAT (per repo) in `Repository.token`.
  - `GITHUB_TOKEN` in Actions.

## 4.5 Error handling and logging

- Express routes: try/catch, return `{ error: e.message }` with 500.
- Engine:
  - Any node error → `status = 'FAILED'`, `error` set.
  - Gemini quota errors normalized to a specific user‑friendly message.
- GitHub adapter: logs and safe fallbacks for file ops.
- Console logs for internal debugging; logs array for UI display.

---

# 5. API Specification

Base: `http://localhost:4000/api`

## 5.1 `GET /repos`

- Returns all repositories with `stats.active` and `stats.failed`.
- 200 → `[{ _id, owner, repo, token, stats: { active, failed } }]`.
- 500 → `{ error: string }`.

## 5.2 `POST /repos`

- Body: `{ owner: string, repo: string, token: string }`.
- Upserts repository (updates token if exists).
- 200 → repository document.
- 500 on DB errors.

## 5.3 `GET /repos/:owner/:repo/issues`

- Path params: `owner`, `repo`.
- Looks up repository, then calls GitHub.
- Response 200: array of:

```json
{
  "id": 3875734337,
  "number": 8,
  "title": "Subtraction is failing",
  "body": "",
  "state": "open",
  "user": { "login": "...", "avatar_url": "..." },
  "created_at": "...",
  "labels": [{ "name": "bug", "color": "d73a4a" }],
  "html_url": "...",
  "workflowStatus": "FAILED" // or null
}
```

- 404 if repo doc not found.
- 500 on internal or GitHub issues.

## 5.4 `GET /workflow/:owner/:repo/:issueId`

- `issueId` is **GitHub issue ID**, not simple number.
- 200 → full [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1) document, or
- 404 if repo or workflow missing.
- 500 on internal error.

## 5.5 `POST /workflow/:owner/:repo/:issueId/start`

- Body: `{ issue: GithubIssue }` (full object).
- Behavior:
  - Creates or resets workflow doc.
  - Starts workflow asynchronously.
- 200:

```json
{
  "message": "Workflow started",
  "workflowId": "<workflow-doc-id>"
}
```

- 404: repo missing.
- 500: DB or runtime error.

## 5.6 `POST /workflow/:owner/:repo/:issueId/feedback`

- Body: `{ approved: boolean, feedback?: string }`.
- If `approved: true`:
  - Engine creates PR and completes.
- If `approved: false`:
  - Marks workflow `FAILED` with user feedback.
- 200: `{ message: "Feedback submitted" }`.
- 404: repo or workflow missing.
- 500: error invoking workflow/PR step.

---

# 6. Frontend Structure

## 6.1 Component hierarchy

1. [index.html](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.html:0:0-0:0) – Tailwind CDN, importmap, root `div#root`.
2. [index.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/index.tsx:0:0-0:0) – ReactDOM root.
3. [App.tsx](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/App.tsx:0:0-0:0) – router:
   - `/` → redirect to `/dashboard`.
   - `/dashboard` → [Dashboard](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/Dashboard.tsx:6:0-70:2).
   - `/:owner/:repo/issues` → [IssueList](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/IssueList.tsx:7:0-109:2).
   - `/:owner/:repo/workflow/:issueId` → [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2).
4. Pages:
   - [Dashboard](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/Dashboard.tsx:6:0-70:2) → uses [Layout](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:9:0-119:2).
   - [IssueList](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/IssueList.tsx:7:0-109:2) → uses [Layout](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:9:0-119:2).
   - [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2) → uses [Layout](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:9:0-119:2), [WorkflowGraph](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/WorkflowGraph.tsx:37:0-122:2), [CodePreview](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/CodePreview.tsx:9:0-141:2), [Terminal](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Terminal.tsx:8:0-35:2), [ReviewPanel](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/ReviewPanel.tsx:9:0-104:2).
5. Components:
   - [Layout](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:9:0-119:2) – global header, repo connect modal.
   - [IssueSidebar](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/IssueSidebar.tsx:11:0-59:2) – alternative issue view (currently used only in some flows).
   - [WorkflowGraph](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/WorkflowGraph.tsx:37:0-122:2) – state diagram.
   - [CodePreview](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/CodePreview.tsx:9:0-141:2) – diff viewer with explanation.
   - [ReviewPanel](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/ReviewPanel.tsx:9:0-104:2) – human approval widget.
   - [Terminal](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Terminal.tsx:8:0-35:2) – log console.

## 6.2 State management

- Pure hooks:
  - `useState`, `useEffect`.
- No global store library.
- Polling for workflow state in [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2).

## 6.3 Routing & navigation

- Use `react-router-dom` v6.
- `Link` components between dashboard → issue list → workflow detail.
- `location.state` carries `issue` from [IssueList](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/IssueList.tsx:7:0-109:2) to [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2) to avoid redundant fetches initially.

## 6.4 UI ↔ API patterns

- All HTTP through [client/api.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:0:0-0:0):
  - Methods:
    - [getRepos()](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:3:2-6:3).
    - [connectRepo(owner, repo, token)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:8:2-15:3).
    - [getIssues(owner, repo)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:17:2-20:3).
    - [getWorkflowState(owner, repo, issueId)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:22:2-26:3).
    - [startWorkflow(owner, repo, issueId, issue)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:28:2-35:3).
    - [submitFeedback(owner, repo, issueId, approved, feedback?)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:37:2-44:3).
- Simple “fail fast” approach:
  - No per‑call try/catch; errors bubble to dev console.

---

# 7. Interaction & Logic Flows

## 7.1 Core flows (summarized)

1. **Connect repo**
   1. User clicks “Connect Repository”.
   2. [Layout](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/Layout.tsx:9:0-119:2) modal collects PAT, owner, repo.
   3. [api.connectRepo(...)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:8:2-15:3) → `POST /api/repos`.
   4. Page reloads; Dashboard shows repo.

2. **Start workflow for issue (UI)**
   1. User navigates to `/:owner/:repo/issues`.
   2. Clicks an issue row → [WorkflowDetail](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/pages/WorkflowDetail.tsx:11:0-188:2).
   3. WorkflowDetail polls state:
      - If missing, shows “Start Workflow”.
   4. On click:
      - [startWorkflow](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:28:2-35:3) posts full issue to backend.
      - Backend creates/updates workflow and starts graph.

3. **Human review**
   1. When state reaches `AWAITING_HUMAN`:
      - [ReviewPanel](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/ReviewPanel.tsx:9:0-104:2) shows patch files and feedback textarea.
   2. User approves:
      - [submitFeedback(true)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:37:2-44:3).
      - Backend runs PR step.
   3. User requests changes:
      - [submitFeedback(false, feedback)](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:37:2-44:3).
      - Backend marks workflow `FAILED` with feedback.

4. **Headless Action run**
   1. Issue opened on repo.
   2. GitHub Action receives event and runs [action/main.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/action/main.ts:0:0-0:0).
   3. [main.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/action/main.ts:0:0-0:0) maps payload to [GithubIssue](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:15:0-28:1) and calls [IssueResolutionWorkflow.start](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:306:2-328:3).
   4. Workflow graph runs in memory, auto‑creating PR after generation.

## 7.2 Failure/edge flows

- Missing repo → 404 on issues/workflows.
- Mongo down → Express 500.
- GitHub permission failures in PR step → error mapped to “Permission Denied: Check GitHub Token scopes.”.
- Gemini quota → normalized error, workflow `FAILED` with clear message.

---

# 8. Deployment & Operations

## 8.1 Environment configuration

Key env vars:

- `GEMINI_API_KEY` or `API_KEY` – Gemini auth.
- `MONGODB_URI` – Mongo connection; defaults to `mongodb://localhost:27017/issueres`.
- `PORT` – backend port (defaults to 4000).

`.env.local` (for Vite) should contain:

```env
GEMINI_API_KEY=your_key_here
```

## 8.2 Build and deployment pipeline

- **Local dev**
  1. `npm install`.
  2. `npm run server` – backend on 4000.
  3. `npm run dev` – frontend on 3000.

- **GitHub Action**
  - [.github/workflows/issue-resolution.yml](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/.github/workflows/issue-resolution.yml:0:0-0:0):
    1. `actions/checkout`.
    2. Node setup.
    3. `npm ci`.
    4. `npx tsx action/main.ts`.

## 8.3 Runtime configuration & secrets

- Local:
  - `.env.local` for Gemini key.
- GitHub:
  - Repository secret `GEMINI_API_KEY`.
  - `GITHUB_TOKEN` auto‑provided.

## 8.4 Monitoring & observability

- Logs:
  - Browser console.
  - Node console logs (workflow traces, errors).
- State:
  - [WorkflowState](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:48:0-63:1) docs in Mongo for historical inspection.
- Additional observability (not implemented but straightforward):
  - Structured logs to external service.
  - Healthcheck endpoint.

---

# 9. Extension Guidelines

## 9.1 Adding new features

1. **New workflow steps**
   1. Add enum value to `WorkflowStatus`.
   2. Implement node function in [services/workflow.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:0:0-0:0).
   3. Wire with [.addNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:20:2-23:3) and [.addEdge](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/engine.ts:25:2-28:3) in [buildGraph](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:234:2-286:3).
   4. Update [WorkflowGraph](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/components/WorkflowGraph.tsx:37:0-122:2) visualization if you want it displayed.

2. **New tools**
   1. Extend `researchTools` in [gemini.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/gemini.ts:0:0-0:0).
   2. Update [researchToolNode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/workflow.ts:74:0-137:2) to execute new tool calls.
   3. Optionally, extend [GitHubService](cci:2://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:3:0-197:1) or add a new adapter.

3. **New endpoints**
   1. Add Express route in [server/server.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/server/server.ts:0:0-0:0).
   2. Expose in [client/api.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:0:0-0:0).
   3. Use from UI components.

## 9.2 Contracts that must not be broken

1. **WorkflowState shape**
   - Backend, Action, and UI assume the fields in [types.ts](cci:7://file:///c:/Users/roshi/Downloads/issueres%20%288%29/types.ts:0:0-0:0) and `WorkflowStateModel` match.
2. **GitHubService contract**
   - [getIssues](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/client/api.ts:17:2-20:3), [listDirectory](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:83:2-99:3), [getFileContent](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:63:2-79:3), [searchCode](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:101:2-113:3), [createPR](cci:1://file:///c:/Users/roshi/Downloads/issueres%20%288%29/services/github.ts:115:2-196:3) semantics must remain consistent.
3. **Status semantics**
   - UI logic expects:
     - `AWAITING_HUMAN` → show ReviewPanel.
     - `COMPLETED` → show PR details.
     - `FAILED` + `error` → display error message.

## 9.3 Common pitfalls

1. **Using issue number vs ID**
   - `WorkflowState.issueId` stores GitHub **issue `id`** (global ID), not `number`.
2. **Gemini quota**
   - Frequent runs will hit free‑tier limits; handle `FAILED` state gracefully and communicate to users.
3. **PAT scopes**
   - Insufficient scopes cause PR creation to fail.
4. **CORS & security**
   - For production, restrict CORS and add authentication in front of the API.
5. **Tailwind CDN**
   - For serious production deployment, switch to a local Tailwind build pipeline.

This documentation should give both humans and agents enough information to understand, extend, and re‑implement the system.