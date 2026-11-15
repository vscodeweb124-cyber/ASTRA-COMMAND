const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../backend/services/game');

async function newMission(destination = 'moon') {
  return game.createMission({ playerName: 'System Tester', destination });
}

test('Moon and Mars have distinct supplies, hazard briefings, and communication delays', async () => {
  const moon = await newMission('moon');
  const mars = await newMission('mars');
  assert.notDeepEqual(moon.resources, mars.resources);
  assert.match(moon.communications.delayLabel, /1\.3 seconds/);
  assert.match(mars.communications.delayLabel, /12 minutes/);
  assert.ok(mars.destinationProfile.powerMinimum > moon.destinationProfile.powerMinimum);
  assert.notEqual(game.getScenarios('moon')[1].title, game.getScenarios('mars')[1].title);
});

test('solar briefing can use NASA observation status without treating it as a radiation dose', async () => {
  const mission = await newMission();
  const briefing = await game.getMissionBriefing(mission.id, async () => ({
    status: 'live',
    source: 'NASA DONKI CME API',
    events: [{ eventType: 'Coronal mass ejection', eventDate: '2026-11-14', note: 'NASA observation for the test.' }]
  }));
  assert.equal(briefing.status, 'live');
  assert.match(briefing.latestObservation.note, /NASA observation/);
  assert.match(briefing.note, /not a forecast/);
  assert.match(briefing.note, /not an astronaut radiation-dose measurement/);
});

test('hydroponic plants need water and garden-light credits before harvest', async () => {
  const mission = await newMission();
  await game.plantSeeds(mission.id, { count: 1 });
  await assert.rejects(
    game.advanceGardenDay(mission.id, { waterAllocation: 2, electricityAllocation: 2 }),
    /garden-light power/
  );
  await game.allocatePower(mission.id, {
    lifeSupport: 23, communication: 0, gardenLights: 6, scienceEquipment: 0
  });
  for (let day = 0; day < 3; day++) {
    await game.advanceGardenDay(mission.id, { waterAllocation: 2, electricityAllocation: 2 });
  }
  const result = await game.harvestGarden(mission.id);
  assert.equal(result.harvested, 1);
  assert.equal(result.foodAdded, 6);
  assert.equal(result.mission.resources.food, 84);
  assert.equal(result.mission.resources.water, 60);
  assert.equal(result.mission.garden.day, 3);
  assert.equal(result.mission.garden.lightCredits, 0);
  assert.equal(result.mission.garden.plants.length, 0);
});

test('power management enforces destination life support and budget limits', async () => {
  const mission = await newMission('mars');
  await assert.rejects(
    game.allocatePower(mission.id, { lifeSupport: 19, communication: 0, gardenLights: 0, scienceEquipment: 0 }),
    /at least 20/
  );
  await assert.rejects(
    game.allocatePower(mission.id, { lifeSupport: 20, communication: 20, gardenLights: 20, scienceEquipment: 20 }),
    /only 68 power units/
  );
  const result = await game.allocatePower(mission.id, {
    lifeSupport: 28, communication: 4, gardenLights: 8, scienceEquipment: 8
  });
  assert.equal(result.mission.resources.power, 20);
  assert.equal(result.mission.garden.lightCredits, 8);
  assert.equal(result.mission.communications.poweredPackets, 2);
  assert.equal(result.mission.scienceCredits, 2);
});

test('radiation shelter strategies use shared supplies and change only simulated risk', async () => {
  const mission = await newMission('moon');
  const result = await game.setRadiationStrategy(mission.id, { strategy: 'water' });
  assert.equal(result.resources.water, 58);
  assert.equal(result.resources.shielding, 72);
  assert.equal(result.radiation.riskIndex, 48);
  assert.equal(result.crewSafety, 87);
  assert.equal(result.radiation.dose, undefined);
  await assert.rejects(game.setRadiationStrategy(mission.id, { strategy: 'unlisted' }), /listed shielding strategy/);
});

test('communication messages need power, can be answered after simulated delay, and allow local decisions', async () => {
  const mission = await newMission('mars');
  await assert.rejects(game.sendMessage(mission.id, { message: 'Hello Earth' }), /Allocate electricity/);
  await game.allocatePower(mission.id, {
    lifeSupport: 20, communication: 2, gardenLights: 0, scienceEquipment: 0
  });
  let updated = await game.sendMessage(mission.id, { message: 'Water recycler checked.' });
  assert.equal(updated.communications.messages[0].status, 'in-transit');
  assert.match(updated.communications.messages[0].delayLabel, /12 minutes/);
  updated = await game.makeLocalCommunicationDecision(mission.id, { choice: 'act' });
  assert.equal(updated.crewSafety, 86);
  updated = await game.advanceCommunicationClock(mission.id);
  assert.equal(updated.communications.messages[0].status, 'replied');
  assert.match(updated.communications.messages[0].reply, /received your message/);
});
