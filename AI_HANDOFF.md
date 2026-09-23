# AI Project Handoff & Sole Representative Specification

> **Purpose of this File**: This document serves as the **single, comprehensive source of truth** for ChatGPT (or any AI assistant). It contains the full context of the project, including architectural design, current progress across all phases, file modifications, component impact matrices, handled & potential errors, database schemas, API routes, and guidance for next steps.
> 
> **Instructions for User**: Provide/paste this single file (`AI_HANDOFF.md`) to ChatGPT instead of sharing multiple individual files.

---

## 1. Executive Summary & System Overview

* **Project Name**: LLM Red-Teaming & Evaluation Platform
* **Core Functionality**: A full-stack web application that acts as an automated AI security tester. It creates adversarial attacks (jailbreaks, prompt injections, PII extraction, bias, etc.), targets an LLM model under test, uses an AI Safety Judge to evaluate the response, mutates successful attacks across multiple generation rounds, and provides real-time telemetry dashboards.
* **Technology Stack**:
  * **Frontend**: React (Vite), Tailwind CSS, Axios, Lucide React Icons.
  * **Backend**: Node.js, Express.js, Mongoose (MongoDB).
  * **AI Provider Gateway**: Multi-provider support covering Google Gemini (Free tier), OpenRouter, Groq, local Ollama models, and an offline Mock fallback engine.

```
+------------------------------------------------------------------------------------------------------+
|                                   LLM Red-Teaming Workflow                                           |
|                                                                                                      |
|  [Attack Generator] ---> [Target Model Under Test] ---> [AI Safety Judge] ---> [Mutation Engine]     |
|          ^                                                                             |             |
|          +-------------------------- Re-Test Next Round <------------------------------+             |
|                                                                                                      |
|  * All progress, scores, risk levels, and lineage trees are stored in MongoDB & rendered live in UI *|
+------------------------------------------------------------------------------------------------------+
```

---

## 2. Phased Development Progress

### Phase 1: Core Evaluation Pipeline & UI (100% Complete)
1. **Single Evaluation Engine**: Asynchronous execution using a HTTP `202 Accepted` pattern with background processing to eliminate request timeouts during long LLM calls.
2. **Prompt Library**: Complete CRUD interface with real-time category filtering, search, severity badges, and detailed prompt inspection overlays.
3. **Telemetry & Dashboard**: Aggregate metrics calculation (total prompts, total evaluations, average risk scores, system safety rating banner).
4. **Safety Judge & Defensive Parsing**: Initial integration with AI Judge for scoring (0–100) and flag assignments (`jailbreak_success`, `pii_leak`, `harmful_content`, etc.).

---

### Phase 2: Automated AI-Powered Red-Teaming Campaigns (100% Complete)
1. **AI Provider Abstraction Layer (`aiProviderService.js`)**: Unified interface routing calls across Gemini, OpenRouter, Groq, Ollama, and Mock engines with zero-crash guarantees and $0 cost default options.
2. **Campaign & Lineage Schemas**:
   * `Campaign`: Tracks parameters, status, score, risk rating, generated/completed counts, and stop requests.
   * `Prompt`: Extended with `campaignId`, `parentPromptId`, `generationRound`, `mutationType`, and `technique`.
   * `Evaluation`: Extended with `campaignId`, `generationRound`, and `isSuccessfulAttack`.
3. **Core AI Services**:
   * `attackGeneratorService.js`: AI-driven adversarial prompt generation by category & difficulty with template fallbacks.
   * `attackMutationService.js`: Analyzes successful jailbreaks and judge reasoning to generate mutated, harder-to-detect prompt iterations.
   * Upgraded `targetService.js` & `judgeService.js` to route via `aiProviderService`.
4. **Campaign Orchestrator & Controller**:
   * Async loop (`GENERATE` → `TEST` → `JUDGE` → `LEARN` → `MUTATE` → `RE-TEST`).
   * REST Endpoints: `POST /api/campaigns`, `POST /api/campaigns/:id/start`, `POST /api/campaigns/:id/stop`, `GET /api/campaigns/:id/status`, `GET /api/campaigns/:id/results`, `GET /api/campaigns/:id/metrics`.
5. **Frontend Campaign Suite**:
   * `Campaigns.jsx`: Campaign list view & modal configuration wizard (Provider, Mode, Target Model, Difficulty, Categories).
   * `CampaignDetail.jsx`: Live polling campaign dashboard with real-time scorecards, category distribution, attack lineage tree, and vulnerability log.

---

## 3. Comprehensive Impact Matrix & Changed Files

