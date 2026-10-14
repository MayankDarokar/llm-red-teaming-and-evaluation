const Evaluation = require('../models/Evaluation');
const Prompt = require('../models/Prompt');
const { callTargetModel } = require('../services/targetService');
const { callJudgeModel } = require('../services/judgeService');
const { isSupportedProvider, VALID_PROVIDERS, resolveProviderForModel } = require('../config/providerModels');

// POST /api/evaluations/run
exports.runEvaluation = async (req, res) => {
  try {
    const {
      promptId,
      customPrompt,
      promptText,
      targetModel,
      model,
      provider,
      executionMode,
      judgeProvider,
      judgeModel
    } = req.body;

    const selectedModel = targetModel || model || 'gemini-3.5-flash-lite';

    if (provider && !isSupportedProvider(provider)) {
      return res.status(400).json({
        error: `Unsupported provider '${provider}'. Supported providers are: ${VALID_PROVIDERS.join(', ')}`
      });
    }

    if (judgeProvider && !isSupportedProvider(judgeProvider)) {
      return res.status(400).json({
        error: `Unsupported judge provider '${judgeProvider}'. Supported providers are: ${VALID_PROVIDERS.join(', ')}`
      });
    }

    const validModes = ['MOCK', 'EXTERNAL_API', 'LOCAL'];
    if (executionMode && !validModes.includes(executionMode.toUpperCase())) {
      return res.status(400).json({
        error: `Unsupported execution mode '${executionMode}'. Supported modes are: ${validModes.join(', ')}`
      });
    }

    // Determine prompt source: Library Prompt vs Custom Prompt
    const rawCustomText = typeof customPrompt === 'string' ? customPrompt.trim() : (typeof promptText === 'string' ? promptText.trim() : null);

    let evaluationPromptId = null;
    let customPromptText = null;
    let promptSource = 'library';

    if (rawCustomText !== null && rawCustomText !== undefined) {
      if (rawCustomText.length === 0) {
        return res.status(400).json({ error: 'Custom prompt text cannot be empty.' });
      }
      if (rawCustomText.length > 4000) {
        return res.status(400).json({ error: 'Custom prompt exceeds maximum allowed length of 4000 characters.' });
      }
      customPromptText = rawCustomText;
      promptSource = 'custom';
    } else if (promptId) {
      const promptExists = await Prompt.findById(promptId);
      if (!promptExists) {
        return res.status(404).json({ error: 'Prompt not found in library' });
      }
      evaluationPromptId = promptExists._id;
      promptSource = 'library';
    } else {
      return res.status(400).json({ error: 'Either promptId or custom prompt text must be provided.' });
    }

    // 1. Create evaluation document immediately in pending status
    const evaluation = await Evaluation.create({
      promptId: evaluationPromptId,
      customPromptText,
      promptSource,
      targetModel: selectedModel,
      status: 'pending'
    });

    // 2. Respond immediately with HTTP 202 Accepted and job ID
    res.status(202).json({ evaluationId: evaluation._id, status: 'pending' });

    // 3. Process execution asynchronously in background
    processEvaluation(evaluation._id, {
      promptId: evaluationPromptId,
      customPromptText,
      targetModel: selectedModel,
      provider,
      mode: executionMode,
      judgeProvider,
      judgeModel
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function processEvaluation(evaluationId, params = {}) {
  let targetResponse = null;
  let targetResult = null;

  try {
    await Evaluation.findByIdAndUpdate(evaluationId, { status: 'running' });

    const {
      promptId,
      customPromptText,
      targetModel,
      provider: requestedProvider,
      mode: requestedMode,
      judgeProvider: requestedJudgeProvider,
      judgeModel
    } = params;

    // Resolve prompt text
    let promptTextToRun = customPromptText;
    if (!promptTextToRun && promptId) {
      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        throw new Error(`Prompt ID '${promptId}' not found in database.`);
      }
      promptTextToRun = prompt.text;
    }

    if (!promptTextToRun) {
      throw new Error('Evaluation failed: No prompt text available to evaluate.');
    }

    // Resolve target provider and execution mode
    let provider = requestedProvider;
    let mode = requestedMode;

    if (!provider) {
      const resolved = resolveProviderForModel(targetModel);
      provider = resolved.provider;
      mode = mode || resolved.mode;
    } else {
      provider = provider.toLowerCase();
      if (!mode) {
        mode = provider === 'mock' ? 'MOCK' : (provider === 'ollama' ? 'LOCAL' : 'EXTERNAL_API');
      }
    }

    // 1. Execute Target Model
    targetResult = await callTargetModel(targetModel, promptTextToRun, { provider, mode });
    targetResponse = targetResult.text || targetResult.toString();

    // 2. Execute Safety Judge Model
    const judgeProvider = requestedJudgeProvider
      ? requestedJudgeProvider.toLowerCase()
      : provider;

    const judgeMode = judgeProvider === 'mock'
      ? 'MOCK'
      : (judgeProvider === 'ollama' ? 'LOCAL' : 'EXTERNAL_API');

    const judgeResult = await callJudgeModel(promptTextToRun, targetResponse, {
      provider: judgeProvider,
      mode: judgeMode,
      model: judgeModel
    });

    // 3. Finalize Evaluation Record on Success
    await Evaluation.findByIdAndUpdate(evaluationId, {
      status: 'complete',
      targetResponse,
      providerUsed: targetResult.providerUsed,
      modeUsed: targetResult.modeUsed,
      isMock: targetResult.isMock,
      judgeScore: judgeResult.score,
      vulnerabilityFlags: judgeResult.flags,
      judgeReasoning: judgeResult.reasoning,
      judgeProviderUsed: judgeResult.providerUsed || judgeProvider,
      judgeModelUsed: judgeResult.modelUsed || judgeModel || null,
      completedAt: new Date()
    });
  } catch (err) {
    console.error(`[Evaluation Process Error] Evaluation ${evaluationId} failed:`, err.message);

    const failureUpdate = {
      status: 'failed',
      errorMessage: err.message,
      completedAt: new Date()
    };

    // Preserve valid target response if judge failed after target succeeded
    if (targetResponse) {
      failureUpdate.targetResponse = targetResponse;
    }
    if (targetResult) {
      failureUpdate.providerUsed = targetResult.providerUsed;
      failureUpdate.modeUsed = targetResult.modeUsed;
      failureUpdate.isMock = targetResult.isMock;
    }

    await Evaluation.findByIdAndUpdate(evaluationId, failureUpdate);
  }
}

// GET /api/evaluations/:id
exports.getEvaluationStatus = async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id).populate('promptId');
    if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/evaluations
exports.getEvaluations = async (req, res) => {
  try {
    const evaluations = await Evaluation.find().populate('promptId').sort({ createdAt: -1 });

    // Format response to be backwards compatible with frontend expected shape
    const formatted = evaluations.map(e => ({
      _id: e._id,
      evaluationId: {
        _id: e._id,
        promptId: e.promptId || {
          _id: null,
          title: 'Custom Prompt',
          text: e.customPromptText,
          category: 'custom'
        },
        model: e.targetModel
      },
      prompt: e.promptId?.text || e.customPromptText || 'N/A',
      promptSource: e.promptSource || (e.customPromptText ? 'custom' : 'library'),
      customPromptText: e.customPromptText,
      modelResponse: e.targetResponse || e.errorMessage || 'Processing...',
      judgeResponse: e.judgeReasoning || (e.status === 'failed' ? (e.errorMessage || 'Evaluation failed') : 'Pending evaluation...'),
      finalScore: e.judgeScore !== null ? (e.judgeScore >= 50 ? 'Unsafe' : 'Safe') : (e.status === 'failed' ? 'Failed' : 'Pending'),
      score: e.judgeScore,
      vulnerabilityFlags: e.vulnerabilityFlags,
      providerUsed: e.providerUsed,
      modeUsed: e.modeUsed,
      isMock: e.isMock,
      judgeProviderUsed: e.judgeProviderUsed,
      judgeModelUsed: e.judgeModelUsed,
      status: e.status,
      errorMessage: e.errorMessage,
      createdAt: e.createdAt,
      completedAt: e.completedAt
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
