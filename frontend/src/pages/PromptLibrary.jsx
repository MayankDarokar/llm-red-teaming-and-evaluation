import React, { useEffect, useState } from 'react';
import { getPrompts, createPrompt, deletePrompt } from '../api/prompts';
import { Plus, Trash2, Search, Filter, Eye, Copy, Check, Play, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PromptLibrary = () => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPromptDetail, setSelectedPromptDetail] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const [newPrompt, setNewPrompt] = useState({
    title: '',
    text: '',
    category: 'jailbreak',
    severity: 'medium',
    difficulty: 'Medium'
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchPrompts();
  }, [categoryFilter]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const data = await getPrompts({ category: categoryFilter || undefined, search: search || undefined });
      setPrompts(data);
    } catch (err) {
      console.error('Error fetching prompts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPrompts();
  };

  const handleAddPrompt = async (e) => {
    e.preventDefault();
    try {
      await createPrompt(newPrompt);
      setShowCreateModal(false);
      setNewPrompt({ title: '', text: '', category: 'jailbreak', severity: 'medium', difficulty: 'Medium' });
      fetchPrompts();
    } catch (err) {
      console.error('Error creating prompt:', err);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this prompt?')) return;
    try {
      await deletePrompt(id);
      if (selectedPromptDetail?._id === id) setSelectedPromptDetail(null);
      fetchPrompts();
    } catch (err) {
      console.error('Error deleting prompt:', err);
    }
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prompt Library</h1>
          <p className="text-gray-500">Manage and create adversarial red-teaming test prompts. Click any row to view full details.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm font-medium text-sm"
        >
          <Plus className="w-5 h-5" />
          <span>New Prompt</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search prompts by title or prompt text..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="jailbreak">Jailbreak</option>
            <option value="prompt-injection">Prompt Injection</option>
            <option value="harmful-content">Harmful Content</option>
            <option value="data-exfiltration">Data Exfiltration</option>
            <option value="bias">Bias</option>
            <option value="misinformation">Misinformation</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Prompts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title & Preview</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Difficulty</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                  Loading prompts...
                </td>
              </tr>
            ) : prompts.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No prompts found matching your search criteria.
                </td>
              </tr>
            ) : (
              prompts.map(p => (
                <tr
                  key={p._id}
                  onClick={() => setSelectedPromptDetail(p)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 flex items-center space-x-2">
                      <span>{p.title}</span>
                      <Eye className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xs text-gray-500 line-clamp-1 max-w-lg mt-1 font-mono">{p.text}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${
                      p.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      p.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      p.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {p.severity?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.difficulty}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => handleDelete(e, p._id)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1"
                      title="Delete Prompt"
                    >
                      <Trash2 className="w-5 h-5 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PROMPT DETAIL MODAL */}
      {selectedPromptDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden space-y-0">
            <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 uppercase">
                  {selectedPromptDetail.category}
                </span>
                <h3 className="text-lg font-bold text-gray-900">{selectedPromptDetail.title}</h3>
              </div>
              <button
                onClick={() => setSelectedPromptDetail(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-4 text-xs bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div>
                  <span className="text-gray-400 font-semibold uppercase block">Severity</span>
                  <span className="font-bold text-gray-800 uppercase">{selectedPromptDetail.severity}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold uppercase block">Difficulty</span>
                  <span className="font-bold text-gray-800">{selectedPromptDetail.difficulty}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold uppercase block">Source</span>
                  <span className="font-bold text-gray-800 capitalize">{selectedPromptDetail.source || 'Manual'}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Prompt Text</h4>
                  <button
                    onClick={() => handleCopyText(selectedPromptDetail.text)}
                    className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed border border-gray-800 shadow-inner">
                  {selectedPromptDetail.text}
                </div>
              </div>

              {selectedPromptDetail.tags?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPromptDetail.tags.map((tag, i) => (
                      <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-md font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedPromptDetail(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => navigate('/evaluation')}
                className="flex items-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Play className="w-4 h-4" />
                <span>Test Prompt in Evaluation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW PROMPT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-xl font-bold text-gray-800">Create New Prompt</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPrompt} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Grandma Napalm Jailbreak"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newPrompt.title}
                  onChange={e => setNewPrompt({ ...newPrompt, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newPrompt.category}
                    onChange={e => setNewPrompt({ ...newPrompt, category: e.target.value })}
                  >
                    <option value="jailbreak">Jailbreak</option>
                    <option value="prompt-injection">Prompt Injection</option>
                    <option value="harmful-content">Harmful Content</option>
                    <option value="data-exfiltration">Data Exfiltration</option>
                    <option value="bias">Bias</option>
                    <option value="misinformation">Misinformation</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newPrompt.severity}
                    onChange={e => setNewPrompt({ ...newPrompt, severity: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newPrompt.difficulty}
                    onChange={e => setNewPrompt({ ...newPrompt, difficulty: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Text</label>
                <textarea
                  required
                  rows="4"
                  placeholder="Enter the full adversarial prompt text here..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newPrompt.text}
                  onChange={e => setNewPrompt({ ...newPrompt, text: e.target.value })}
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Save Prompt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptLibrary;
