const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
  title: { type: String, required: true },
  text: { type: String, required: true },
  category: {
    type: String,
    enum: ['jailbreak', 'prompt-injection', 'harmful-content', 'data-exfiltration', 'bias', 'misinformation', 'other'],
    required: true,
    default: 'jailbreak'
  },
  tags: { type: [String], default: [] },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  difficulty: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  source: {
    type: String,
    enum: ['manual', 'imported', 'generated'],
    default: 'manual'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prompt', promptSchema);
