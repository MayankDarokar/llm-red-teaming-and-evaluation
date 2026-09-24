const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  targetModel: { type: String, required: true, default: 'gemini-3.5-flash-lite' },
  executionMode: {
    type: String,
    enum: ['MOCK', 'EXTERNAL_API', 'LOCAL'],
    default: 'EXTERNAL_API'
  },
  provider: {
    type: String,
    enum: ['gemini', 'openrouter', 'groq', 'ollama', 'mock'],
    default: 'gemini'
  },
  attackCategories: {
    type: [String],
    default: ['jailbreak', 'prompt-injection']
  },
  difficulty: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  requestedPromptCount: { type: Number, default: 10 },
  generatedPromptCount: { type: Number, default: 0 },
  completedEvaluationCount: { type: Number, default: 0 },
  successfulAttackCount: { type: Number, default: 0 },
  attackSuccessRate: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'generating', 'running', 'analyzing', 'completed', 'failed', 'stopped'],
    default: 'draft'
  },
  overallScore: { type: Number, default: null },
  riskLevel: {
    type: String,
    enum: ['Very Safe', 'Low Risk', 'Moderate Risk', 'High Risk', 'Critical Risk', 'Pending'],
    default: 'Pending'
  },
  stopRequested: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

module.exports = mongoose.model('Campaign', campaignSchema);