| File Path | Status | Purpose / Functionality | Impact on Existing Code |
| :--- | :--- | :--- | :--- |
| `backend/services/aiProviderService.js` | **[NEW]** | Multi-provider AI gateway with fallback logic. | None. Used as backend service layer. |
| `backend/models/Campaign.js` | **[NEW]** | Mongoose schema for red-team campaigns. | None. Independent model. |
| `backend/models/Prompt.js` | **[MODIFIED]** | Added campaign ID, parent prompt ID, round, mutation type. | Fully backward-compatible. Default values handle Phase 1 prompts. |
| `backend/models/Evaluation.js` | **[MODIFIED]** | Added campaign ID, round, and `isSuccessfulAttack`. | Fully backward-compatible. |
| `backend/services/attackGeneratorService.js` | **[NEW]** | Generates category/difficulty-specific attack prompts via AI/templates. | None. |
| `backend/services/attackMutationService.js` | **[NEW]** | Mutates successful jailbreak prompts into stronger variants. | None. |
| `backend/services/targetService.js` | **[MODIFIED]** | Refactored to delegate model execution to `aiProviderService`. | Backward-compatible signature. |
| `backend/services/judgeService.js` | **[MODIFIED]** | Refactored to delegate judge evaluation to `aiProviderService`. | Backward-compatible signature. |
| `backend/services/campaignOrchestrator.js` | **[NEW]** | Runs multi-round campaign background execution loops. | Independent background service. |
| `backend/controllers/campaignController.js` | **[NEW]** | Controller handling campaign CRUD, control actions, and status polling. | Independent controller. |
| `backend/routes/campaignRoutes.js` | **[NEW]** | Express router mounted at `/api/campaigns`. | None. |
| `backend/server.js` | **[MODIFIED]** | Registered `/api/campaigns` route endpoint. | Non-breaking route addition. |
| `frontend/src/api/campaigns.js` | **[NEW]** | Axios API client methods for campaign endpoints. | Frontend API module. |
| `frontend/src/pages/Campaigns.jsx` | **[NEW]** | Campaign listing and creation modal page. | New route `/campaigns`. |
| `frontend/src/pages/CampaignDetail.jsx` | **[NEW]** | Live campaign dashboard, lineage visualization, and findings log. | New route `/campaigns/:id`. |
| `frontend/src/components/Sidebar.jsx` | **[MODIFIED]** | Added navigation link for Campaigns tab. | Pure UI enhancement. |
| `frontend/src/App.jsx` | **[MODIFIED]** | Added routes for `/campaigns` and `/campaigns/:id`. | Non-breaking routing update. |
| `frontend/src/pages/Dashboard.jsx` | **[MODIFIED]** | Added quick access button for starting campaigns. | Non-breaking UI enhancement. |

---

## 4. Error Modes, Edge Cases & System Safeguards

