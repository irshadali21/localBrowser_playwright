const express = require('express');
const router = express.Router();
const { reportError } = require('../controllers/errorController');

router.post('/report', reportError);

module.exports = router;
