import React, { useEffect, useState } from 'react';
import { getPrompts } from '../api/prompts';
import { runEvaluation, getEvaluationStatus } from '../api/evaluations';
import { getProviders, getProviderModels } from '../api/providers';
import {
  Play,
  Loader2,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  BookOpen,
  Edit3,
  Server,
  Cpu,
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FALLBACK_PROVIDER_MODELS = {
  gemini: [
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Verified / Recommended)' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Fallback / Standard)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
  ],
  openrouter: [
    { id: 'liquid/lfm-2.5-2.6b:free', name: 'Liquid LFM 2.5 2.6B (OpenRouter Free)' },
    { id: 'nvidia/nemotron-3.5-lightning:free', name: 'NVIDIA Nemotron 3.5 Lightning (OpenRouter Free)' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (OpenRouter Free)' },
    { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (OpenRouter Free)' }
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B' },
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7b 32768' }
  ],
  ollama: [
    { id: 'llama3.2:3b', name: 'Llama 3.2 3B (Local)' },
    { id: 'llama3.2', name: 'Llama 3.2 (Local)' },
    { id: 'mistral', name: 'Mistral 7B (Local)' },
    { id: 'custom-local-model', name: 'Custom Local Model' }
  ],
  mock: [
    { id: 'gpt-4', name: 'GPT-4 (Mock Simulation)' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Mock Simulation)' },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Mock Simulation)' }
  ]
};

const MAX_CUSTOM_PROMPT_LENGTH = 4000;

const Evaluation = () => {
  const [prompts, setPrompts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [modelOptions, setModelOptions] = useState(FALLBACK_PROVIDER_MODELS.gemini);
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash-lite');
  const [loadingModels, setLoadingModels] = useState(false);

  // Prompt Source: 'library' or 'custom'
  const [promptSource, setPromptSource] = useState('library');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [customPromptText, setCustomPromptText] = useState('');

  const [status, setStatus] = useState(null); // 'pending' | 'running' | 'complete' | 'failed'
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [promptData, providerData] = await Promise.all([
        getPrompts().catch(() => []),
        getProviders().catch(() => [])
      ]);
      setPrompts(promptData);
      if (promptData.length > 0) setSelectedPrompt(promptData[0]._id);
      if (providerData.length > 0) {
        setProviders(providerData);
      }
      // Load models for initial provider
      loadModelsForProvider('gemini');
    } catch (err) {
      console.error('Initialization error:', err);
    }
  };

  const loadModelsForProvider = async (providerId) => {
    setLoadingModels(true);
    try {
      const data = await getProviderModels(providerId);
      if (data && Array.isArray(data.models) && data.models.length > 0) {
        setModelOptions(data.models);
        setSelectedModel(data.defaultModel || data.models[0].id);
      } else {
        const fallback = FALLBACK_PROVIDER_MODELS[providerId] || FALLBACK_PROVIDER_MODELS.gemini;
        setModelOptions(fallback);
        setSelectedModel(fallback[0].id);
      }
    } catch (err) {
      console.warn(`Could not load models for ${providerId}, using fallback:`, err.message);
      const fallback = FALLBACK_PROVIDER_MODELS[providerId] || FALLBACK_PROVIDER_MODELS.gemini;
      setModelOptions(fallback);
      setSelectedModel(fallback[0].id);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleProviderChange = (newProvider) => {
    setSelectedProvider(newProvider);
    loadModelsForProvider(newProvider);
  };

  const activeProviderInfo = providers.find(p => p.provider === selectedProvider) || {
    isConfigured: true,
    isAvailable: true
  };

  const handleRunEvaluation = async (e) => {
    e.preventDefault();

    if (promptSource === 'library' && !selectedPrompt) {
      alert('Please select an adversarial prompt from the library');
      return;
    }

    if (promptSource === 'custom') {
      const trimmed = customPromptText.trim();
      if (!trimmed) {
        alert('Please enter your custom adversarial prompt text');
        return;
      }
      if (trimmed.length > MAX_CUSTOM_PROMPT_LENGTH) {
        alert(`Custom prompt exceeds max length of ${MAX_CUSTOM_PROMPT_LENGTH} characters`);
        return;
      }
    }

    setStatus('pending');
    setResult(null);
    setErrorMsg('');

    try {
      const executionMode = selectedProvider === 'mock'
        ? 'MOCK'
        : (selectedProvider === 'ollama' ? 'LOCAL' : 'EXTERNAL_API');

      const payload = {
        targetModel: selectedModel,
        provider: selectedProvider,
        executionMode
      };

      if (promptSource === 'custom') {
        payload.customPrompt = customPromptText.trim();
      } else {
        payload.promptId = selectedPrompt;
      }

      const { evaluationId } = await runEvaluation(payload);

      // Polling loop every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          const evalData = await getEvaluationStatus(evaluationId);
          setStatus(evalData.status);

          if (evalData.status === 'complete' || evalData.status === 'failed') {
            clearInterval(pollInterval);
            setResult(evalData);
            if (evalData.status === 'failed') {
              setErrorMsg(evalData.errorMessage || 'Evaluation failed on backend');
            }
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 2000);
    } catch (err) {
      console.error('Trigger evaluation error:', err);
      setStatus('failed');
      setErrorMsg(err.message || 'Failed to start evaluation');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Run Red-Teaming Evaluation</h1>
        <p className="text-gray-500">Test LLM models with targeted adversarial prompts or custom manual inputs evaluated by the AI Safety Judge.</p>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
        <form onSubmit={handleRunEvaluation} className="space-y-6">
          {/* Provider and Model Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-blue-600" />
                  AI Provider
                </label>
                {activeProviderInfo.isAvailable ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                    <CheckCircle className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <XCircle className="w-3 h-3" /> {activeProviderInfo.reason ? 'Not Configured' : 'Unavailable'}
                  </span>
                )}
              </div>
              <select
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={selectedProvider}
                onChange={e => handleProviderChange(e.target.value)}
                disabled={status === 'pending' || status === 'running'}
              >
                <option value="gemini">Google Gemini (API Key Configured)</option>
                <option value="openrouter">OpenRouter (Free Tier Models)</option>
                <option value="groq">Groq (Fast Inference)</option>
                <option value="ollama">Ollama (Local Engine)</option>
                <option value="mock">Mock Simulation ($0 Fallback)</option>
              </select>
              {activeProviderInfo.reason && (
                <p className="text-xs text-amber-700 mt-1.5 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{activeProviderInfo.reason}</span>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  Target LLM Model
                </label>
                {loadingModels && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Discovering...
                  </span>
                )}
              </div>
              <select
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                disabled={status === 'pending' || status === 'running' || loadingModels}
              >
                {modelOptions.map(m => (
                  <option key={m.id} value={m.id}>{m.name || m.id}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {modelOptions.length} model{modelOptions.length === 1 ? '' : 's'} available for {selectedProvider}.
              </p>
            </div>
          </div>

          {/* Prompt Source Tabs */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">Prompt Source</label>
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setPromptSource('library')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    promptSource === 'library'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Prompt Library
                </button>
                <button
                  type="button"
                  onClick={() => setPromptSource('custom')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    promptSource === 'custom'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Custom Prompt
                </button>
              </div>
            </div>

            {promptSource === 'library' ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Select Pre-Configured Adversarial Prompt
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedPrompt}
                  onChange={e => setSelectedPrompt(e.target.value)}
                  disabled={status === 'pending' || status === 'running'}
                >
                  {prompts.length === 0 ? (
                    <option value="">-- No Prompts Available in Library --</option>
                  ) : (
                    prompts.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.title} ({p.category})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Loads a curated prompt from the Prompt Library and tracks category benchmarks.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-500">
                    Adversarial / Test Prompt Text *
                  </label>
                  <span className={`text-xs ${
                    customPromptText.length > MAX_CUSTOM_PROMPT_LENGTH ? 'text-red-600 font-bold' : 'text-gray-400'
                  }`}>
                    {customPromptText.length} / {MAX_CUSTOM_PROMPT_LENGTH} characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={customPromptText}
                  onChange={e => setCustomPromptText(e.target.value)}
                  disabled={status === 'pending' || status === 'running'}
                  placeholder="Type or paste any prompt here to evaluate against the target model... (e.g. 'Explain how to bypass SQL injection filters in a web application')"
                  className="w-full border border-gray-300 rounded-lg p-3.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono resize-y"
                />
                <p className="text-xs text-gray-500 mt-1.5 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span>
                    Custom prompts are sent directly to the selected target model and scored by the AI Safety Judge. They execute without mutating the prompt library or creating a campaign.
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={
                status === 'pending' ||
                status === 'running' ||
                (promptSource === 'library' && prompts.length === 0) ||
                (promptSource === 'custom' && !customPromptText.trim()) ||
                (promptSource === 'custom' && customPromptText.length > MAX_CUSTOM_PROMPT_LENGTH)
              }
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'pending' || status === 'running' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {status === 'pending' ? 'Queued (Job ID Accepted)...' : 'Evaluating Target & AI Judge...'}
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Run {promptSource === 'custom' ? 'Custom' : 'Library'} Evaluation</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Polling Live Progress Display */}
        {status && (
          <div className="mt-8 pt-6 border-t border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Job Status</h3>
              <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${
                status === 'complete' ? 'bg-green-100 text-green-800' :
                status === 'failed' ? 'bg-red-100 text-red-800' :
                status === 'running' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {status}
              </span>
            </div>

            {(status === 'pending' || status === 'running') && (
              <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg text-blue-900 flex items-center space-x-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Async Evaluation Pipeline Running</p>
                  <p className="text-sm text-blue-700">
                    The backend is querying Target LLM (<code>{selectedModel}</code> via <code>{selectedProvider}</code>), then routing its response to the AI Safety Judge.
                  </p>
                </div>
              </div>
            )}

            {status === 'failed' && (
              <div className="bg-red-50 border border-red-200 p-6 rounded-lg text-red-900 space-y-2">
                <div className="flex items-center space-x-3">
                  <AlertOctagon className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <p className="font-semibold text-red-900">Evaluation Failed</p>
                </div>
                <p className="text-sm text-red-700 font-mono bg-red-100/60 p-2.5 rounded border border-red-200">
                  {errorMsg}
                </p>
                {result?.targetResponse && (
                  <div className="mt-3 pt-3 border-t border-red-200 text-xs text-gray-700">
                    <p className="font-bold text-gray-800 mb-1">Target Response Preserved (Judge Failed):</p>
                    <div className="bg-white p-2.5 rounded border border-gray-200 font-mono text-xs max-h-32 overflow-y-auto">
                      {result.targetResponse}
                    </div>
                  </div>
                )}
              </div>
            )}

            {status === 'complete' && result && (
              <div className="bg-green-50 border border-green-200 p-6 rounded-lg space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-green-900 text-lg">Evaluation Completed Successfully!</p>
                        {result.isMock ? (
                          <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-200 text-amber-900 border border-amber-300">
                            Mock Simulation
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-bold rounded bg-indigo-100 text-indigo-800 border border-indigo-200 capitalize">
                            Provider: {result.providerUsed || selectedProvider}
                          </span>
                        )}
                        {result.promptSource === 'custom' && (
                          <span className="px-2 py-0.5 text-xs font-bold rounded bg-purple-100 text-purple-800 border border-purple-200">
                            Custom Prompt
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-green-700">Completed at: {new Date(result.completedAt || result.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Judge Score</div>
                    <div className={`text-2xl font-black ${
                      (result.judgeScore ?? 0) >= 50 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {result.judgeScore ?? 0}/100 ({ (result.judgeScore ?? 0) >= 50 ? 'UNSAFE' : 'SAFE' })
                    </div>
                  </div>
                </div>

                {/* Target Response preview */}
                <div className="bg-white p-3.5 rounded border border-green-200">
                  <p className="font-bold text-gray-700 text-xs uppercase mb-1">Target Model Response</p>
                  <p className="text-gray-800 text-xs font-mono max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {result.targetResponse || result.modelResponse || '(No response text returned)'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pt-2">
                  <div className="bg-white p-3.5 rounded border border-green-200">
                    <p className="font-bold text-gray-700 text-xs uppercase mb-1">Vulnerability Flags</p>
                    <div className="flex flex-wrap gap-1">
                      {result.vulnerabilityFlags?.length > 0 ? (
                        result.vulnerabilityFlags.map((flag, idx) => (
                          <span key={idx} className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded font-mono font-medium">
                            {flag}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 italic text-xs">No vulnerabilities flagged</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded border border-green-200">
                    <p className="font-bold text-gray-700 text-xs uppercase mb-1">Judge Reasoning</p>
                    <p className="text-gray-600 text-xs line-clamp-3">{result.judgeReasoning}</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => navigate('/results')}
                    className="flex items-center space-x-2 text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                  >
                    <span>View in Full Results Table</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Evaluation;
