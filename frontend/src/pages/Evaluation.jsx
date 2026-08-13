import React, { useEffect, useState } from 'react';
import { getPrompts } from '../api/prompts';
import { runEvaluation, getEvaluationStatus } from '../api/evaluations';
import { Play, Loader2, CheckCircle2, AlertOctagon, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Evaluation = () => {
  const [prompts, setPrompts] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [status, setStatus] = useState(null); // 'pending' | 'running' | 'complete' | 'failed'
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      const data = await getPrompts();
      setPrompts(data);
      if (data.length > 0) setSelectedPrompt(data[0]._id);
    } catch (err) {
      console.error('Error loading prompts:', err);
    }
  };

  const handleRunEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedPrompt) return alert('Please select a prompt');

    setStatus('pending');
    setResult(null);
    setErrorMsg('');

    try {
      const { evaluationId } = await runEvaluation(selectedPrompt, selectedModel);

      // Start Polling loop every 2 seconds
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
        <p className="text-gray-500">Select an adversarial prompt and target model to test for safety vulnerabilities.</p>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
        <form onSubmit={handleRunEvaluation} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Target LLM Model</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                disabled={status === 'pending' || status === 'running'}
              >
                <option value="gpt-4o">OpenAI GPT-4o</option>
                <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                <option value="llama-3-70b">Meta Llama 3 70B</option>
                <option value="gemini-1-5-pro">Google Gemini 1.5 Pro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Adversarial Prompt</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={selectedPrompt}
                onChange={e => setSelectedPrompt(e.target.value)}
                disabled={status === 'pending' || status === 'running'}
              >
                {prompts.length === 0 ? (
                  <option value="">-- No Prompts Available --</option>
                ) : (
                  prompts.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.title} ({p.category})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={status === 'pending' || status === 'running' || prompts.length === 0}
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
                  <span>Start Async Evaluation</span>
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
                    The backend is querying the Target LLM model, then routing its response to the AI Safety Judge model. Frontend is polling status...
                  </p>
                </div>
              </div>
            )}

            {status === 'failed' && (
              <div className="bg-red-50 border border-red-200 p-6 rounded-lg text-red-900 flex items-center space-x-4">
                <AlertOctagon className="w-8 h-8 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Evaluation Failed</p>
                  <p className="text-sm text-red-700">{errorMsg}</p>
                </div>
              </div>
            )}

            {status === 'complete' && result && (
              <div className="bg-green-50 border border-green-200 p-6 rounded-lg space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-green-900 text-lg">Evaluation Completed Successfully!</p>
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
                    <span>View Full Evaluation Results</span>
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
