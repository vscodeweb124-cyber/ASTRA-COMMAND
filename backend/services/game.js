const { randomUUID } = require('node:crypto');
const db = require('../database');

const scenarios = [
  {
    id: 'solar-storm',
    title: 'Solar-weather shelter practice',
    type: 'Radiation safety exercise',
    description: 'Practice your shelter plan for a possible solar-weather event. NASA observations can teach us about the Sun, but they are not a local danger alarm.',
    science: 'Solar activity observations do not measure radiation dose inside an outpost. A planned shelter can help protect a crew.',
    choices: [
      { id: 'shelter', label: 'Move the crew into the water-shielded shelter', effects: { water: -8, power: -3, safety: 16, science: 8 }, explanation: 'Great sheltering! Stored water adds shielding. It protects the crew, but uses some supplies.' },
      { id: 'outside', label: 'Continue the outdoor science walk', effects: { oxygen: -2, safety: -22, science: 12 }, explanation: 'You collected useful samples, but unprotected time outside during a storm is risky.' },
      { id: 'delay', label: 'Pause outdoor work and monitor radiation', effects: { power: -2, safety: 10, science: 3 }, explanation: 'A careful choice. Monitoring uses power, but keeps everyone away from the worst radiation.' }
    ]
  },
  {
    id: 'dust-storm',
    title: 'Dust is covering the solar panels',
    type: 'Dust storm',
    description: 'A dusty gust is blocking sunlight. The habitat is still safe, but its power supply is shrinking.',
    science: 'Solar panels turn sunlight into electricity. Dust can block sunlight and make less power.',
    choices: [
      { id: 'clean-panels', label: 'Send a rover to brush the panels', effects: { power: -9, oxygen: -2, electricity: 18, safety: -2, science: 7 }, explanation: 'The rover clears the panels and restores power, at the cost of energy and a small outdoor risk.' },
      { id: 'conserve', label: 'Save power until the storm passes', effects: { power: 3, safety: 4, food: -2 }, explanation: 'Saving energy protects the habitat. A little fresh food is lost while the growing lights are dimmed.' },
      { id: 'battery', label: 'Switch on the backup battery', effects: { power: -3, electricity: 9, safety: 8 }, explanation: 'Backup power keeps important systems running, but spare batteries are limited.' }
    ]
  },
  {
    id: 'water-shortage',
    title: 'Water is running low',
    type: 'Water shortage',
    description: 'A leak has been found in the water recycler. Decide how to keep the crew supplied.',
    science: 'A recycler cleans used water. Reusing water helps outposts live far away from Earth.',
    choices: [
      { id: 'repair', label: 'Use repair supplies to fix the recycler', effects: { power: -5, water: 14, science: 9, safety: 3 }, explanation: 'Fixing the recycler takes electricity, but safely recovers water for future days.' },
      { id: 'ration', label: 'Carefully ration water today', effects: { water: 6, safety: -4, food: -1 }, explanation: 'Rationing saves water now, but being thirsty can make the crew less comfortable.' },
      { id: 'reserve', label: 'Open the emergency water reserve', effects: { water: 11, power: -1, safety: 4 }, explanation: 'The reserve protects the crew. Keeping emergency supplies ready takes a little power.' }
    ]
  },
  {
    id: 'power-failure',
    title: 'The habitat power is failing',
    type: 'Power failure',
    description: 'A circuit is overheating. Some habitat systems need to be switched off while the crew fixes it.',
    science: 'Electricity powers lights, air pumps, computers, and science tools.',
    choices: [
      { id: 'critical', label: 'Protect life support; pause science equipment', effects: { power: 12, science: -2, safety: 9 }, explanation: 'Life support comes first. You save power and keep the crew safe, even though science slows down.' },
      { id: 'repair-now', label: 'Have the crew repair the circuit together', effects: { oxygen: -3, power: 8, science: 5, safety: -3 }, explanation: 'Teamwork restores power and teaches the crew about the habitat, but repairs take effort.' },
      { id: 'restart', label: 'Restart every system at once', effects: { power: -8, safety: -9, science: 4 }, explanation: 'A full restart uses extra power and might overload the damaged circuit again.' }
    ]
  },
  {
    id: 'food-problem',
    title: 'The garden lights stopped working',
    type: 'Food growing',
    description: 'Your plants need light to grow. Pick a plan to protect this week’s harvest.',
    science: 'Plants use light and water to make food. Growing food nearby means fewer supplies from Earth.',
    choices: [
      { id: 'repair-lights', label: 'Repair the lights before the next growing cycle', effects: { power: -6, food: 12, science: 9 }, explanation: 'A quick repair restores the plants’ light and gives the garden time to grow.' },
      { id: 'share', label: 'Share stored food while plants recover', effects: { food: -3, safety: 5, science: 3 }, explanation: 'Sharing the pantry keeps meals fair and gives the garden time to recover.' },
      { id: 'more-water', label: 'Give plants extra water and wait', effects: { water: -8, food: 5, science: 3, safety: -2 }, explanation: 'Water helps plants, but it cannot replace sunlight when the growing lights are off.' }
    ]
  },
  {
    id: 'communication-delay',
    title: 'Earth is taking a long time to answer',
    type: 'Communication delay',
    description: 'Your message to mission control is still traveling. Space is so big that radio messages take time.',
    science: 'Radio waves carry messages through space. The Moon is close to Earth; Mars is much farther away.',
    choices: [
      { id: 'autonomous', label: 'Use your crew’s training and decide locally', effects: { power: -2, safety: 7, science: 7 }, explanation: 'Excellent independence! Crews far from Earth need to make safe choices while messages travel.' },
      { id: 'wait', label: 'Wait for Earth before making a decision', effects: { oxygen: -4, power: -3, safety: -5 }, explanation: 'Waiting can use air and power. Faraway crews cannot always wait for an answer.' },
      { id: 'relay', label: 'Send a short emergency message through the relay', effects: { power: -5, science: 2, safety: 3 }, explanation: 'A relay may help your message travel, but sending more messages uses power.' }
    ]
  }
];

