import React, { useEffect, useState } from 'react';
import { getStats } from '../api/stats';
import { FileText, PlayCircle, AlertTriangle, ShieldCheck, Activity, Eye, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalPrompts: 0,
    totalEvaluations: 0,
    safeResults: 0,
    unsafeResults: 0,
    avgScore: 0,
    recentEvaluations: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedEvalDetail, setSelectedEvalDetail] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (statusStr) => {
    const s = (statusStr || '').toLowerCase();
    if (s.startsWith('complete')) {
      return (
        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200 uppercase">
          COMPLETE
        </span>
      );
    }
    if (s === 'failed') {
      return (
        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200 uppercase">
          FAILED
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase">
        {s || 'PENDING'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Real-time safety metrics and LLM evaluation telemetry. Click any recent evaluation for full detail.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Prompts" value={stats.totalPrompts} icon={<FileText className="w-7 h-7 text-blue-600" />} color="blue" />
        <StatCard title="Evaluations Run" value={stats.totalEvaluations} icon={<PlayCircle className="w-7 h-7 text-purple-600" />} color="purple" />
        <StatCard title="Safe Responses" value={stats.safeResults} icon={<ShieldCheck className="w-7 h-7 text-green-600" />} color="green" />
        <StatCard title="Vulnerabilities Found" value={stats.unsafeResults} icon={<AlertTriangle className="w-7 h-7 text-red-600" />} color="red" />
      </div>

      {/* Secondary Risk Index Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-lg">System Health & Risk Index</h3>
          </div>
          <p className="text-blue-200 text-xs mt-1">Average Vulnerability Failure Score across completed evaluations</p>
        </div>
        <div className="flex items-baseline space-x-2 bg-white/10 px-5 py-2.5 rounded-lg backdrop-blur-sm">
          <span className="text-3xl font-extrabold text-white">{stats.avgScore}</span>
          <span className="text-xs text-blue-200 uppercase font-semibold">/ 100 Risk Rating</span>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">Recent Evaluations</h2>
          <Link to="/results" className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center space-x-1">
            <span>View All Results</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
            Loading activity...
          </div>
        ) : stats.recentEvaluations?.length === 0 ? (
          <div className="text-gray-500 py-8 text-center text-sm">
            No evaluations run yet. Go to <Link to="/evaluation" className="text-blue-600 underline">Evaluation</Link> to test your first prompt!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Prompt Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Target Model</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Score</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentEvaluations.map(ev => (
                  <tr
                    key={ev._id}
                    onClick={() => setSelectedEvalDetail(ev)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors text-sm group"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900 group-hover:text-blue-600 flex items-center space-x-2">
                      <span>{ev.promptId?.title || 'Adversarial Prompt Test'}</span>
                      <Eye className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{ev.targetModel}</td>
                    <td className="px-4 py-3">
                      {getStatusBadge(ev.status)}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {ev.judgeScore !== null && ev.judgeScore !== undefined ? (
                        <span className={ev.judgeScore >= 50 ? 'text-red-600' : 'text-green-600'}>
                          {ev.judgeScore}/100 ({ev.judgeScore >= 50 ? 'UNSAFE' : 'SAFE'})
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {new Date(ev.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FULL EVALUATION DETAIL MODAL OVERLAY */}
      {selectedEvalDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden space-y-0">
            <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedEvalDetail.promptId?.title || 'Adversarial Prompt Evaluation Details'}
                  </h3>
                  {getStatusBadge(selectedEvalDetail.status)}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Target Model: <span className="font-semibold text-gray-700">{selectedEvalDetail.targetModel}</span> | Date: {new Date(selectedEvalDetail.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvalDetail(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Score Header */}
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">AI Safety Judge Score</span>
                  <span className={`text-2xl font-black ${
                    (selectedEvalDetail.judgeScore ?? 0) >= 50 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {selectedEvalDetail.judgeScore ?? 'N/A'}/100 ({(selectedEvalDetail.judgeScore ?? 0) >= 50 ? 'UNSAFE FAILURE' : 'SAFE PASS'})
                  </span>
                </div>
                {selectedEvalDetail.vulnerabilityFlags?.length > 0 && (
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Vulnerability Flags</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {selectedEvalDetail.vulnerabilityFlags.map((flag, idx) => (
                        <span key={idx} className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded font-mono font-medium">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Prompt vs Response Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Adversarial Prompt Sent</h4>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed border border-gray-800 max-h-56 overflow-y-auto">
                    {selectedEvalDetail.promptId?.text || selectedEvalDetail.prompt || 'N/A'}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Model Response</h4>
                  <div className={`p-4 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed border max-h-56 overflow-y-auto ${
                    (selectedEvalDetail.judgeScore ?? 0) >= 50 ? 'bg-red-50 text-red-950 border-red-200' : 'bg-green-50 text-green-950 border-green-200'
                  }`}>
                    {selectedEvalDetail.targetResponse || selectedEvalDetail.errorMessage || 'No response recorded.'}
                  </div>
                </div>
              </div>

              {/* Judge Reasoning */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">AI Judge Safety Reasoning</h4>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {selectedEvalDetail.judgeReasoning || 'No judge reasoning available.'}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedEvalDetail(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => navigate('/results')}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <span>Go to Results Page</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4 hover:shadow-md transition-shadow">
    <div className={`p-3.5 rounded-lg bg-${color}-50`}>{icon}</div>
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
      <p className="text-3xl font-extrabold text-gray-900 mt-0.5">{value}</p>
    </div>
  </div>
);

export default Dashboard;
