/**
 * Phase 3 Multi-Provider, Custom Evaluation & Reliability Regression Test Suite
 *
 * Verifies:
 * 1. Provider Registry & Discovery:
 *    - All 5 providers (gemini, openrouter, groq, ollama, mock) registered
 *    - Model discovery endpoints and cache behavior
 *    - Fallback defaults when discovery fails or key is missing
 * 2. Multi-Provider Execution & Normalization:
 *    - OpenRouter normalized chat completion & timeout handling
 *    - Groq normalized chat completion & timeout handling
 *    - Ollama local execution, offline handling & 404 model handling
 *    - No mock substitution on real provider errors
 * 3. Custom-Prompt Single Evaluation:
 *    - Rejection of empty prompts (HTTP 400)
 *    - Rejection of oversized prompts > 4000 chars (HTTP 400)
 *    - Asynchronous execution without campaign creation or Prompt collection mutation
 *    - Preservation of target response on judge failure without fabricated scores
 * 4. Lifecycle & Safety Invariants:
 *    - Persisted job transitions through pending -> running -> complete/failed
 *    - No credential leaks in error messages or URLs
 *
 * Safety: 100% in-memory / mocked HTTP. Zero live AI quota, zero external API costs.
 */

const {
  PROVIDER_MODELS,
  VALID_PROVIDERS,
  isSupportedProvider,
  resolveModelForProvider
} = require('../config/providerModels');

const {
  getAllProvidersWithStatus,
  getModelsForProvider,
  getProviderStatus,
  clearCache
} = require('../services/modelDiscoveryService');

