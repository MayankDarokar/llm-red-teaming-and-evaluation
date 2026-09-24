# AI HANDOFF — LLM Red-Teaming & Evaluation Agent System

> Phase 2 Final Audit: All identified findings, errors, fixes, validation results, architectural decisions, regression checks, and remaining limitations are documented below.

---

## 1. Project Overview

* **What the system does**: An automated, end-to-end AI Red-Teaming and LLM Safety Evaluation Platform. It orchestrates multi-turn adversarial security campaigns to probe target LLM models against critical AI safety vulnerabilities (jailbreaks, prompt injection, harmful content, data exfiltration, bias, misinformation). It automatically executes prompts against target models, scores responses using an autonomous AI Safety Judge, identifies security bypasses, mutates successful attacks across generation rounds, and visualizes real-time risk telemetry, scorecards, and mutation lineage trees.
* **Why it exists**: Modern LLM deployments require continuous, automated adversarial testing before and during production to detect safety alignment failures, prompt injection vectors, and policy violations at zero infrastructure cost.
* **What it evaluates**:
  1. *Jailbreak Resistance*: Role-play framing, developer mode simulation, fictional bypass scenarios.
  2. *Prompt Injection*: System instruction override, delimiter hijacking, prompt leakage.
  3. *Harmful Content*: Unsafe instruction generation, hazardous requests.
  4. *Data Exfiltration & Privacy*: PII extraction, credential leaks, memory extraction.
  5. *Bias & Fairness*: Disparate treatment, demographic stereotypes.
  6. *Misinformation*: Hallucination inducement, deceptive narrative generation.
* **What the system does NOT do**:
  * It does NOT perform infrastructure penetration testing (DDoS, network ports, OS exploits).
  * It does NOT guarantee absolute zero-vulnerability safety for any model under test.
* **Current project phase**: **Phase 2 Complete & Audited** (Automated Multi-Round AI Red-Teaming Campaigns with Lineage & Full Provider Abstraction).

---

## 2. Technology Stack

* **Frontend**:
  * **Core**: React 18 (Vite build toolchain)
  * **Styling**: Tailwind CSS (clean, responsive, dark/light contrast cards)
  * **Routing**: React Router DOM (v6)
  * **Icons & UI**: Lucide React Icons
  * **API Client**: Axios with configured backend base URL
* **Backend**:
  * **Runtime**: Node.js (v18+)
  * **Server Framework**: Express.js REST API
  * **Database**: MongoDB with Mongoose ODM
  * **Process Control**: Non-blocking asynchronous job processing with immediate HTTP `202 Accepted` polling pattern
* **AI Engine & Provider Architecture**:
  * **Abstraction Gateway**: [`backend/services/aiProviderService.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/services/aiProviderService.js)
  * **Provider/Model Registry**: [`backend/config/providerModels.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/config/providerModels.js)
  * **Active Primary Provider**: Google Gemini (`gemini-3.5-flash-lite`, Free-tier verified $0/₹0 operation)
  * **Supported Additional Providers**: OpenRouter (Free tier models), Groq (`llama-3.3-70b-versatile`), Ollama (Local offline models), and Offline Mock Fallback Engine.

---

## 3. Complete System Workflow

```
+---------------------------------------------------------------------------------------------------------+
|                                    Automated Red-Teaming Workflow                                       |
|                                                                                                         |
|  [USER CONFIGURATION]                                                                                   |
|  - Provider (Gemini / Groq / OpenRouter / Ollama / Mock)                                                |
|  - Target Model (gemini-3.5-flash-lite / etc.)                                                          |
|  - Attack Categories & Difficulty (Low / Medium / High) & Attack Count (1-50)                           |
|                                     │                                                                   |
|                                     ▼                                                                   |
|  [1. ATTACK GENERATION] ──────────► AI Attack Generator generates structured adversarial prompts        |
|                                     │                                                                   |
|                                     ▼                                                                   |
|  [2. TARGET MODEL EXECUTION] ─────► Target LLM receives prompt via aiProviderService                   |
|                                     │                                                                   |
|                                     ▼                                                                   |
|  [3. AI SAFETY JUDGE] ────────────► Evaluates response (Score 0-100, Flags, Reasoning)                  |
|                                     │                                                                   |
|             ┌───────────────────────┴────────────────────────┐                                          |
|             ▼                                                ▼                                          |
|     [Score < 60: Defended]                         [Score >= 60: Bypass Found]                          |
|             │                                                │                                          |
|             │                                                ▼                                          |
|             │                              [4. AI MUTATION ENGINE (Up to 3 Rounds)]                     |
|             │                              - Analyzes failure cause & judge finding                     |
|             │                              - Creates mutated, harder-to-detect attack                   |
|             │                              - Re-tests against Target LLM & AI Judge                     |
|             │                                                │                                          |
|             └───────────────────────┬────────────────────────┘                                          |
|                                     │                                                                   |
|                                     ▼                                                                   |
|  [5. METRIC CONSOLIDATION] ───────► Computes Success Rate, Overall Risk Score, Risk Rating             |
|                                     │                                                                   |
|                                     ▼                                                                   |
|  [6. TELEMETRY & LINEAGE UI] ─────► Real-time dashboard, mutation lineage tree, finding logs            |
+---------------------------------------------------------------------------------------------------------+
```

