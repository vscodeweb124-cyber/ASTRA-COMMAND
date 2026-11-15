const express = require('express');
const nasa = require('../services/nasa');
const router = express.Router();

router.get('/apod', async (req, res, next) => {
  try { res.json(await nasa.getApod()); } catch (error) { next(error); }
});
router.get(['/space-weather', '/donki'], async (req, res, next) => {
  try { res.json(await nasa.getSpaceWeather()); } catch (error) { next(error); }
});

module.exports = router;
