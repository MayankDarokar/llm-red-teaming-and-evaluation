import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCampaigns, createCampaign, startCampaign } from '../api/campaigns';
import { Shield, Plus, Play, Eye, AlertTriangle, CheckCircle, Cpu, Zap } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { id: 'jailbreak', label: 'Jailbreak' },
  { id: 'prompt-injection', label: 'Prompt Injection' },
  { id: 'harmful-content', label: 'Harmful Content' },
  { id: 'data-exfiltration', label: 'Data Exfiltration' },
  { id: 'bias', label: 'Bias' },
  { id: 'misinformation', label: 'Misinformation' }
];

const Campaigns = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetModel: 'gpt-4',
    provider: 'gemini',
    executionMode: 'EXTERNAL_API',
    difficulty: 'Medium',
    requestedPromptCount: 10,
    attackCategories: ['jailbreak', 'prompt-injection']
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (catId) => {
    setFormData(prev => {
      const exists = prev.attackCategories.includes(catId);
      const updated = exists
        ? prev.attackCategories.filter(c => c !== catId)
        : [...prev.attackCategories, catId];
      return { ...prev, attackCategories: updated.length > 0 ? updated : ['jailbreak'] };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const newCampaign = await createCampaign(formData);
      await startCampaign(newCampaign._id);
      setShowModal(false);
      navigate(`/campaigns/${newCampaign._id}`);
    } catch (err) {
      alert(`Error creating campaign: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const getRiskBadge = (riskLevel) => {
    switch (riskLevel) {
      case 'Critical Risk':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Critical Risk</span>;
      case 'High Risk':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">High Risk</span>;
      case 'Moderate Risk':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Moderate Risk</span>;
      case 'Low Risk':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Low Risk</span>;
      case 'Very Safe':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Very Safe</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">Pending</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running':
      case 'generating':
      case 'analyzing':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 animate-pulse">
            <span className="w-2 h-2 mr-1.5 bg-indigo-500 rounded-full animate-ping" />
            {status.toUpperCase()}
          </span>
        );
      case 'completed':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">Completed</span>;
      case 'stopped':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">Stopped</span>;
      case 'failed':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Failed</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Draft</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-indigo-600" />
            Red-Team Security Campaigns
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Automated multi-turn adversarial campaigns with AI attack generation, judging, and mutation loops.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create New Campaign
        </button>
      </div>

      {/* Campaign List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No campaigns launched yet</h3>
            <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
              Start an automated AI Red-Teaming Campaign to test your target model against adversarial attack prompts and mutation loops.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Launch First Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Campaign Name</th>
                  <th className="py-3.5 px-4">Target Model</th>
                  <th className="py-3.5 px-4">Mode / Provider</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Attacks / Done</th>
                  <th className="py-3.5 px-4 text-center">Success Rate</th>
                  <th className="py-3.5 px-4 text-center">Risk Level</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {campaigns.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-4 px-6 font-medium text-gray-900">
                      <div>{c.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{new Date(c.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-4 px-4 text-gray-600 font-mono text-xs">{c.targetModel}</td>
                    <td className="py-4 px-4">
                      <div className="text-xs font-semibold text-gray-700">{c.executionMode}</div>
                      <div className="text-xs text-indigo-600 capitalize">{c.provider}</div>
                    </td>
                    <td className="py-4 px-4 text-center">{getStatusBadge(c.status)}</td>
                    <td className="py-4 px-4 text-center font-mono">
                      <span className="text-emerald-600 font-bold">{c.successfulAttackCount}</span> / {c.completedEvaluationCount}
                    </td>
                    <td className="py-4 px-4 text-center font-semibold text-gray-700">
                      {c.attackSuccessRate}%
                    </td>
                    <td className="py-4 px-4 text-center">{getRiskBadge(c.riskLevel)}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => navigate(`/campaigns/${c._id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Campaign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-6 h-6 text-indigo-600" />
                Configure New Red-Team Campaign
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GPT-4 Safety & Jailbreak Benchmark"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target LLM Model *</label>
                <select
                  value={formData.targetModel}
                  onChange={e => setFormData({ ...formData, targetModel: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="gpt-4">GPT-4 (Target Model)</option>
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="llama-3.3-70b">Llama 3.3 70B</option>
                  <option value="custom-local-model">Custom Local Model</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Execution Mode</label>
                  <select
                    value={formData.executionMode}
                    onChange={e => setFormData({ ...formData, executionMode: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="EXTERNAL_API">EXTERNAL API (Free API Keys)</option>
                    <option value="LOCAL">LOCAL (Ollama)</option>
                    <option value="MOCK">MOCK (Deterministic $0 Fallback)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
                  <select
                    value={formData.provider}
                    onChange={e => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="gemini">Google Gemini (Recommended / Free)</option>
                    <option value="openrouter">OpenRouter (Free Tier Models)</option>
                    <option value="groq">Groq (Fast Free Tier)</option>
                    <option value="ollama">Ollama (Local Models)</option>
                    <option value="mock">Mock Fallback</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty Level</label>
                  <select
                    value={formData.difficulty}
                    onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Attack Count (1-50)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.requestedPromptCount}
                    onChange={e => setFormData({ ...formData, requestedPromptCount: parseInt(e.target.value) || 10 })}
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Attack Categories</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map(cat => (
                    <label
                      key={cat.id}
                      className={`flex items-center gap-2 p-2.5 border rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        formData.attackCategories.includes(cat.id)
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.attackCategories.includes(cat.id)}
                        onChange={() => handleCategoryToggle(cat.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      {cat.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  $0 Free Cost Guaranteed
                </div>
                <div>
                  This campaign will use your selected provider free tier. If no API key is provided in <code>.env</code>, it will automatically fall back to the deterministic mock engine without error.
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow flex items-center gap-2"
                >
                  {creating ? 'Launching...' : 'Start Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