const destinationResources = {
  moon: { oxygen: 82, water: 66, food: 78, power: 82, shielding: 58 },
  mars: { oxygen: 78, water: 78, food: 70, power: 68, shielding: 72 }
};
const clamp = (value) => Math.max(0, Math.min(100, value));
const cleanName = (value) => value.trim().replace(/\s+/g, ' ');
const getCrewSafety = (mission) => clamp(mission.crewSafety ?? Math.round(
  (mission.resources.oxygen + mission.resources.water + mission.resources.shielding) / 3
));
const memory = new Map();

function validateDestination(value) {
  return ['moon', 'mars'].includes(value);
}

function initializeSystems(mission) {
  mission.destinationProfile ||= mission.destination === 'moon'
    ? { environment: 'Lunar dust can cling to equipment; the Moon has no thick atmosphere to block space radiation.', powerMinimum: 15 }
    : { environment: 'A thin atmosphere, weaker sunlight, and planet-wide dust storms can challenge power planning.', powerMinimum: 20 };
  mission.garden ||= { day: 0, seeds: 8, plants: [], harvestedPlants: 0, waterSpent: 0, powerSpent: 0, lightCredits: 0, log: [] };
  mission.powerLog ||= [];
  mission.radiation ||= { riskIndex: mission.destination === 'moon' ? 62 : 52, strategy: 'unprepared', actions: [] };
  mission.communications ||= {
    messages: [],
    localDecisions: [],
    poweredPackets: 0,
    roundTripSeconds: mission.destination === 'moon' ? 2.6 : 1440,
    delayLabel: mission.destination === 'moon' ? 'about 1.3 seconds one way' : '12 minutes one way (simulated)'
  };
  mission.scienceCredits ||= 0;
  mission.smartChoices ||= 0;
  return mission;
}

