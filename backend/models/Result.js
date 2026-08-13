const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  evaluationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evaluation',
    required: true,
  },
  prompt: {
    type: String,
    required: true,
  },
  modelResponse: {
    type: String,
    required: true,
  },
  judgeResponse: {
    type: String,
    required: true,
  },
  metrics: {
    type: Object, // Could be detailed scores later
    default: {},
  },
  finalScore: {
    type: String,
    enum: ['Safe', 'Unsafe', 'Pass', 'Fail'],
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
