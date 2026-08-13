const Prompt = require('../models/Prompt');

// GET /api/prompts
exports.getPrompts = async (req, res) => {
  try {
    const { category, severity, search } = req.query;
    let query = {};

    if (category) query.category = category;
    if (severity) query.severity = severity;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { text: { $regex: search, $options: 'i' } }
      ];
    }

    const prompts = await Prompt.find(query).sort({ createdAt: -1 });
    res.json(prompts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/prompts/:id
exports.getPromptById = async (req, res) => {
  try {
    const prompt = await Prompt.findById(req.params.id);
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    res.json(prompt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/prompts
exports.createPrompt = async (req, res) => {
  try {
    const { title, text, prompt, category, tags, severity, difficulty, source } = req.body;
    const newPrompt = await Prompt.create({
      title: title || 'Untitled Prompt',
      text: text || prompt || '',
      category: category || 'jailbreak',
      tags: tags || [],
      severity: severity || 'medium',
      difficulty: difficulty || 'Medium',
      source: source || 'manual'
    });
    res.status(201).json(newPrompt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/prompts/:id
exports.updatePrompt = async (req, res) => {
  try {
    const updated = await Prompt.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Prompt not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/prompts/:id
exports.deletePrompt = async (req, res) => {
  try {
    const deleted = await Prompt.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Prompt not found' });
    res.json({ message: 'Prompt deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
