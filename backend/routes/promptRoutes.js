const router = require('express').Router();
const promptController = require('../controllers/promptController');

router.get('/', promptController.getPrompts);
router.get('/:id', promptController.getPromptById);
router.post('/', promptController.createPrompt);
router.put('/:id', promptController.updatePrompt);
router.delete('/:id', promptController.deletePrompt);

module.exports = router;
