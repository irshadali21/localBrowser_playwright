const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');

router.get('/list', pageController.list);
router.post('/request', pageController.request);

router.post('/close', pageController.close);

module.exports = router;
