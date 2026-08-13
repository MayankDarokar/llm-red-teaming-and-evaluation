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
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

module.exports = mongoose.model('Evaluation', evaluationSchema);
