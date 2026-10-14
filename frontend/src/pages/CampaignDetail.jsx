import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCampaignById, getCampaignMetrics, getCampaignResults, stopCampaign } from '../api/campaigns';
import { ArrowLeft, Square, CheckCircle2, GitBranch, RefreshCw, AlertTriangle, Layers, Download, FileText } from 'lucide-react';
import { buildLineageTrees } from '../utils/lineage';
import { downloadHtmlReport, exportPdfReport } from '../utils/reportGenerator';

// Recursive component for rendering mutation nodes across multiple generations (Round 2 -> Round 3 -> ...)
const LineageNode = ({ node, depth = 1 }) => {
  const { evaluation, children } = node;
  const p = evaluation.promptId;
  const round = evaluation.generationRound || p?.generationRound || depth + 1;
  const isSuccessful = evaluation.isSuccessfulAttack;

  const bgStyles = [
    'bg-indigo-50/40 border-indigo-200',
    'bg-purple-50/40 border-purple-200',
    'bg-violet-50/40 border-violet-200'
  ];
  const borderStyles = [
    'border-indigo-300',
    'border-purple-300',
    'border-violet-300'
  ];
  const textStyles = [
    'text-indigo-900',
    'text-purple-900',
    'text-violet-900'
  ];

  const currentBg = bgStyles[Math.min(depth - 1, bgStyles.length - 1)];
  const currentBorder = borderStyles[Math.min(depth - 1, borderStyles.length - 1)];
  const currentText = textStyles[Math.min(depth - 1, textStyles.length - 1)];

  return (
    <div className={`${currentBg} border rounded-lg p-3 space-y-2`}>
      <div className="flex justify-between items-center text-xs">
        <span className={`font-bold ${currentText}`}>
          Round {round} ({p?.mutationType || 'AI Mutation'})
        </span>
        <span className={`font-bold ${isSuccessful ? 'text-rose-600' : (evaluation.status === 'failed' ? 'text-amber-600' : 'text-emerald-600')}`}>
          Score: {evaluation.judgeScore !== null && evaluation.judgeScore !== undefined ? evaluation.judgeScore : 'N/A'}/100 {evaluation.status === 'failed' ? '(Failed)' : ''}
        </span>
      </div>
      <p className="text-xs text-gray-800 bg-white p-2 rounded border font-mono">
        "{p?.text || 'N/A'}"
      </p>
      {evaluation.judgeReasoning && (
        <p className={`text-xs ${currentText} italic`}>
          Judge: {evaluation.judgeReasoning}
        </p>
      )}

      {/* Render deeper descendant mutations (Round 3, Round 4, etc.) */}
      {children && children.length > 0 && (
        <div className={`pl-4 border-l-2 ${currentBorder} space-y-2 mt-2`}>
          <div className="text-xs font-semibold text-gray-600 flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5" /> Mutated Evolution (Round {round + 1})
          </div>
          {children.map(childNode => (
            <LineageNode
              key={childNode.evaluation._id || childNode.evaluation.promptId?._id}
              node={childNode}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('findings'); // 'findings' | 'lineage' | 'categories'

  useEffect(() => {
    fetchData();

    // Auto Polling every 2.5s if campaign is active
    const interval = setInterval(() => {
      if (campaign && (campaign.status === 'generating' || campaign.status === 'running' || campaign.status === 'analyzing')) {
        fetchData();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [id, campaign?.status]);

  const fetchData = async () => {
    try {
      const [cData, mData, rData] = await Promise.all([
        getCampaignById(id),
        getCampaignMetrics(id),
        getCampaignResults(id)
      ]);
      setCampaign(cData);
      setMetrics(mData);
      setResults(rData);
    } catch (err) {
      console.error('Failed to fetch campaign details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      await stopCampaign(id);
      fetchData();
    } catch (err) {
      alert(`Failed to stop campaign: ${err.message}`);
    }
  };

  const handleExportHtml = () => {
    if (!campaign) return;
    try {
      downloadHtmlReport({ campaign, results, metrics });
    } catch (err) {
      alert(`Export HTML failed: ${err.message}`);
    }
  };

  const handleExportPdf = () => {
    if (!campaign) return;
    try {
      exportPdfReport({ campaign, results, metrics });
    } catch (err) {
      alert(`Export PDF failed: ${err.message}`);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running':
      case 'generating':
      case 'analyzing':
        return (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 animate-pulse border border-indigo-200">
            <span className="w-1.5 h-1.5 mr-1.5 bg-indigo-500 rounded-full animate-ping" />
            {status ? status.toUpperCase() : 'ACTIVE'}
          </span>
        );
      case 'completed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Completed</span>;
      case 'stopped':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">Stopped</span>;
      case 'failed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">Failed</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-200">Draft</span>;
    }
  };

  const getRiskBadge = (riskLevel) => {
    switch (riskLevel) {
      case 'Critical Risk':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200">Critical Risk</span>;
      case 'High Risk':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-800 border border-orange-200">High Risk</span>;
      case 'Moderate Risk':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Moderate Risk</span>;
      case 'Low Risk':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Low Risk</span>;
      case 'Very Safe':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200">Very Safe</span>;
      default:
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-700">Pending</span>;
    }
  };

  if (loading && !campaign) {
    return <div className="p-8 text-center text-gray-500">Loading campaign assessment...</div>;
  }

  if (!campaign) {
    return <div className="p-8 text-center text-red-500">Campaign not found</div>;
  }

  const isRunning = campaign.status === 'generating' || campaign.status === 'running' || campaign.status === 'analyzing';

  // Build multi-generational lineage trees (Round 1 -> Round 2 -> Round 3)
  const { rootNodes, orphanedNodes } = buildLineageTrees(results);

  return (
    <div className="space-y-6">
      {/* Header & Control Bar */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/campaigns')}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {campaign.name}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">{campaign.description || 'Automated AI Red-Teaming Campaign'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportHtml}
              disabled={!campaign}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 shadow-sm transition-colors"
              title="Download self-contained HTML audit report"
            >
              <Download className="w-4 h-4 text-gray-500" />
              Export HTML
            </button>
            <button
              onClick={handleExportPdf}
              disabled={!campaign}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
              title="Open printable report to Save as PDF"
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              Export PDF
            </button>

            {isRunning && (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop Campaign
              </button>
            )}
            <button
              onClick={fetchData}
              className="p-2 border hover:bg-gray-50 rounded-lg text-gray-600"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Configuration Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs font-medium">
          <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md font-mono">
            Target: <strong>{campaign.targetModel}</strong>
          </span>
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md">
            Mode: <strong>{campaign.executionMode}</strong>
          </span>
          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md capitalize">
            Provider: <strong>{campaign.provider}</strong>
          </span>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md">
            Difficulty: <strong>{campaign.difficulty}</strong>
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 font-semibold text-[11px] uppercase tracking-wider">Status:</span>
              {getStatusBadge(campaign.status)}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 font-semibold text-[11px] uppercase tracking-wider">Risk:</span>
              {getRiskBadge(campaign.riskLevel)}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase">Generated Attacks</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-2">{campaign.generatedPromptCount}</div>
          <div className="text-xs text-gray-400 mt-1">Requested: {campaign.requestedPromptCount}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase">Evaluations Completed</div>
          <div className="text-3xl font-extrabold text-indigo-600 mt-2">{campaign.completedEvaluationCount}</div>
          <div className="text-xs text-gray-400 mt-1">Status: {campaign.status.toUpperCase()}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase">Successful Attacks</div>
          <div className="text-3xl font-extrabold text-rose-600 mt-2">{campaign.successfulAttackCount}</div>
          <div className="text-xs text-rose-500 font-semibold mt-1">Success Rate: {campaign.attackSuccessRate}%</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-medium text-gray-500 uppercase">Overall Risk Score</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-2">
            {campaign.overallScore !== null && campaign.overallScore !== undefined
              ? `${campaign.overallScore}/100`
              : (isRunning ? 'Evaluating...' : 'N/A')}
          </div>
          <div className="text-xs text-gray-500 mt-1">0 = Safe | 100 = Critical</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b bg-gray-50 px-4">
          <button
            onClick={() => setActiveTab('findings')}
            className={`py-3.5 px-5 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'findings'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Attack Findings & Logs ({results.length})
          </button>
          <button
            onClick={() => setActiveTab('lineage')}
            className={`py-3.5 px-5 font-semibold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'lineage'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            Attack Mutation Lineage
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3.5 px-5 font-semibold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'categories'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            Category Breakdown
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: ATTACK FINDINGS */}
          {activeTab === 'findings' && (
            <div className="space-y-4">
              {results.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No evaluation results recorded yet.</div>
              ) : (
                results.map((item, idx) => (
                  <div
                    key={item._id}
                    className={`border rounded-xl p-4 transition-all ${
                      item.isSuccessfulAttack
                        ? 'border-rose-200 bg-rose-50/30'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">
                            {item.promptId?.title || `Attack #${idx + 1}`}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                            Round {item.generationRound || 1}
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded capitalize">
                            {item.promptId?.category || 'General'}
                          </span>
                          {item.promptId?.mutationType && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded">
                              Mutated: {item.promptId.mutationType}
                            </span>
                          )}
                          {item.providerUsed && (
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              item.isMock ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {item.isMock ? `Mock (${item.providerUsed})` : `Real ${item.providerUsed}`}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          Technique: {item.promptId?.technique || 'direct'}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-sm font-extrabold ${item.status === 'failed' ? 'text-amber-600' : (item.judgeScore >= 60 ? 'text-rose-600' : 'text-emerald-600')}`}>
                          Score: {item.judgeScore !== null ? item.judgeScore : 'N/A'}/100
                        </span>
                        <div>
                          {item.status === 'failed' ? (
                            <span className="text-xs font-bold text-amber-600 flex items-center gap-1 justify-end">
                              <AlertTriangle className="w-3.5 h-3.5" /> Evaluation Failed
                            </span>
                          ) : item.isSuccessfulAttack ? (
                            <span className="text-xs font-bold text-rose-600 flex items-center gap-1 justify-end">
                              <AlertTriangle className="w-3.5 h-3.5" /> Successful Attack
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 justify-end">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Target Remained Safe
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Prompts & Responses */}
                    <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="font-semibold text-gray-700 mb-1">Adversarial Prompt:</div>
                        <p className="text-gray-800 whitespace-pre-wrap">{item.promptId?.text || 'N/A'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="font-semibold text-gray-700 mb-1">Target Response:</div>
                        <p className="text-gray-800 whitespace-pre-wrap">{item.targetResponse || item.errorMessage || 'Pending response...'}</p>
                      </div>
                    </div>

                    {/* Judge Reasoning */}
                    {item.judgeReasoning && (
                      <div className="mt-2 text-xs bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 text-indigo-900">
                        <strong>AI Judge Finding:</strong> {item.judgeReasoning}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: ATTACK MUTATION LINEAGE */}
          {activeTab === 'lineage' && (
            <div className="space-y-6">
              <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <GitBranch className="w-5 h-5 inline text-indigo-600 mr-2" />
                This tree displays how successful attacks were automatically mutated by the AI engine across multiple rounds to bypass safety mechanisms.
              </div>

              {rootNodes.length === 0 && orphanedNodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No attack lineage recorded yet.</div>
              ) : (
                <>
                  {rootNodes.map((rootNode) => {
                    const r1 = rootNode.evaluation;
                    const children = rootNode.children;

                    return (
                      <div key={r1._id} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-800 text-white font-mono text-xs rounded font-semibold">
                              Round 1 (Initial Attack)
                            </span>
                            <span className="font-bold text-gray-900 text-sm">
                              {r1.promptId?.title || 'Initial Attack'}
                            </span>
                          </div>
                          <span className={`text-xs font-bold ${r1.isSuccessfulAttack ? 'text-rose-600' : (r1.status === 'failed' ? 'text-amber-600' : 'text-emerald-600')}`}>
                            Score: {r1.judgeScore !== null && r1.judgeScore !== undefined ? r1.judgeScore : 'N/A'}/100 {r1.status === 'failed' ? '(Evaluation Failed)' : (r1.isSuccessfulAttack ? '(Triggered Mutation)' : '(Safely Refused)')}
                          </span>
                        </div>

                        <div className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border font-mono">
                          "{r1.promptId?.text || 'N/A'}"
                        </div>

                        {/* Render Children Mutated Attacks (Round 2+) */}
                        {children.length > 0 && (
                          <div className="pl-6 border-l-2 border-indigo-300 space-y-3 mt-3">
                            <div className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
                              <GitBranch className="w-3.5 h-3.5" /> Mutated Evolution (Round 2+)
                            </div>

                            {children.map(childNode => (
                              <LineageNode
                                key={childNode.evaluation._id || childNode.evaluation.promptId?._id}
                                node={childNode}
                                depth={1}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Render any orphaned mutations whose parents are missing */}
                  {orphanedNodes.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-dashed border-amber-300">
                      <div className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Disconnected / Orphaned Mutations ({orphanedNodes.length})
                      </div>
                      {orphanedNodes.map(orphanNode => (
                        <div key={orphanNode.evaluation._id} className="border border-amber-200 rounded-xl p-4 bg-amber-50/20 space-y-3">
                          <LineageNode node={orphanNode} depth={orphanNode.evaluation.generationRound || 2} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: CATEGORY BREAKDOWN */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              {!metrics || !metrics.categoryBreakdown ? (
                <div className="text-center py-8 text-gray-500">No category breakdown calculated yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-center">Total Tests</th>
                        <th className="py-3 px-4 text-center">Successful Attacks</th>
                        <th className="py-3 px-4 text-center">Success Rate</th>
                        <th className="py-3 px-4 text-center">Average Score</th>
                        <th className="py-3 px-4 text-center">Category Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm">
                      {metrics.categoryBreakdown.map(cat => (
                        <tr key={cat.category} className="hover:bg-gray-50/80">
                          <td className="py-3.5 px-4 font-bold text-gray-900 capitalize">{cat.category}</td>
                          <td className="py-3.5 px-4 text-center font-mono">{cat.totalTests}</td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-600">{cat.successfulAttacks}</td>
                          <td className="py-3.5 px-4 text-center font-semibold text-gray-800">{cat.successRate}%</td>
                          <td className="py-3.5 px-4 text-center font-mono">
                            {cat.avgScore !== null && cat.avgScore !== undefined ? `${cat.avgScore}/100` : 'N/A'}
                          </td>
                          <td className="py-3.5 px-4 text-center">{getRiskBadge(cat.riskLevel)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;
