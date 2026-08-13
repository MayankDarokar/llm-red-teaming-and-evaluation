const router = require('express').Router();
const evaluationController = require('../controllers/evaluationController');

router.post('/run', evaluationController.runEvaluation);
router.get('/results', evaluationController.getEvaluations);
router.get('/:id', evaluationController.getEvaluationStatus);
router.get('/', evaluationController.getEvaluations);

module.exports = router;