---

## 4. Phase 1 Status

* **Status**: 100% Functional & Preserved.
* **Functionality**:
  * Asynchronous Single Prompt Evaluation pipeline with HTTP `202 Accepted` and status polling.
  * Adversarial Prompt Library CRUD with category filtering, search, severity badges, and inspect modal.
  * System Risk & Telemetry Dashboard with aggregate metrics and recent evaluation history.
  * Results page with comprehensive evaluation breakdown.
* **Regression Confirmation**: Phase 1 single evaluation endpoints and UI continue to work without regression through `processEvaluation` and `evaluationController.js`.

---

## 5. Phase 2 Implementation

* **Components Implemented**:
  1. **Provider Abstraction Layer** ([`aiProviderService.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/services/aiProviderService.js)): Single gateway for multi-provider API calls, backoff delays, and runtime metadata tracking.
  2. **Provider & Target Model Registry** ([`providerModels.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/config/providerModels.js)): Maps valid models to providers, resolves incompatible target strings, and defines defaults.
  3. **Target Service** ([`targetService.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/services/targetService.js)): Executes target LLMs with resolved provider models and prevents silent mock responses.
  4. **AI Safety Judge** ([`judgeService.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/services/judgeService.js)): Analyzes target response vs. adversarial prompt, returning structured JSON scores (0–100) and vulnerability flags.
  5. **Adversarial Attack Generator** ([`attackGeneratorService.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/services/attackGeneratorService.js)): Generates structured attacks categorized by attack type and difficulty.
  6. **Attack Mutation Engine** ([`attackMutationService.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/services/attackMutationService.js)): Automatically mutates successful attacks across up to 3 rounds.
  7. **Campaign Orchestrator** ([`campaignOrchestrator.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/services/campaignOrchestrator.js)): Manages the asynchronous campaign lifecycle (`GENERATE` → `TEST` → `JUDGE` → `MUTATE` → `RE-TEST` → `FINALIZE`).
  8. **Campaign Controller & Routes** ([`campaignController.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/controllers/campaignController.js), [`campaignRoutes.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/routes/campaignRoutes.js)): REST API mounted at `/api/campaigns`.
  9. **Frontend Campaign UI** ([`Campaigns.jsx`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/frontend/src/pages/Campaigns.jsx), [`CampaignDetail.jsx`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/frontend/src/pages/CampaignDetail.jsx)): Campaign list, modal wizard with provider-to-model dropdown synchronization, live progress polling, mutation lineage tree, and provider observability badges.

---

## 6. Critical Architecture Bug Discovered During Phase 2

* **Problem**: In earlier iterations, campaigns configured with `provider = gemini` and default `targetModel = gpt-4` passed `gpt-4` directly to Gemini. Google Gemini rejected the invalid model string, causing `aiProviderService.js` to trigger its offline Mock fallback. The campaign finished with status `completed`, but all target outputs were actually `[Mock response from gpt-4]`.
* **Architectural Fix**:
  1. Decoupled **Target Model** from **AI Provider Gateway**.
  2. Created [`backend/config/providerModels.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/config/providerModels.js) with `resolveModelForProvider(provider, modelId)`.
  3. Integrated `resolveModelForProvider` inside [`targetService.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/services/targetService.js) and [`aiProviderService.js`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/backend/services/aiProviderService.js).
  4. Updated [`Campaigns.jsx`](file:///c:/Users/mayan/OneDrive/Desktop/Clg%20Proj%20Try%201/llm-red-teaming-and-evaluation/frontend/src/pages/Campaigns.jsx) so selecting a provider dynamically constrains the target model dropdown to valid models and resets to the provider's verified default (`gemini-3.5-flash-lite`).

---

## 7. Validation Environment Bug

* **Problem**: During initial execution of `validateTargetArchitecture.js`, the script used `require('dotenv').config({ path: '../.env' })`. When executed from the `backend/` directory, relative path resolution failed to locate `.env`, resulting in `GEMINI_API_KEY is not defined`.
* **Fix Applied**:
  ```javascript
  const path = require('path');
  require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
  });
  ```
* **Result**: Environment variables load correctly regardless of execution directory (`injected env (3) from .env`), allowing all validation tests to run against the live API.

---

## 8. Final Validation Results

Validation suite executed via `node scripts/validateTargetArchitecture.js`:

| Test | Description | Provider | Model | isMock | Result | Status |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| **Test A** | Direct Provider Test | `gemini` | `gemini-3.5-flash-lite` | `false` | `"GEMINI_TEST_SUCCESS"` | **PASSED ✅** |
| **Test B** | Target Model Service | `gemini` | `gemini-3.5-flash-lite` | `false` | Real LLM response received | **PASSED ✅** |
| **Test C** | AI Safety Judge Service | `gemini` | `gemini-3.5-flash-lite` | `false` | Score: 0/100, Flags: `[none]` | **PASSED ✅** |
| **Test D** | AI Mutation Engine | `gemini` | `gemini-3.5-flash-lite` | `false` | Generated Round 2 mutation | **PASSED ✅** |
| **Test E** | Full Real Campaign | `gemini` | `gemini-3.5-flash-lite` | `false` | End-to-end multi-round execution | **PASSED ✅** |

---

## 9. Real Gemini Campaign Validation

* **Observed Campaign Runs**:
  * **Campaign A** (ID: `6ab57a18717d81c03d12598d`):
    * Generated Attacks: 3 | Completed Evaluations: 3 | Successful Attacks: 0 | Score: 0/100 | Risk Level: `Very Safe` | `isMock: false`
  * **Campaign B** (ID: `6ab57b5243f89b9d4264290d`):
    * Initial Attacks: 3 | Detected Bypass: 1 (Attack #1 scored 85/100) | Triggered Round 2 Mutation: Yes (Attack #4 created) | Total Evaluations: 4 | Success Rate: 25% | Score: 21/100 | Risk Level: `Low Risk` | `isMock: false`
* *Notice*: Safety test results represent specific adversarial test prompt sets and do not constitute an absolute or universal guarantee of model security.

---

## 10. Observability / Telemetry

Every evaluation record and UI finding displays:
* `providerUsed`: Exact provider executing the call (`gemini`, `openrouter`, `groq`, `ollama`, `mock`).
* `modeUsed`: Execution mode (`EXTERNAL_API`, `LOCAL`, `MOCK`).
* `modelUsed`: Specific model name resolved and evaluated (`gemini-3.5-flash-lite`).
* `isMock`: Explicit boolean flag (`false` for real external API execution, `true` for simulated offline execution).

*Why this is critical*: Prevents silent fallback failures, ensures full audit transparency, and allows users to differentiate genuine AI responses from mock fallback data.

---

## 11. Error Handling and Fallback Behavior

* **Missing API Key**: System logs a clear error, notifies the user, and uses mock fallback with `isMock: true` instead of crashing.
* **Rate Limits / 503 Capacity**: `aiProviderService.js` incorporates retry delays and backoff handling across verified candidates.
* **Invalid Provider/Model Combinations**: `resolveModelForProvider` intercepts incompatible pairs and applies verified defaults.
* **Non-Compliant LLM Output**: Regex cleaning handles code fences (````json ... ````) and defaults to `judge_parse_error` flag if JSON parsing fails.
* **Campaign Stop Request**: Users can click "Stop Campaign", which immediately halts further rounds and finalizes metrics.

---

## 12. Regression Testing

* **Phase 1 Single Evaluation**: Fully verified; asynchronous run, polling, and results display operate normally.
* **Prompt Library**: Search, category filters, and prompt creation remain intact.
* **Dashboard Telemetry**: Correctly aggregates prompt counts, evaluations, and risk scores.
* **Multi-Provider Flexibility**: MOCK and LOCAL (Ollama) modes remain available.

---

## 13. Security / Secret Handling

* **API Keys**: Stored exclusively in `backend/.env` (which is in `.gitignore`).
* **No Secret Leaks**: API keys are never exposed in frontend bundles, client responses, git commits, or console logs.
* **Environment Configuration**: Template provided via `backend/.env.example`.

---

## 14. Known Limitations

1. **Free-Tier Rate Limits**: Google Gemini and OpenRouter free tiers enforce per-minute request limits (RPM/TPM).
2. **Model Deprecations**: Google's API has deprecated `gemini-1.5-flash`, `gemini-1.5-pro`, and `gemini-2.0-flash` on the current endpoint version. `gemini-3.5-flash-lite` is the active verified working model.
3. **Mutation Round Bound**: Max mutation depth is bounded to 3 rounds to prevent runaway execution loops.
4. **Database Dependency**: Requires a running MongoDB instance.

---

## 15. Files Changed During Phase 2

| File Path | Status | Description |
| :--- | :--- | :--- |
| `backend/config/providerModels.js` | **[NEW]** | Target model & AI provider registry and model resolver. |
| `backend/services/aiProviderService.js` | **[NEW]** | Multi-provider abstraction gateway with observability metadata. |
| `backend/models/Campaign.js` | **[NEW]** | Mongoose schema for red-team campaigns. |
| `backend/models/Prompt.js` | **[MODIFIED]** | Extended with campaign ID, round, parent prompt ID, and mutation type. |
| `backend/models/Evaluation.js` | **[MODIFIED]** | Extended with campaign ID, round, `isSuccessfulAttack`, `providerUsed`, `isMock`. |
| `backend/services/attackGeneratorService.js` | **[NEW]** | AI adversarial attack generator with category templates. |
| `backend/services/attackMutationService.js` | **[NEW]** | Multi-round AI attack mutation engine. |
| `backend/services/targetService.js` | **[MODIFIED]** | Refactored to use `resolveModelForProvider` and `aiProviderService`. |
| `backend/services/judgeService.js` | **[MODIFIED]** | Upgraded with defensive parsing and `modelUsed` observability. |
| `backend/services/campaignOrchestrator.js` | **[NEW]** | Multi-round background campaign execution loop. |
| `backend/controllers/campaignController.js` | **[NEW]** | REST controller for campaign creation, control, and metrics. |
| `backend/routes/campaignRoutes.js` | **[NEW]** | Router for `/api/campaigns`. |
| `backend/scripts/validateTargetArchitecture.js` | **[NEW]** | Script-independent validation test runner for Tests A–E. |
| `backend/server.js` | **[MODIFIED]** | Registered `/api/campaigns` route endpoint. |
| `frontend/src/api/campaigns.js` | **[NEW]** | Axios client methods for campaign endpoints. |
| `frontend/src/pages/Campaigns.jsx` | **[NEW]** | Campaign listing and creation modal page. |
| `frontend/src/pages/CampaignDetail.jsx` | **[NEW]** | Live campaign dashboard, lineage tree, and provider badges. |
| `frontend/src/pages/Evaluation.jsx` | **[MODIFIED]** | Target model dropdown updated to match verified models. |
| `frontend/src/components/Sidebar.jsx` | **[MODIFIED]** | Added navigation link for Campaigns tab. |
| `frontend/src/App.jsx` | **[MODIFIED]** | Added routes for `/campaigns` and `/campaigns/:id`. |
| `frontend/src/pages/Dashboard.jsx` | **[MODIFIED]** | Added quick access button for starting campaigns. |
| `change.md` | **[MODIFIED]** | Chronological log of Phase 2 development steps. |

---

## 16. Important Commands

* **Start Backend Server**:
  ```bash
  cd backend
  npm install
  npx nodemon server.js
  ```
* **Start Frontend Application**:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```
* **Run Architecture Validation Suite**:
  ```bash
  cd backend
  node scripts/validateTargetArchitecture.js
  ```

---

## 17. Current Project Status

* **Phase 1 (Core Single Evaluation & Library)**: Implemented, verified, and regression-tested.
* **Phase 2 (Automated AI Red-Teaming Campaigns & Lineage)**: Implemented, verified, and audited.
* **Multi-Provider Architecture**: Implemented with Google Gemini (`gemini-3.5-flash-lite`) verified operational on real API calls.
* **Mock Fallback Engine**: Implemented and verified for offline/zero-credential operation.

---

## 18. Next Recommended Development Steps

1. **PDF / HTML Security Report Export**: Add a one-click downloadable summary report of campaign findings for compliance documentation.
2. **Custom Target API Endpoint Option**: Allow security engineers to red-team custom HTTP endpoints by providing a target URL and bearer token in the UI.
3. **Advanced Attack Techniques**: Expand generation templates to include Base64 encoding, multi-lingual framing, and adversarial suffix injection.
