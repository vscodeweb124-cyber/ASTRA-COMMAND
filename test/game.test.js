const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../backend/services/game');

test('mission creation validates destination and initializes all supplies', async () => {
  await assert.rejects(game.createMission({ playerName: 'Nova', destination: 'Jupiter' }), /Moon or Mars/);
  const { id, resources, decisions, completed } = await game.createMission({ playerName: '  Captain   Nova ', destination: 'moon' });
  assert.ok(id);
  assert.deepEqual(resources, { oxygen: 82, water: 66, food: 78, power: 82, shielding: 58 });
  assert.deepEqual(decisions, []);
  assert.equal(completed, false);
});

test('each mission decision validates the next event and updates supplies', async () => {
  const mission = await game.createMission({ playerName: 'Nova', destination: 'mars' });
  const before = mission.resources.water;
  await assert.rejects(
    game.makeDecision(mission.id, { scenarioId: 'dust-storm', choiceId: 'conserve' }),
    /next event/
  );
  const result = await game.makeDecision(mission.id, { scenarioId: 'solar-storm', choiceId: 'shelter' });
  assert.equal(result.mission.resources.water, before - 8);
  assert.equal(result.mission.crewSafety, 98);
  assert.equal(result.mission.decisions.length, 1);
  assert.match(result.choice.explanation, /shelter/i);
});

test('panel cleaning applies the electricity gain to the shared power supply', async () => {
  const mission = await game.createMission({ playerName: 'Nova', destination: 'moon' });
  const result = await game.makeDecision(mission.id, { scenarioId: 'solar-storm', choiceId: 'delay' });
  const startingPower = result.mission.resources.power;
  const dustResult = await game.makeDecision(mission.id, { scenarioId: 'dust-storm', choiceId: 'clean-panels' });
  assert.equal(dustResult.mission.resources.power, Math.min(100, startingPower - 6 + 12));
});

test('completing six challenges produces a report and prevents extra decisions', async () => {
  const mission = await game.createMission({ playerName: 'Nova', destination: 'moon' });
  const scenarios = game.getScenarios();
  let result;
  for (const scenario of scenarios) {
    result = await game.makeDecision(mission.id, {
      scenarioId: scenario.id,
      choiceId: scenario.choices[0].id
    });
  }
  assert.equal(result.mission.completed, true);
  assert.equal(result.mission.decisions.length, 6);
  assert.ok(result.report.score >= 0 && result.report.score <= 100);
  assert.ok(result.report.achievements.includes('Mission Complete'));
  await assert.rejects(
    game.makeDecision(mission.id, { scenarioId: 'solar-storm', choiceId: 'shelter' }),
    /complete/
  );
});