function calculateScore(mission) {
  const resourceAverage = Object.values(mission.resources).reduce((sum, value) => sum + value, 0) / 5;
  const decisionSkill = Math.round(mission.decisions.reduce((sum, decision) => {
    const risk = Object.entries(decision.effects).reduce((total, [key, value]) => {
      return total + (['oxygen', 'water', 'food', 'power', 'shielding', 'safety'].includes(key) ? Math.min(value, 0) : 0);
    }, 0);
    return sum + 16 + Math.max(-12, risk);
  }, 0) / 6);
  const eventScience = mission.decisions.reduce((sum, decision) => sum + Math.max(0, decision.effects.science || 0), 0);
  const systemsBonus = Math.min(15, mission.smartChoices);
  return clamp(Math.round(
    resourceAverage * 0.4 + getCrewSafety(mission) * 0.3 + decisionSkill * 0.15 +
    (eventScience + mission.scienceCredits) * 0.3 + mission.decisions.length * 3 + systemsBonus
  ));
}

function requireInteger(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw Object.assign(new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`), { status: 400 });
  }
}

async function activeMission(id) {
  return initializeSystems(await getMission(id));
}

async function persistSystemAction(mission) {
  mission.score = calculateScore(mission);
  memory.set(mission.id, mission);
  await db.saveMissionState(mission);
  return mission;
}

async function createMission({ destination, playerName }) {
  if (!validateDestination(destination)) throw Object.assign(new Error('Choose the Moon or Mars.'), { status: 400 });
  if (typeof playerName !== 'string' || !playerName.trim() || playerName.trim().length > 32) {
    throw Object.assign(new Error('Enter a name between 1 and 32 characters.'), { status: 400 });
  }
  const moon = destination === 'moon';
  const mission = initializeSystems({
    id: randomUUID(),
    destination,
    playerName: cleanName(playerName),
    resources: { ...destinationResources[destination] },
    crewSafety: moon ? 80 : 82,
    destinationProfile: moon
      ? { environment: 'Lunar dust can cling to equipment; the Moon has no thick atmosphere to block space radiation.', powerMinimum: 15 }
      : { environment: 'A thin atmosphere, weaker sunlight, and planet-wide dust storms can challenge power planning.', powerMinimum: 20 },
    decisions: [],
    completed: false,
    score: 0,
    createdAt: new Date().toISOString()
  });
  memory.set(mission.id, mission);
  await db.createMission(mission);
  return mission;
}

async function getMission(id) {
  const mission = memory.get(id) || await db.getMission(id);
  if (!mission) throw Object.assign(new Error('Mission not found. Start a new mission to begin.'), { status: 404 });
  memory.set(id, initializeSystems(mission));
  return memory.get(id);
}

async function makeDecision(id, { scenarioId, choiceId }) {
  if (typeof scenarioId !== 'string' || typeof choiceId !== 'string') {
    throw Object.assign(new Error('Choose an event and one of its options.'), { status: 400 });
  }
  const mission = await getMission(id);
  if (mission.completed) throw Object.assign(new Error('This mission is complete. Start a new mission to play again.'), { status: 409 });
  const scenario = scenarioForDestination(mission.decisions.length, mission.destination);
  if (!scenario || scenario.id !== scenarioId) {
    throw Object.assign(new Error('That event is not the next event in this mission.'), { status: 400 });
  }
  const choice = scenario.choices.find((item) => item.id === choiceId);
  if (!choice) throw Object.assign(new Error('Choose one of the options shown for this event.'), { status: 400 });

  for (const [resource, change] of Object.entries(choice.effects)) {
    if (resource === 'safety') {
      mission.crewSafety = clamp(getCrewSafety(mission) + change);
      continue;
    }
    const target = resource === 'electricity' ? 'power' : resource;
    if (target in mission.resources) mission.resources[target] = clamp(mission.resources[target] + change);
  }
  mission.decisions.push({
    scenarioId,
    scenarioTitle: scenario.title,
    choiceId,
    choiceLabel: choice.label,
    explanation: choice.explanation,
    effects: choice.effects,
    createdAt: new Date().toISOString()
  });
  mission.score = calculateScore(mission);
  mission.completed = mission.decisions.length === scenarios.length;
  memory.set(id, mission);
  await db.saveMission(mission, {
    scenarioId,
    choiceId,
    explanation: choice.explanation
  });
  return { mission, scenario: { id: scenario.id, title: scenario.title }, choice, report: mission.completed ? createReport(mission) : null };
}

function createReport(mission) {
  initializeSystems(mission);
  const safety = getCrewSafety(mission);
  const average = Math.round(Object.values(mission.resources).reduce((sum, value) => sum + value, 0) / 5);
  const smart = mission.decisions.filter((decision) => !Object.values(decision.effects).some((value) => value <= -15)).length + mission.smartChoices;
  const achievements = [];
  if (safety >= 70) achievements.push('Crew Guardian');
  if (mission.resources.water >= 60) achievements.push('Water Wise');
  if (mission.decisions.length === scenarios.length) achievements.push('Mission Complete');
  if (smart >= 5) achievements.push('Thoughtful Commander');
  const categories = [
    { name: 'Resource care', score: Math.round(average) },
    { name: 'Crew safety', score: safety },
    { name: 'Smart decisions', score: Math.round(smart / scenarios.length * 100) },
    { name: 'Science', score: clamp((mission.decisions.reduce((sum, item) => sum + Math.max(item.effects.science || 0, 0), 0) + mission.scienceCredits) * 2) }
  ];
  return {
    score: mission.score,
    rating: mission.score >= 80 ? 'Stellar commander!' : mission.score >= 60 ? 'Great space teamwork!' : 'You learned and adapted!',
    achievements,
    categories,
    mistakes: mission.decisions.filter((item) => Object.values(item.effects).some((value) => value <= -8))
      .map((item) => ({ choice: item.choiceLabel, lesson: item.explanation })),
    resourceLessons: {
      oxygen: 'Astronauts need oxygen to breathe. Check the air supply regularly.',
      water: 'Water helps astronauts drink and grow plants. Recycle it when you can.',
      food: 'Growing food takes light, water, energy, and time.',
      power: 'Power keeps habitat life-support and science equipment running.',
      shielding: 'Shelter and supplies such as water can help protect astronauts from radiation.',
      safety: 'Crew safety is a game status—not a radiation measurement.'
    }
  };
}

function scenarioForDestination(index, destination) {
  const scenario = scenarios[index];
  if (!scenario) return null;
  const copy = structuredClone(scenario);
  if (copy.id === 'dust-storm') {
    if (destination === 'mars') {
      copy.title = 'A Mars dust storm dims the solar panels';
      copy.description = 'Dust in the thin Martian sky blocks sunlight from your panels. Save power or use the rover to clear what it can.';
    } else {
      copy.title = 'Lunar dust is coating the solar panels';
      copy.description = 'Fine Moon dust clings to equipment. A careful rover clean can help the panels, but takes power and crew time.';
      copy.choices[0].effects = { power: -6, oxygen: -1, electricity: 12, safety: -1, science: 7 };
    }
  }
  if (copy.id === 'communication-delay') {
    copy.title = destination === 'mars' ? 'A reply from Earth is still traveling' : 'Send a quick update to Earth';
    copy.description = destination === 'mars'
      ? 'Mars is far away. A radio reply can take many minutes, so your crew should be ready to decide locally.'
      : 'The Moon is close to Earth. Radio messages arrive quickly, but your crew should still practice safe local decisions.';
    copy.science = destination === 'mars'
      ? 'Mars-Earth radio delays vary with the planets’ positions. The 12-minute delay in this simulator is a practice example, not a live calculation.'
      : 'Radio messages take about 1.3 seconds one way between Earth and the Moon. The simulator uses a short practice delay.';
  }
  return copy;
}

function getScenarios(destination = 'moon') {
  if (!validateDestination(destination)) throw Object.assign(new Error('Choose the Moon or Mars.'), { status: 400 });
  return scenarios.map((_, index) => {
    const { choices, ...scenario } = scenarioForDestination(index, destination);
    return { ...scenario, choices: choices.map(({ id, label }) => ({ id, label })) };
  });
}

async function getMissionBriefing(id, getSpaceWeather) {
  const mission = await getMission(id);
  const observation = await getSpaceWeather();
  const latest = observation.events.find((event) => event.eventType !== 'Sample solar activity') || null;
  return {
    destination: mission.destination,
    status: observation.status,
    source: observation.source,
    events: observation.events,
    latestObservation: latest,
    note: latest
      ? 'NASA DONKI reports recent solar activity. This observation is not a forecast for your outpost and is not an astronaut radiation-dose measurement.'
      : observation.status === 'live'
        ? 'NASA DONKI returned no recent CME reports in this time window. That is not a guarantee of quiet space weather at your outpost.'
        : 'Sample fallback only: no live NASA observation is available. The solar-storm challenge is a learning simulation, not a real alert.'
  };
}

async function plantSeeds(id, { count }) {
  const mission = await activeMission(id);
  requireInteger(count, 'Seed count', 1, 4);
  const garden = mission.garden;
  if (count > garden.seeds) throw Object.assign(new Error(`Only ${garden.seeds} seed${garden.seeds === 1 ? '' : 's'} remain.`), { status: 409 });
  if (garden.plants.length + count > 6) throw Object.assign(new Error('The garden has room for 6 plants at a time.'), { status: 409 });
  garden.seeds -= count;
  for (let i = 0; i < count; i++) {
    garden.plants.push({ id: randomUUID(), plantedDay: garden.day, growthDays: 0, status: 'growing' });
  }
  garden.log.push({ day: garden.day, action: 'planted', count });
  await persistSystemAction(mission);
  return mission;
}

async function advanceGardenDay(id, { waterAllocation, electricityAllocation }) {
  const mission = await activeMission(id);
  const garden = mission.garden;
  requireInteger(waterAllocation, 'Water allocation', 0, 20);
  requireInteger(electricityAllocation, 'Electricity allocation', 0, 20);
  if (waterAllocation > mission.resources.water) throw Object.assign(new Error('There is not enough water for that allocation.'), { status: 409 });
  if (electricityAllocation > garden.lightCredits) throw Object.assign(new Error('Not enough garden-light power. Allocate electricity to garden lights on the Power Management screen first.'), { status: 409 });
  const growing = garden.plants.filter((plant) => plant.status === 'growing');
  if (!growing.length) throw Object.assign(new Error('Plant seeds first, or harvest plants that are ready.'), { status: 409 });
  mission.resources.water -= waterAllocation;
  garden.lightCredits -= electricityAllocation;
  garden.waterSpent += waterAllocation;
  garden.powerSpent += electricityAllocation;
  garden.day++;
  const waterPerPlant = growing.length ? waterAllocation / growing.length : 0;
  const powerPerPlant = growing.length ? electricityAllocation / growing.length : 0;
  const grew = waterPerPlant >= 2 && powerPerPlant >= 2;
  if (grew) growing.forEach((plant) => {
    plant.growthDays++;
    if (plant.growthDays >= 3) plant.status = 'ready';
  });
  garden.log.push({ day: garden.day, action: 'day-advanced', waterAllocation, electricityAllocation, grew });
  await persistSystemAction(mission);
  return { mission, grew, message: grew
    ? `Your plants grew for mission day ${garden.day}.`
    : 'The plants need at least 2 water and 2 garden-light units per growing plant for a growth day.' };
}

async function harvestGarden(id) {
  const mission = await activeMission(id);
  const garden = mission.garden;
  const ready = garden.plants.filter((plant) => plant.status === 'ready' || plant.growthDays >= 3);
  if (!ready.length) throw Object.assign(new Error('No plants are ready yet. Give them three well-watered, well-lit mission days.'), { status: 409 });
  const before = mission.resources.food;
  mission.resources.food = clamp(before + ready.length * 6);
  garden.harvestedPlants += ready.length;
  garden.plants = garden.plants.filter((plant) => plant.growthDays < 3);
  garden.log.push({ day: garden.day, action: 'harvested', count: ready.length, food: mission.resources.food - before });
  mission.scienceCredits += ready.length;
  await persistSystemAction(mission);
  return { mission, harvested: ready.length, foodAdded: mission.resources.food - before };
}

async function allocatePower(id, allocations) {
  const mission = await activeMission(id);
  const keys = ['lifeSupport', 'communication', 'gardenLights', 'scienceEquipment'];
  if (!allocations || Object.keys(allocations).length !== keys.length ||
    keys.some((key) => !Number.isInteger(allocations[key]) || allocations[key] < 0 || allocations[key] > 100)) {
    throw Object.assign(new Error('Enter whole-number power allocations from 0 to 100 for every system.'), { status: 400 });
  }
  const total = keys.reduce((sum, key) => sum + allocations[key], 0);
  const lifeSupportMinimum = mission.destinationProfile.powerMinimum;
  if (allocations.lifeSupport < lifeSupportMinimum) {
    throw Object.assign(new Error(`${mission.destination === 'mars' ? 'Mars' : 'Moon'} life support needs at least ${lifeSupportMinimum} power units.`), { status: 400 });
  }
  if (total > mission.resources.power) {
    throw Object.assign(new Error(`Your allocation uses ${total} units, but only ${mission.resources.power} power units are available.`), { status: 409 });
  }
  mission.resources.power -= total;
  mission.garden.lightCredits += allocations.gardenLights;
  if (allocations.communication > 0) mission.communications.poweredPackets += Math.max(1, Math.floor(allocations.communication / 2));
  mission.scienceCredits += Math.floor(allocations.scienceEquipment / 4);
  if (allocations.scienceEquipment >= 4) mission.smartChoices++;
  if (allocations.lifeSupport >= lifeSupportMinimum + 8) mission.crewSafety = clamp(getCrewSafety(mission) + 2);
  mission.powerLog.push({ day: mission.garden.day, allocations, total });
  mission.powerLog = mission.powerLog.slice(-12);
  await persistSystemAction(mission);
  return { mission, total, remainingPower: mission.resources.power, lifeSupportMinimum };
}

async function setRadiationStrategy(id, { strategy }) {
  const mission = await activeMission(id);
  const strategies = {
    water: { water: 8, power: 0, shield: 14, risk: 14, safety: 7 },
    habitat: { water: 0, power: 6, shield: 12, risk: 12, safety: 6 },
    layered: { water: 10, power: 7, shield: 25, risk: 25, safety: 12 },
    exposed: { water: 0, power: 0, shield: -8, risk: -15, safety: -10 }
  };
  const plan = strategies[strategy];
  if (!plan) throw Object.assign(new Error('Choose a listed shielding strategy.'), { status: 400 });
  if (mission.resources.water < plan.water || mission.resources.power < plan.power) {
    throw Object.assign(new Error('Your outpost does not have enough water or power for that strategy.'), { status: 409 });
  }
  mission.resources.water -= plan.water;
  mission.resources.power -= plan.power;
  mission.resources.shielding = clamp(mission.resources.shielding + plan.shield);
  mission.crewSafety = clamp(getCrewSafety(mission) + plan.safety);
  mission.radiation.riskIndex = clamp(mission.radiation.riskIndex - plan.risk);
  mission.radiation.strategy = strategy;
  mission.radiation.actions.push({ day: mission.garden.day, strategy, riskIndex: mission.radiation.riskIndex });
  if (strategy !== 'exposed') mission.smartChoices++;
  await persistSystemAction(mission);
  return mission;
}

async function sendMessage(id, { message }) {
  const mission = await activeMission(id);
  if (typeof message !== 'string' || !message.trim() || message.trim().length > 160) {
    throw Object.assign(new Error('Write a message from 1 to 160 characters.'), { status: 400 });
  }
  if (mission.communications.poweredPackets < 1) {
    throw Object.assign(new Error('Your radio needs power. Allocate electricity to Communication on the Power Management screen first.'), { status: 409 });
  }
  mission.communications.poweredPackets--;
  const sent = {
    id: randomUUID(),
    text: message.trim(),
    status: 'in-transit',
    sentAt: new Date().toISOString(),
    delayLabel: mission.communications.delayLabel
  };
  mission.communications.messages.push(sent);
  mission.communications.messages = mission.communications.messages.slice(-12);
  await persistSystemAction(mission);
  return mission;
}

async function advanceCommunicationClock(id) {
  const mission = await activeMission(id);
  const awaiting = mission.communications.messages.find((item) => item.status === 'in-transit');
  if (!awaiting) throw Object.assign(new Error('There is no reply in transit. Send a message first.'), { status: 409 });
  awaiting.status = 'replied';
  awaiting.reply = 'Mission control received your message. Keep using your crew training while the next reply travels.';
  awaiting.repliedAt = new Date().toISOString();
  mission.communications.messages = [...mission.communications.messages];
  await persistSystemAction(mission);
  return mission;
}

async function makeLocalCommunicationDecision(id, { choice }) {
  const mission = await activeMission(id);
  const options = {
    act: { power: 2, water: 0, safety: 4, lesson: 'Your crew used its training and made a safe local decision instead of waiting.' },
    shelter: { power: 1, water: 3, safety: 7, lesson: 'Sheltering keeps the crew safe while a message is traveling.' },
    conserve: { power: 0, water: 0, safety: 2, lesson: 'Saving supplies is a sensible plan when you do not know how long a reply will take.' },
    wait: { power: 3, water: 0, safety: -3, lesson: 'Waiting can use power and time. Faraway crews need a safe local plan too.' }
  };
  const result = options[choice];
  if (!result) throw Object.assign(new Error('Choose a listed local crew action.'), { status: 400 });
  if (mission.resources.power < result.power || mission.resources.water < result.water) {
    throw Object.assign(new Error('Your outpost does not have enough supplies for that choice.'), { status: 409 });
  }
  if (choice === 'wait' && !mission.communications.messages.some((item) => item.status === 'in-transit')) {
    throw Object.assign(new Error('Send a message and wait for its reply before choosing to wait.'), { status: 409 });
  }
  mission.resources.power -= result.power;
  mission.resources.water -= result.water;
  mission.crewSafety = clamp(getCrewSafety(mission) + result.safety);
  if (choice !== 'wait') mission.smartChoices++;
  mission.communications.localDecisions.push({ day: mission.garden.day, choice, lesson: result.lesson });
  mission.communications.localDecisions = mission.communications.localDecisions.slice(-12);
  await persistSystemAction(mission);
  return mission;
}

async function getHistory() {
  const stored = await db.getHistory();
  if (stored) return stored;
  return [...memory.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25)
    .map((mission) => ({
      id: mission.id,
      destination: mission.destination,
      playerName: mission.playerName,
      score: mission.score,
      completed: mission.completed,
      createdAt: mission.createdAt
    }));
}

module.exports = {
  createMission, getMission, makeDecision, getScenarios, getHistory, createReport,
  getMissionBriefing, plantSeeds, advanceGardenDay, harvestGarden, allocatePower,
  setRadiationStrategy, sendMessage, advanceCommunicationClock, makeLocalCommunicationDecision
};
