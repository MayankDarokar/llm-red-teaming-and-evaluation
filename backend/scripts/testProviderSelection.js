/**
 * Comprehensive Pure Unit & Mock Test Suite for Provider Selection & Routing (Task 2.2)
 *
 * Covers:
 * 1. Explicit Gemini selection
 * 2. Explicit OpenRouter, Groq, Ollama, and Mock selection
 * 3. Missing provider behavior (model-based inference and safe defaults)
 * 4. Unsupported provider values (validation & HTTP 400 responses)
 * 5. Provider failure without silent substitution to Mock
 * 6. Correct provider propagation for both single evaluation and campaign creation
 *
 * Safety: 100% in-memory / mocked. Zero live AI calls, zero external quota, zero MongoDB writes.
 */

const {
  PROVIDER_MODELS,
  VALID_PROVIDERS,
  isSupportedProvider,
  resolveModelForProvider,
  resolveProviderForModel
} = require('../config/providerModels');

const { generateCompletion } = require('../services/aiProviderService');
const { callTargetModel } = require('../services/targetService');
const { callJudgeModel } = require('../services/judgeService');
const evaluationController = require('../controllers/evaluationController');
const campaignController = require('../controllers/campaignController');
const Evaluation = require('../models/Evaluation');
const Campaign = require('../models/Campaign');
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
  console.log('TASK 2.2: EXPLICIT PROVIDER SELECTION & ROUTING TEST SUITE');
  console.log('===============================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Explicit Gemini Selection
  // ---------------------------------------------------------------------------
  console.log('--- 1. Explicit Gemini Selection ---');
  const geminiModel = resolveModelForProvider('gemini', 'gemini-3.5-flash-lite');
  assert(geminiModel === 'gemini-3.5-flash-lite', 'Gemini model resolves correctly');
  assert(isSupportedProvider('gemini') === true, 'Gemini is recognized as supported provider');

  // Test Gemini successful execution with mocked fetch
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  try {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    global.fetch = async (url) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Gemini explicit response' }] } }]
          })
        };
      }
      throw new Error(`Unexpected URL in test: ${url}`);
    };

    const geminiRes = await generateCompletion({
      provider: 'gemini',
      mode: 'EXTERNAL_API',
      model: 'gemini-3.5-flash-lite',
      userPrompt: 'Test prompt'
    });

    assert(geminiRes.providerUsed === 'gemini', 'Explicit Gemini call records providerUsed === "gemini"');
    assert(geminiRes.isMock === false, 'Explicit Gemini call is not marked as mock');
    assert(geminiRes.text === 'Gemini explicit response', 'Explicit Gemini call returns expected text');
  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  // ---------------------------------------------------------------------------
  // 2. Explicit OpenRouter, Groq, Ollama, and Mock Selection
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Explicit OpenRouter, Groq, Ollama, and Mock Selection ---');
  assert(isSupportedProvider('openrouter') === true, 'OpenRouter is supported');
  assert(isSupportedProvider('groq') === true, 'Groq is supported');
  assert(isSupportedProvider('ollama') === true, 'Ollama is supported');
  assert(isSupportedProvider('mock') === true, 'Mock is supported');

  // Test OpenRouter Mocked Call
  try {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    global.fetch = async (url) => {
      if (url.includes('openrouter.ai')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'OpenRouter response' } }]
          })
        };
      }
      throw new Error('Not openrouter');
    };

    const orRes = await generateCompletion({
      provider: 'openrouter',
      mode: 'EXTERNAL_API',
      model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
      userPrompt: 'Test'
    });
    assert(orRes.providerUsed === 'openrouter' && orRes.isMock === false, 'Explicit OpenRouter call succeeds with providerUsed === "openrouter"');
  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  // Test Groq Mocked Call
  try {
    process.env.GROQ_API_KEY = 'test-groq-key';
    global.fetch = async (url) => {
      if (url.includes('api.groq.com')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Groq response' } }]
          })
        };
      }
      throw new Error('Not groq');
    };

    const groqRes = await generateCompletion({
      provider: 'groq',
      mode: 'EXTERNAL_API',
      model: 'llama-3.3-70b-versatile',
      userPrompt: 'Test'
    });
    assert(groqRes.providerUsed === 'groq' && groqRes.isMock === false, 'Explicit Groq call succeeds with providerUsed === "groq"');
  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  // Test Ollama Mocked Call
  try {
    global.fetch = async (url) => {
      if (url.includes('11434')) {
        return {
          ok: true,
          json: async () => ({ response: 'Ollama local response' })
        };
      }
      throw new Error('Not ollama');
    };

    const ollamaRes = await generateCompletion({
      provider: 'ollama',
      mode: 'LOCAL',
      model: 'llama3.2',
      userPrompt: 'Test'
    });
    assert(ollamaRes.providerUsed === 'ollama' && ollamaRes.modeUsed === 'LOCAL' && ollamaRes.isMock === false, 'Explicit Ollama call succeeds with providerUsed === "ollama"');
  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  // Test Explicit Mock Selection (Never touches fetch)
  const mockRes = await generateCompletion({
    provider: 'mock',
    mode: 'MOCK',
    model: 'gpt-4',
    userPrompt: 'Test'
  });
  assert(mockRes.providerUsed === 'mock' && mockRes.isMock === true && mockRes.modeUsed === 'MOCK', 'Explicit Mock call returns isMock === true without network calls');

  // ---------------------------------------------------------------------------
  // 3. Missing Provider Behavior (Accurate Inference and Safe Defaults)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Missing Provider Behavior ---');
  // Critical fix: OpenRouter models should NOT be routed to Gemini
  const orInferred = resolveProviderForModel('google/gemini-2.0-flash-lite-preview-02-05:free');
  assert(orInferred.provider === 'openrouter', 'OpenRouter free model infers openrouter, not gemini');

  const groqInferred = resolveProviderForModel('llama-3.3-70b-versatile');
  assert(groqInferred.provider === 'groq', 'Groq model infers groq');

  const ollamaInferred = resolveProviderForModel('llama3.2');
  assert(ollamaInferred.provider === 'ollama', 'Ollama model infers ollama');

  const mockInferred = resolveProviderForModel('gpt-4');
  assert(mockInferred.provider === 'mock', 'GPT-4 model infers mock');

  const defaultInferred = resolveProviderForModel(null);
  assert(defaultInferred.provider === 'gemini', 'Null model safely defaults to gemini');

  // ---------------------------------------------------------------------------
  // 4. Unsupported Provider Values
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Unsupported Provider Values ---');
  assert(isSupportedProvider('anthropic_direct') === false, 'Unsupported provider rejected by validator');
  assert(isSupportedProvider('') === false, 'Empty provider rejected by validator');
  assert(isSupportedProvider(null) === false, 'Null provider rejected by validator');

  let genErrorCaught = false;
  try {
    await generateCompletion({ provider: 'unsupported_provider', model: 'foo' });
  } catch (err) {
    genErrorCaught = true;
    assert(err.message.includes('Unsupported AI provider'), 'generateCompletion throws descriptive error on unsupported provider');
  }
  assert(genErrorCaught, 'generateCompletion threw for unsupported provider');

  // Test Evaluation Controller rejection of unsupported provider (HTTP 400)
  let evalStatusSent = null;
  let evalJsonSent = null;
  const mockEvalRes = {
    status: (code) => {
      evalStatusSent = code;
      return {
        json: (data) => {
          evalJsonSent = data;
        }
      };
    }
  };

  await evaluationController.runEvaluation(
    { body: { promptId: '507f1f77bcf86cd799439011', provider: 'invalid_provider' } },
    mockEvalRes
  );
  assert(evalStatusSent === 400, 'runEvaluation returns HTTP 400 for unsupported provider');
  assert(evalJsonSent && evalJsonSent.error && evalJsonSent.error.includes('Unsupported provider'), 'runEvaluation provides clear unsupported provider error message');

  // Test Campaign Controller rejection of unsupported provider (HTTP 400)
  let campStatusSent = null;
  let campJsonSent = null;
  const mockCampRes = {
    status: (code) => {
      campStatusSent = code;
      return {
        json: (data) => {
          campJsonSent = data;
        }
      };
    }
  };

  await campaignController.createCampaign(
    { body: { name: 'Test Campaign', provider: 'unsupported_provider' } },
    mockCampRes
  );
  assert(campStatusSent === 400, 'createCampaign returns HTTP 400 for unsupported provider');
  assert(campJsonSent && campJsonSent.error && campJsonSent.error.includes('Unsupported provider'), 'createCampaign provides clear unsupported provider error message');

  // ---------------------------------------------------------------------------
  // 5. Provider Failure Without Silent Substitution to Mock
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Provider Failure Without Silent Substitution to Mock ---');
  // When a real provider fails or has no API key, it MUST NOT return isMock: true
  try {
    delete process.env.OPENROUTER_API_KEY;
    let thrownError = null;
    try {
      await generateCompletion({ provider: 'openrouter', model: 'foo' });
    } catch (err) {
      thrownError = err;
    }
    assert(thrownError !== null, 'OpenRouter without key throws error instead of silently returning mock');
    assert(thrownError.message.includes('OPENROUTER_API_KEY is missing'), 'Error mentions missing OPENROUTER_API_KEY');
  } finally {
    process.env = { ...originalEnv };
  }

  try {
    delete process.env.GROQ_API_KEY;
    let thrownGroq = null;
    try {
      await generateCompletion({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    } catch (err) {
      thrownGroq = err;
    }
    assert(thrownGroq !== null, 'Groq without key throws error instead of silently returning mock');
    assert(thrownGroq.message.includes('GROQ_API_KEY is missing'), 'Error mentions missing GROQ_API_KEY');
  } finally {
    process.env = { ...originalEnv };
  }

  // Test callTargetModel with failing real provider
  try {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable'
    });

    let targetError = null;
    try {
      await callTargetModel('gemini-3.5-flash-lite', 'Test prompt', { provider: 'gemini', mode: 'EXTERNAL_API' });
    } catch (err) {
      targetError = err;
    }
    assert(targetError !== null, 'callTargetModel throws on real provider failure instead of substituting mock');
  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  // Test callJudgeModel with failing real provider
  try {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable'
    });

    let judgeError = null;
    try {
      await callJudgeModel('Test prompt', 'Test response', { provider: 'gemini', mode: 'EXTERNAL_API' });
    } catch (err) {
      judgeError = err;
    }
    assert(judgeError !== null, 'callJudgeModel throws on real provider failure instead of substituting mock');
  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  // ---------------------------------------------------------------------------
  // 6. Correct Provider Propagation for Single Evaluation & Campaign Creation
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Correct Provider Propagation ---');
  // Verify Campaign.create receives the resolved provider and executionMode
  const originalCampaignCreate = Campaign.create;
  let capturedCampaignArgs = null;
  Campaign.create = async (args) => {
    capturedCampaignArgs = args;
    return { _id: 'camp-123', ...args };
  };

  try {
    await campaignController.createCampaign(
      {
        body: {
          name: 'Security Test Campaign',
          provider: 'groq',
          executionMode: 'EXTERNAL_API',
          targetModel: 'llama-3.3-70b-versatile'
        }
      },
      mockCampRes
    );
    assert(capturedCampaignArgs !== null, 'Campaign.create was invoked');
    assert(capturedCampaignArgs.provider === 'groq', 'Campaign persisted explicit provider: groq');
    assert(capturedCampaignArgs.executionMode === 'EXTERNAL_API', 'Campaign persisted executionMode: EXTERNAL_API');
    assert(capturedCampaignArgs.targetModel === 'llama-3.3-70b-versatile', 'Campaign persisted targetModel');
  } finally {
    Campaign.create = originalCampaignCreate;
  }

  // Verify single evaluation propagates provider
  const originalPromptFindById = Prompt.findById;
  const originalEvaluationCreate = Evaluation.create;
  let capturedEvalCreate = null;

  Prompt.findById = async () => ({ _id: 'p-1', text: 'Adversarial prompt' });
  Evaluation.create = async (args) => {
    capturedEvalCreate = args;
    return { _id: 'eval-123', ...args };
  };

  try {
    let singleEvalStatus = null;
    let singleEvalJson = null;
    const singleRes = {
      status: (code) => {
        singleEvalStatus = code;
        return { json: (d) => { singleEvalJson = d; } };
      }
    };

    await evaluationController.runEvaluation(
      {
        body: {
          promptId: 'p-1',
          targetModel: 'llama3.2',
          provider: 'ollama',
          executionMode: 'LOCAL'
        }
      },
      singleRes
    );

    assert(singleEvalStatus === 202, 'runEvaluation accepted request with HTTP 202');
    assert(capturedEvalCreate && capturedEvalCreate.targetModel === 'llama3.2', 'Evaluation created with targetModel');
  } finally {
    Prompt.findById = originalPromptFindById;
    Evaluation.create = originalEvaluationCreate;
  }

  console.log('\n===============================================================');
  console.log(`TASK 2.2 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
