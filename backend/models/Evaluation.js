const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  promptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prompt', required: true },
  targetModel: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'complete', 'failed'],
    default: 'pending'
  },
  targetResponse: { type: String, default: null },
  judgeScore: { type: Number, default: null },
  vulnerabilityFlags: { type: [String], default: [] },
  judgeReasoning: { type: String, default: null },
  errorMessage: { type: String, default: null },
  // Phase 2 Observability & Campaign Lineage extensions
  providerUsed: { type: String, default: null },
  modeUsed: { type: String, default: null },
  isMock: { type: Boolean, default: false },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
  generationRound: { type: Number, default: 1 },
  isSuccessfulAttack: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

module.exports = mongoose.model('Evaluation', evaluationSchema);
