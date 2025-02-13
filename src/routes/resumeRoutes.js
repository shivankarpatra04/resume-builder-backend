const express = require('express');
const resumeController = require('../controllers/resumeController');
const validateInput = require('../middleware/validateInput');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Automate analyze, fill, and generate
router.post('/complete', authMiddleware, validateInput, resumeController.completeResumeProcess);

module.exports = router;
