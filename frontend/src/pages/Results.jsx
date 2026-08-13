import React, { useEffect, useState } from 'react';
import { getResults } from '../api/evaluations';
import { ShieldCheck, AlertTriangle, Clock, RefreshCw } from 'lucide-react';

const Results = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const data = await getResults();
      setResults(data);
    } catch (err) {
      console.error('Error loading results:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evaluation Results</h1>
          <p className="text-gray-500">Review outcomes, model responses, and AI judge evaluations across testing sessions.</p>
        </div>
        <button
          onClick={fetchResults}
          className="flex items-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-sm transition-colors shadow-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p>Fetching evaluation logs...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center text-gray-500">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-700">No Evaluation History Found</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
              Navigate to the Evaluation page to launch red-teaming tests against target models.
            </p>
          </div>
        ) : (
          results.map(result => {
            const isSafe = result.finalScore === 'Safe' || (result.score !== null && result.score < 50);
            const statusStr = (result.status || 'complete').toLowerCase();
            const isComplete = statusStr.startsWith('complete');

            return (
              <div key={result._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-gray-100 bg-gray-50/50 gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {result.evaluationId?.promptId?.title || 'Adversarial Prompt Test'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">Model: {result.evaluationId?.model || 'Target AI'}</span>
                      <span>•</span>
                      <span>Date: {new Date(result.createdAt).toLocaleString()}</span>
                      {result.evaluationId?.promptId?.category && (
                        <>
                          <span>•</span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                            {result.evaluationId.promptId.category}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {result.score !== null && result.score !== undefined && (
                      <div className="text-right">
                        <span className="text-xs text-gray-500 uppercase block font-semibold">Safety Score</span>
                        <span className="text-lg font-black text-gray-800">{result.score}/100</span>
                      </div>
                    )}
                    <div className={`flex items-center px-3.5 py-1.5 rounded-lg text-sm font-bold shadow-sm ${
                      isSafe ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {isSafe ? <ShieldCheck className="w-5 h-5 mr-1.5 text-green-700" /> : <AlertTriangle className="w-5 h-5 mr-1.5 text-red-700" />}
                      <span>{isSafe ? 'Safe' : 'Unsafe'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Prompt Sent</h4>
                    <div className="bg-gray-50 p-4 rounded-lg text-gray-800 font-mono text-xs whitespace-pre-wrap border border-gray-200 max-h-48 overflow-y-auto">
                      {result.prompt}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Model Response</h4>
                    <div className={`p-4 rounded-lg text-gray-800 font-mono text-xs whitespace-pre-wrap border max-h-48 overflow-y-auto ${
                      isSafe ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'
                    }`}>
                      {result.modelResponse}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">AI Judge Assessment</h4>
                    <p className="text-xs text-gray-700">{result.judgeResponse}</p>
                  </div>

                  {result.vulnerabilityFlags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center flex-shrink-0">
                      <span className="text-xs font-bold text-gray-400 uppercase mr-1">Flags:</span>
                      {result.vulnerabilityFlags.map((flag, idx) => (
                        <span key={idx} className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded font-mono font-medium">
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Results;
