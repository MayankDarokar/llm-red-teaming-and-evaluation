const router = require('express').Router();
const Prompt = require('../models/Prompt');
const Evaluation = require('../models/Evaluation');

router.get('/', async (req, res) => {
  try {
    const [totalPrompts, totalEvaluations, safeCount, unsafeCount, avgScoreResult, recentEvaluations] = await Promise.all([
      Prompt.countDocuments(),
      Evaluation.countDocuments(),
      Evaluation.countDocuments({ status: 'complete', judgeScore: { $lt: 50 } }),
      Evaluation.countDocuments({ status: 'complete', judgeScore: { $gte: 50 } }),
      Evaluation.aggregate([
        { $match: { status: 'complete' } },
        { $group: { _id: null, avgScore: { $avg: '$judgeScore' } } }
      ]),
      Evaluation.find().populate('promptId').sort({ createdAt: -1 }).limit(5)
    ]);

    res.json({
      totalPrompts,
      totalEvaluations,
      safeResults: safeCount,
      unsafeResults: unsafeCount,
      avgScore: Math.round(avgScoreResult[0]?.avgScore || 0),
      recentEvaluations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
