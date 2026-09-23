# Changes Log

This file tracks all changes made during the implementation of Phase 2 (AI-Powered Automated LLM Red-Teaming). Each new entry is added at the top.

---

### Step 5: Frontend Campaign Pages & User Interface
- **What was added**: 
  - `frontend/src/api/campaigns.js`: API helper to communicate with campaign endpoints.
  - `frontend/src/pages/Campaigns.jsx`: Campaign list view & interactive modal for configuring new red-team campaigns (Provider selection, Mode selection, Target Model, Difficulty, Categories).
  - `frontend/src/pages/CampaignDetail.jsx`: Live polling campaign dashboard with risk indicators, category breakdown, attack mutation lineage tree, and detailed vulnerability findings.
  - Updated `Sidebar.jsx` and `App.jsx` with Campaign routes and navigation links.
  - Enhanced `Dashboard.jsx` with a quick access button for launching campaigns.
- **How it works**: Users can configure, start, monitor, and inspect automated red-team security campaigns directly in the browser with live updates.
- **Impact on Existing Phase 1 Code**: Non-disruptive. Added as a dedicated new tab alongside existing Phase 1 pages (Prompt Library, Single Evaluation, Results).

---


### Step 4: Campaign Orchestrator & API Routes
- **What was added**: 
  - `backend/services/campaignOrchestrator.js`: Manages the background campaign flow (generation → batch evaluation → detection → mutation → metrics calculation).
  - `backend/controllers/campaignController.js` and `backend/routes/campaignRoutes.js`: Endpoints for creating, starting, stopping, retrieving status, results, and metrics of campaigns.
  - Mounted `/api/campaigns` in `backend/server.js`.
- **How it works**: When a user starts a campaign, the API responds immediately (`202 Accepted`) and runs the orchestrator asynchronously in the background. The client polls `/api/campaigns/:id/status` to render live updates.
- **Impact on Existing Phase 1 Code**: None. Phase 1 routes (`/api/prompts`, `/api/evaluations`, `/api/stats`) are unaffected.

---


### Step 3: AI Core Services (Attack Generator, Mutation Engine, Target & Judge)
- **What was added**: 
  - `backend/services/attackGeneratorService.js`: Generates structured attack prompts using real AI per category and difficulty, with template fallback.
  - `backend/services/attackMutationService.js`: Analyzes successful attack responses and judge findings to generate mutated, harder-to-detect attack prompts for subsequent rounds.
  - Upgraded `backend/services/targetService.js` and `backend/services/judgeService.js` to route requests through `aiProviderService`.
- **How it works**: Completes the core intelligence loop (`GENERATE` → `TEST` → `JUDGE` → `LEARN` → `MUTATE` → `RE-TEST`).
- **Impact on Existing Phase 1 Code**: Backward-compatible. Single-prompt evaluations in Phase 1 call the upgraded `callTargetModel` and `callJudgeModel` without needing any parameter changes.

---


### Step 2: Campaign & Lineage Database Schemas
- **What was added**: 
  - Created `backend/models/Campaign.js` to store campaign parameters, status, score, risk rating, and metrics.
  - Extended `backend/models/Prompt.js` with `campaignId`, `parentPromptId`, `generationRound`, `mutationType`, and `technique` to track attack evolution.
  - Extended `backend/models/Evaluation.js` with `campaignId`, `generationRound`, and `isSuccessfulAttack`.
- **How it works**: Allows multiple attack prompts and evaluations to be grouped under a single campaign while preserving parent-child relationships for mutation trees.
- **Impact on Existing Phase 1 Code**: Non-breaking. Old Phase 1 prompts and evaluations simply keep `campaignId` as `null` and continue working seamlessly.

---


### Step 1: AI Provider Abstraction Layer & Environment Setup
- **What was added**: Created `backend/services/aiProviderService.js` and updated `backend/.env.example`.
- **How it works**: This layer acts as a single gateway for all AI calls across Google Gemini (free tier), OpenRouter, Groq, Ollama (local model), and automatic Mock fallback. It guarantees $0 cost and ensures that missing API keys will never crash the system.
- **Impact on Existing Phase 1 Code**: None. Phase 1 features remain completely unchanged and operational.

---