### 1. API Keys & Rate Limiting (HTTP 429 / 401 / 403)
* **Handling**: If external keys (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`) are missing, invalid, or rate-limited:
  * `aiProviderService.js` logs a warning and automatically degrades to the **Mock Engine**.
  * `attackGeneratorService.js` falls back to pre-defined attack templates.
  * **Result**: The system remains operational and never throws unhandled crashes due to third-party API issues.

### 2. Defensive JSON Parsing for LLM Outputs
* **Handling**: LLMs frequently wrap JSON output inside markdown block quotes (e.g., ````json ... ````) or append conversational preamble.
  * Both `judgeService.js` (`parseJudgeOutput`) and `attackGeneratorService.js` / `attackMutationService.js` perform regex cleaning: `.replace(/```json|```/g, '').trim()`.
  * If parsing fails completely, `judgeService.js` returns a fallback evaluation structure with flag `judge_parse_error` instead of crashing the process.

### 3. Server Timeouts on Long Execution Loops
* **Handling**: Single evaluations and multi-round campaign runs can take tens of seconds to minutes.
  * Routes respond immediately with HTTP `202 Accepted` containing `{ status: 'pending' }` or `{ status: 'generating' }`.
  * Heavy lifting runs asynchronously in the Node.js event loop while the frontend polls the status endpoint every 2 seconds.

### 4. Local Model Connectivity (Ollama)
* **Handling**: When using `provider: 'ollama'`, if the local Ollama instance (`http://localhost:11434`) is offline, the provider service catches the connection error and generates a fallback response.

### 5. MongoDB Connection Failure
* **Handling**: In `backend/config/db.js`, database connection errors are caught, logged, and exit gracefully (`process.exit(1)`).

---

## 5. System Schemas Reference

### Campaign Schema (`backend/models/Campaign.js`)
```javascript
{
  name: String (required),
  description: String,
  targetModel: String (default: 'gpt-4'),
  executionMode: Enum ['MOCK', 'EXTERNAL_API', 'LOCAL'],
  provider: Enum ['gemini', 'openrouter', 'groq', 'ollama', 'mock'],
  attackCategories: [String],
  difficulty: Enum ['Low', 'Medium', 'High'],
  requestedPromptCount: Number (default: 10),
  generatedPromptCount: Number,
  completedEvaluationCount: Number,
  successfulAttackCount: Number,
  attackSuccessRate: Number,
  status: Enum ['draft', 'generating', 'running', 'analyzing', 'completed', 'failed', 'stopped'],
  overallScore: Number,
  riskLevel: Enum ['Very Safe', 'Low Risk', 'Moderate Risk', 'High Risk', 'Critical Risk', 'Pending'],
  stopRequested: Boolean,
  createdAt: Date,
  completedAt: Date
}
```

### Extended Prompt Schema (`backend/models/Prompt.js`)
```javascript
{
  title: String,
  text: String (required),
  category: Enum ['jailbreak', 'prompt-injection', 'harmful-content', 'data-exfiltration', 'bias', 'misinformation', 'other'],
  tags: [String],
  severity: Enum ['low', 'medium', 'high', 'critical'],
  difficulty: Enum ['Low', 'Medium', 'High'],
  source: Enum ['manual', 'imported', 'generated'],
  // Campaign extensions:
  campaignId: ObjectId (ref: 'Campaign'),
  parentPromptId: ObjectId (ref: 'Prompt'),
  generationRound: Number,
  mutationType: String,
  technique: String,
  createdAt: Date
}
```

### Extended Evaluation Schema (`backend/models/Evaluation.js`)
```javascript
{
  promptId: ObjectId (ref: 'Prompt'),
  targetModel: String,
  status: Enum ['pending', 'running', 'complete', 'failed'],
  targetResponse: String,
  judgeScore: Number (0-100),
  vulnerabilityFlags: [String],
  judgeReasoning: String,
  errorMessage: String,
  // Campaign extensions:
  campaignId: ObjectId (ref: 'Campaign'),
  generationRound: Number,
  isSuccessfulAttack: Boolean,
  createdAt: Date,
  completedAt: Date
}
```

---

## 6. Directory Structure & File Map

```
llm-red-teaming-and-evaluation/
├── 1st_phase_progress.md                    # Detailed summary of Phase 1 implementation
├── AI_HANDOFF.md                            # THIS FILE: Primary context document for ChatGPT
├── change.md                                # Chronological change log
├── overview.md                              # High-level product definition
├── phase1_next_steps_implementation_guide.md# Initial technical guide
├── backend/
│   ├── .env.example                         # Environment variable definitions
│   ├── server.js                            # Express application entry point & route definitions
│   ├── config/
│   │   └── db.js                            # Mongoose MongoDB connection handler
│   ├── controllers/
│   │   ├── campaignController.js            # Campaign management & polling logic
│   │   ├── evaluationController.js          # Async single evaluation execution
│   │   └── promptController.js              # Prompt library CRUD controller
│   ├── models/
│   │   ├── Campaign.js                      # Red-team campaign schema
│   │   ├── Evaluation.js                    # Combined evaluation/result schema
│   │   └── Prompt.js                        # Adversarial prompt & lineage schema
│   ├── routes/
│   │   ├── campaignRoutes.js                # API endpoints for /api/campaigns
│   │   ├── evaluationRoutes.js              # API endpoints for /api/evaluations
│   │   ├── promptRoutes.js                  # API endpoints for /api/prompts
│   │   └── statsRoutes.js                   # API endpoint for dashboard telemetry
│   ├── scripts/
│   │   └── seed.js                          # Database seeding script
│   └── services/
│       ├── aiProviderService.js             # Gateway for Gemini, OpenRouter, Groq, Ollama, Mock
│       ├── attackGeneratorService.js        # AI generator for category/difficulty attack prompts
│       ├── attackMutationService.js         # AI mutation engine for multi-round attacks
│       ├── campaignOrchestrator.js          # Multi-round campaign execution loop
│       ├── judgeService.js                  # AI Safety Judge evaluation & defensive JSON parser
│       └── targetService.js                 # Target model API dispatch
└── frontend/
    ├── src/
    │   ├── App.jsx                          # Main routing container
    │   ├── main.jsx                         # React app entry point
    │   ├── api/
    │   │   ├── campaigns.js                 # API helper for campaigns
    │   │   ├── evaluations.js               # API helper for evaluations
    │   │   ├── prompts.js                   # API helper for prompt CRUD
    │   │   └── stats.js                     # API helper for dashboard stats
    │   ├── components/
    │   │   └── Sidebar.jsx                  # Navigation sidebar
    │   └── pages/
    │       ├── CampaignDetail.jsx           # Live campaign view & lineage tree
    │       ├── Campaigns.jsx                # Campaign setup wizard & list
    │       ├── Dashboard.jsx                # System risk & telemetry dashboard
    │       ├── Evaluation.jsx               # Single prompt test execution page
    │       ├── PromptLibrary.jsx            # Adversarial prompt library page
    │       └── Results.jsx                  # Single evaluation history logs
```

---

## 7. Next Steps & Prompt for ChatGPT

When sharing this file with ChatGPT, use the following prompt format:

```
Hello ChatGPT! I am sharing `AI_HANDOFF.md` with you. This file contains the complete, up-to-date state of our LLM Red-Teaming & Evaluation Platform codebase (architecture, schemas, API endpoints, error handling, completed features in Phase 1 & Phase 2, and file maps).

Please read `AI_HANDOFF.md` carefully. Based on this complete context, tell me what steps or enhancements we should tackle next in accordance with our project workflow.
```