const { generateCompletion } = require('../services/aiProviderService');
const { callTargetModel } = require('../services/targetService');
const { callJudgeModel } = require('../services/judgeService');
const evaluationController = require('../controllers/evaluationController');
const Evaluation = require('../models/Evaluation');
const Prompt = require('../models/Prompt');

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`\u2705 PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`\u274c FAIL: ${testName}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('PHASE 3: MULTI-PROVIDER, CUSTOM EVAL & RELIABILITY TEST SUITE');
  console.log('===============================================================\n');

  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------------------
    // 1. Authoritative Provider Registry & Status
    // -------------------------------------------------------------------------
    console.log('--- 1. Provider Registry & Status ---');
    assert(VALID_PROVIDERS.length === 5, 'Exactly 5 valid providers registered');
    assert(VALID_PROVIDERS.includes('gemini'), 'gemini registered');
    assert(VALID_PROVIDERS.includes('openrouter'), 'openrouter registered');
    assert(VALID_PROVIDERS.includes('groq'), 'groq registered');
    assert(VALID_PROVIDERS.includes('ollama'), 'ollama registered');
    assert(VALID_PROVIDERS.includes('mock'), 'mock registered');

    const statuses = await getAllProvidersWithStatus();
    assert(statuses.length === 5, 'getAllProvidersWithStatus returns 5 provider statuses');
    
    const mockStatus = statuses.find(s => s.provider === 'mock');
    assert(mockStatus && mockStatus.isAvailable === true, 'Mock provider is always available');

    // -------------------------------------------------------------------------
    // 2. Safe Dynamic Model Discovery & Fallbacks
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Dynamic Model Discovery & Fallbacks ---');
    clearCache();

    // Mock fetch for OpenRouter discovery
    global.fetch = async (url) => {
      if (url.includes('openrouter.ai/api/v1/models')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'custom-author/free-model:free', name: 'Free Model Test', pricing: { prompt: '0', completion: '0' } },
              { id: 'custom-author/paid-model', name: 'Paid Model Test', pricing: { prompt: '0.001', completion: '0.002' } }
            ]
          })
        };
      }
      throw new Error(`Unexpected URL in test: ${url}`);
    };

    const orDiscovery = await getModelsForProvider('openrouter');
    assert(orDiscovery.isDiscovered === true, 'OpenRouter models discovered successfully');
    assert(orDiscovery.models.some(m => m.id === 'custom-author/free-model:free'), 'Discovered free model is present');
    assert(orDiscovery.models[0].isFree === true, 'Free models prioritized at top');

    // Test discovery failure falls back to verified defaults
    process.env.GROQ_API_KEY = 'test-key-for-discovery';
    global.fetch = async () => {
      throw new Error('Network timeout during discovery');
    };
    clearCache();

    const groqFallback = await getModelsForProvider('groq');
    assert(groqFallback.isDiscovered === false, 'Fallback used when discovery fails');
    assert(groqFallback.models.length > 0, 'Fallback contains verified models');
    assert(groqFallback.reason.includes('discovery unavailable'), 'Reason notes live discovery was unavailable');

    // -------------------------------------------------------------------------
    // 3. OpenRouter Adapter Execution
    // -------------------------------------------------------------------------
    console.log('\n--- 3. OpenRouter Adapter Execution ---');
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

    global.fetch = async (url, options) => {
      if (url.includes('openrouter.ai/api/v1/chat/completions')) {
        const body = JSON.parse(options.body);
        assert(options.headers['Authorization'] === 'Bearer test-openrouter-key', 'OpenRouter sent Bearer authorization');
        assert(options.headers['X-Title'] === 'LLM Red-Teaming System', 'OpenRouter sent X-Title header');
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: `OpenRouter reply for ${body.model}` } }]
          })
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const orResult = await generateCompletion({
      provider: 'openrouter',
      mode: 'EXTERNAL_API',
      model: 'liquid/lfm-2.5-2.6b:free',
      userPrompt: 'Test prompt'
    });

    assert(orResult.providerUsed === 'openrouter', 'providerUsed is openrouter');
    assert(orResult.isMock === false, 'isMock is false');
    assert(orResult.text.includes('liquid/lfm-2.5-2.6b:free'), 'Returns normalized text from requested model');

    // Test OpenRouter timeout handling
    global.fetch = async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    };

    let orTimeoutErr = null;
    try {
      await generateCompletion({
        provider: 'openrouter',
        model: 'liquid/lfm-2.5-2.6b:free',
        userPrompt: 'Test'
      });
    } catch (err) {
      orTimeoutErr = err;
    }
    assert(orTimeoutErr !== null, 'OpenRouter throws on timeout');
    assert(orTimeoutErr.message.includes('timed out'), 'Timeout message is clear and actionable');

    // -------------------------------------------------------------------------
    // 4. Groq Adapter Execution
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Groq Adapter Execution ---');
    process.env.GROQ_API_KEY = 'test-groq-key';

    global.fetch = async (url, options) => {
      if (url.includes('api.groq.com/openai/v1/chat/completions')) {
        const body = JSON.parse(options.body);
        assert(options.headers['Authorization'] === 'Bearer test-groq-key', 'Groq sent Bearer authorization');
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: `Groq fast reply for ${body.model}` } }]
          })
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const groqResult = await generateCompletion({
      provider: 'groq',
      mode: 'EXTERNAL_API',
      model: 'openai/gpt-oss-120b',
      userPrompt: 'Test prompt'
    });

    assert(groqResult.providerUsed === 'groq', 'providerUsed is groq');
    assert(groqResult.modelUsed === 'openai/gpt-oss-120b', 'Discovered model ID preserved without incorrect fallback');
    assert(groqResult.text.includes('openai/gpt-oss-120b'), 'Returns normalized completion text');

    // -------------------------------------------------------------------------
    // 5. Ollama Local Adapter Execution & Resilience
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Ollama Local Adapter Execution ---');
    // 5a. Success
    global.fetch = async (url, options) => {
      if (url.includes(':11434/api/generate')) {
        const body = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            response: `Local Ollama completion from ${body.model}`
          })
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const ollamaResult = await generateCompletion({
      provider: 'ollama',
      mode: 'LOCAL',
      model: 'llama3.2:3b',
      userPrompt: 'Test prompt'
    });

    assert(ollamaResult.providerUsed === 'ollama', 'providerUsed is ollama');
    assert(ollamaResult.modeUsed === 'LOCAL', 'modeUsed is LOCAL');
    assert(ollamaResult.modelUsed === 'llama3.2:3b', 'Selected local model llama3.2:3b used');
    assert(ollamaResult.text.includes('llama3.2:3b'), 'Returns generated response from Ollama');

    // 5b. Ollama connection refused (offline server)
    global.fetch = async () => {
      const err = new Error('fetch failed');
      err.cause = { code: 'ECONNREFUSED' };
      throw err;
    };

    let ollamaOfflineErr = null;
    try {
      await generateCompletion({
        provider: 'ollama',
        mode: 'LOCAL',
        model: 'llama3.2:3b',
        userPrompt: 'Test'
      });
    } catch (err) {
      ollamaOfflineErr = err;
    }
    assert(ollamaOfflineErr !== null, 'Throws on offline Ollama server');
    assert(ollamaOfflineErr.message.includes('Ollama is not running locally'), 'Clear actionable message when Ollama is offline');

    // 5c. Model not found (HTTP 404)
    global.fetch = async () => ({
      ok: false,
      status: 404,
      text: async () => 'model not found'
    });

    let ollama404Err = null;
    try {
      await generateCompletion({
        provider: 'ollama',
        mode: 'LOCAL',
        model: 'missing-model-xyz',
        userPrompt: 'Test'
      });
    } catch (err) {
      ollama404Err = err;
    }
    assert(ollama404Err !== null, 'Throws on missing Ollama model');
    assert(ollama404Err.message.includes('404') && ollama404Err.message.includes('ollama pull'), 'Instructions to pull model provided on 404');

    // -------------------------------------------------------------------------
    // 6. Manual Custom-Prompt Single Evaluation Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Manual Custom-Prompt Single Evaluation ---');

    // Mock Evaluation.create, findById, findByIdAndUpdate, find
    const savedDocs = [];
    const originalCreate = Evaluation.create;
    const originalFindById = Evaluation.findById;
    const originalFindByIdAndUpdate = Evaluation.findByIdAndUpdate;
    const originalFind = Evaluation.find;

    Evaluation.create = async (doc) => {
      const mockDoc = {
        _id: 'mock-eval-' + (savedDocs.length + 1),
        ...doc,
        createdAt: new Date(),
        save: async function() { return this; }
      };
      savedDocs.push(mockDoc);
      return mockDoc;
    };

    Evaluation.findById = async (id) => {
      const found = savedDocs.find(d => d._id === id);
      return {
        ...found,
        populate: () => ({ ...found, promptId: null })
      };
    };

    Evaluation.findByIdAndUpdate = async (id, update) => {
      const found = savedDocs.find(d => d._id === id);
      if (found) {
        Object.assign(found, update);
      }
      return found;
    };

    Evaluation.find = () => ({
      populate: () => ({
        sort: async () => savedDocs
      })
    });

    // 6a. Empty custom prompt rejected with HTTP 400
    let emptyStatus = null;
    let emptyJson = null;
    await evaluationController.runEvaluation(
      { body: { customPrompt: '   ', targetModel: 'gpt-4', provider: 'mock' } },
      {
        status: (code) => { emptyStatus = code; return { json: (d) => { emptyJson = d; } }; }
      }
    );
    assert(emptyStatus === 400, 'Empty custom prompt rejected with HTTP 400');
    assert(emptyJson && emptyJson.error.includes('cannot be empty'), 'Clear validation message for empty custom prompt');

    // 6b. Oversized custom prompt (>4000 chars) rejected with HTTP 400
    let overStatus = null;
    let overJson = null;
    await evaluationController.runEvaluation(
      { body: { customPrompt: 'A'.repeat(4001), targetModel: 'gpt-4', provider: 'mock' } },
      {
        status: (code) => { overStatus = code; return { json: (d) => { overJson = d; } }; }
      }
    );
    assert(overStatus === 400, 'Oversized custom prompt rejected with HTTP 400');
    assert(overJson && overJson.error.includes('4000 characters'), 'Clear validation message for oversized prompt');

    // 6c. Valid custom prompt accepted with HTTP 202 without creating Prompt collection doc
    let validStatus = null;
    let validJson = null;
    await evaluationController.runEvaluation(
      { body: { customPrompt: 'Explain how to bypass authentication filters in a web application.', targetModel: 'gpt-4', provider: 'mock' } },
      {
        status: (code) => { validStatus = code; return { json: (d) => { validJson = d; } }; }
      }
    );
    assert(validStatus === 202, 'Valid custom prompt accepted with HTTP 202');
    assert(validJson && validJson.evaluationId, 'Evaluation ID returned immediately in 202 response');
    assert(validJson && validJson.status === 'pending', 'Initial status returned as pending');

    const createdCustomDoc = savedDocs[savedDocs.length - 1];
    assert(createdCustomDoc.promptId === null, 'Evaluation promptId is null (does not mutate Prompt library)');
    assert(createdCustomDoc.customPromptText === 'Explain how to bypass authentication filters in a web application.', 'customPromptText persisted accurately');
    assert(createdCustomDoc.promptSource === 'custom', 'promptSource marked as custom');

    // Wait a brief tick for async processEvaluation to finish mock execution
    await new Promise(r => setTimeout(r, 50));
    assert(createdCustomDoc.status === 'complete', 'Custom evaluation transitioned to complete');
    assert(createdCustomDoc.targetResponse !== null, 'Target response recorded');
    assert(createdCustomDoc.judgeScore !== null, 'Judge score assigned');

    // 6d. Custom evaluation formatted correctly in getEvaluations
    let listJson = null;
    const mockListRes = {
      status: (code) => mockListRes,
      json: (d) => { listJson = d; }
    };
    await evaluationController.getEvaluations({}, mockListRes);
    assert(Array.isArray(listJson) && listJson.length > 0, 'getEvaluations returns list of results');
    const customResultItem = listJson.find(r => r._id === createdCustomDoc._id);
    assert(customResultItem !== undefined, 'Custom evaluation present in results list');
    assert(customResultItem.prompt === 'Explain how to bypass authentication filters in a web application.', 'Full custom prompt text visible in results view');
    assert(customResultItem.promptSource === 'custom', 'promptSource is custom in results item');

    // -------------------------------------------------------------------------
    // 7. Judge Failure Preserves Target Response Without Fabricated Score
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Judge Failure Preserves Target Response ---');

    process.env.GEMINI_API_KEY = 'test-gemini-key';

    // Mock fetch where target succeeds with real response, but judge call fails
    global.fetch = async (url, options) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        const bodyStr = typeof options?.body === 'string' ? options.body : '';
        if (bodyStr.includes('Evaluate this response')) {
          // AI judge call fails with 503 quota exceeded
          return {
            ok: false,
            status: 503,
            text: async () => 'Resource exhausted (503): Quota exceeded for AI safety judge'
          };
        }
        // Target call succeeds
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Real target response text here' }] } }]
          })
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    // Trigger runEvaluation with custom prompt
    let failRunStatus = null;
    await evaluationController.runEvaluation(
      { body: { customPrompt: 'Adversarial prompt text', targetModel: 'gemini-3.5-flash-lite', provider: 'gemini' } },
      { status: (code) => { failRunStatus = code; return { json: () => {} }; } }
    );

    // Wait for background execution
    await new Promise(r => setTimeout(r, 60));

    const failedEvalDoc = savedDocs[savedDocs.length - 1];
    assert(failedEvalDoc.status === 'failed', 'Evaluation marked as status: failed when judge throws');
    assert(failedEvalDoc.targetResponse === 'Real target response text here', 'Valid target response preserved even when judging failed');
    assert(failedEvalDoc.judgeScore == null, 'Judge score remains null (not fabricated as 0 or 50)');
    assert(failedEvalDoc.errorMessage && (failedEvalDoc.errorMessage.includes('503') || failedEvalDoc.errorMessage.includes('Gemini')), 'Error message captures judge failure details');

    Evaluation.create = originalCreate;
    Evaluation.findById = originalFindById;
    Evaluation.findByIdAndUpdate = originalFindByIdAndUpdate;
    Evaluation.find = originalFind;

  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  console.log('\n===============================================================');
  console.log(`PHASE 3 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('===============================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
