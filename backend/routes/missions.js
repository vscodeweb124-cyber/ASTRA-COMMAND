const express = require('express');
const game = require('../services/game');
const nasa = require('../services/nasa');
const router = express.Router();

router.get('/scenarios', (req, res, next) => {
  try { res.json({ scenarios: game.getScenarios(req.query.destination || 'moon') }); } catch (error) { next(error); }
});
router.get('/history', async (req, res, next) => {
  try { res.json({ missions: await game.getHistory() }); } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
  try { res.status(201).json({ mission: await game.createMission(req.body || {}) }); } catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try { res.json({ mission: await game.getMission(req.params.id) }); } catch (error) { next(error); }
});
router.get('/:id/briefing', async (req, res, next) => {
  try { res.json(await game.getMissionBriefing(req.params.id, nasa.getSpaceWeather)); } catch (error) { next(error); }
});
router.post('/:id/decisions', async (req, res, next) => {
  try { res.json(await game.makeDecision(req.params.id, req.body || {})); } catch (error) { next(error); }
});
router.post('/:id/garden/plant', async (req, res, next) => {
  try { res.json({ mission: await game.plantSeeds(req.params.id, req.body || {}) }); } catch (error) { next(error); }
});
router.post('/:id/garden/day', async (req, res, next) => {
  try { res.json(await game.advanceGardenDay(req.params.id, req.body || {}) ); } catch (error) { next(error); }
});
router.post('/:id/garden/harvest', async (req, res, next) => {
  try { res.json(await game.harvestGarden(req.params.id)); } catch (error) { next(error); }
});
router.post('/:id/power', async (req, res, next) => {
  try { res.json(await game.allocatePower(req.params.id, req.body || {})); } catch (error) { next(error); }
});
router.post('/:id/radiation', async (req, res, next) => {
  try { res.json({ mission: await game.setRadiationStrategy(req.params.id, req.body || {}) }); } catch (error) { next(error); }
});
router.post('/:id/communications/messages', async (req, res, next) => {
  try { res.status(201).json({ mission: await game.sendMessage(req.params.id, req.body || {}) }); } catch (error) { next(error); }
});
router.post('/:id/communications/advance', async (req, res, next) => {
  try { res.json({ mission: await game.advanceCommunicationClock(req.params.id) }); } catch (error) { next(error); }
});
router.post('/:id/communications/decision', async (req, res, next) => {
  try { res.json({ mission: await game.makeLocalCommunicationDecision(req.params.id, req.body || {}) }); } catch (error) { next(error); }
});

module.exports = router;
