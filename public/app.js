const routes = [
  { group: 'Mission', items: [['home', '⌂', 'Overview'], ['briefing', '▤', 'Mission briefing'], ['select', '◉', 'Choose destination'], ['control', '⌖', 'Mission control'], ['outpost', '⌂', 'Outpost simulator']] },
  { group: 'Systems', items: [['resources', '◈', 'Resource management'], ['radiation', '✳', 'Radiation protection'], ['power', 'ϟ', 'Power management'], ['food', '✿', 'Food production'], ['comms', '⌁', 'Communication center']] },
  { group: 'Explore', items: [['events', '⚑', 'Events & challenges'], ['results', '▥', 'Mission reports'], ['data', '✧', 'NASA data explorer'], ['about', 'ⓘ', 'About & sources']] }
];
const pageTitles = {
  home: 'Mission overview', briefing: 'Mission briefing', select: 'Choose your destination',
  control: 'Mission control', outpost: 'Outpost simulator', resources: 'Resource management',
  radiation: 'Radiation protection', power: 'Power management', food: 'Food production',
  comms: 'Communication center', events: 'Events & challenges', results: 'Mission reports',
  data: 'NASA data explorer', about: 'About & sources'
};
const resourceInfo = {
  oxygen: { icon: '◉', detail: 'For breathing', unit: 'air supply' },
  water: { icon: '◌', detail: 'For people & plants', unit: 'water supply' },
  food: { icon: '✿', detail: 'Meals & harvest', unit: 'food supply' },
  power: { icon: 'ϟ', detail: 'Habitat electricity', unit: 'power supply' },
  shielding: { icon: '⬡', detail: 'Radiation protection', unit: 'shield protection' }
};
const app = document.getElementById('app');
const state = { mission: null, scenarios: [], scenariosError: null, selectedDestination: 'moon', apod: null, weather: null, notice: null };
const savedMissionId = () => {
  try { return localStorage.getItem('astra-mission-id'); } catch { return null; }
};
const clearSavedMissionId = () => {
  try { localStorage.removeItem('astra-mission-id'); } catch { /* Browser storage is optional. */ }
};
const saveMissionId = (id) => {
  try { localStorage.setItem('astra-mission-id', id); } catch { /* The mission still works if browser storage is disabled. */ }
};
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const currentPage = () => location.hash.replace(/^#\/?/, '') || 'home';

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The server sent an unreadable response. Try again.'); }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function go(page) {
  if (page === 'control' && !state.mission) page = 'select';
  location.hash = `/${page}`;
}

function layout(page, content) {
  const nav = routes.map((section) => `
    <div class="nav-caption">${section.group}</div>
    ${section.items.map(([id, icon, label]) => `<a class="nav-link ${page === id ? 'active' : ''}" href="#/${id}"><span class="nav-icon" aria-hidden="true">${icon}</span>${label}</a>`).join('')}
  `).join('');
  const missionStatus = state.mission?.completed ? 'MISSION COMPLETE' : state.mission ? 'MISSION ACTIVE' : 'READY TO LAUNCH';
  return `<div class="mobile-overlay" id="mobile-overlay"></div>
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="#/home"><span class="brand-mark" aria-hidden="true">✦</span><span><strong>ASTRA COMMAND</strong><small>JUNIOR ASTRONAUT TRAINER</small></span></a>
        <nav aria-label="Main navigation">${nav}</nav>
        <div class="sidebar-spacer"></div>
        <div class="connection-card"><div class="tiny-label">YOUR MISSION</div><div style="font-size:12px;font-weight:700">${state.mission ? `${state.mission.destination === 'mars' ? '🔴' : '🌙'} ${esc(state.mission.destination.toUpperCase())} OUTPOST` : 'No active mission'}</div><div class="stat-detail">${state.mission ? `${state.mission.decisions.length} of 6 challenges complete` : 'Choose a destination to begin.'}</div></div>
      </aside>
      <main class="main">
        <header class="topbar"><div style="display:flex;align-items:center;gap:12px"><button class="menu-toggle" id="menu-toggle" aria-label="Open navigation">☰</button><div class="breadcrumbs">ASTRA / <strong>${esc(pageTitles[page] || pageTitles.home)}</strong></div></div>
          <div class="top-actions"><span class="badge demo" id="storage-badge">CHECKING STORAGE</span><span class="badge ${state.mission ? 'live' : 'demo'}">${missionStatus}</span><div class="avatar" aria-label="Junior astronaut profile">A</div></div>
        </header>
        <section class="page">${content}<p class="footer-note">Made for curious explorers ages 7–12 · Learn by choosing, trying, and trying again.</p></section>
      </main>
    </div>`;
}

function pageHead(kicker, title, copy) {
  return `<div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="lead">${copy}</p>`;
}

function statCards(resources, crewSafety) {
  const resourceCards = Object.entries(resourceInfo).map(([key, info]) => {
    const value = Number(resources[key]) || 0;
    const level = value < 20 ? 'critical' : value < 40 ? 'low' : 'steady';
    const status = value < 20 ? 'Needs attention' : value < 40 ? 'Monitor' : 'On track';
    return `<article class="stat-card resource-card resource-${key}"><div class="stat-top"><span class="stat-name">${info.unit}</span><span class="stat-icon" aria-hidden="true">${info.icon}</span></div><div class="stat-number">${value}<span style="font-size:13px;color:var(--muted)">%</span></div><div class="meter ${level}" role="meter" aria-label="${info.unit}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><span style="width:${value}%"></span></div><div class="stat-detail">${info.detail}</div><span class="resource-state ${level}">${status}</span></article>`;
  });
  const safetyLevel = crewSafety < 20 ? 'critical' : crewSafety < 40 ? 'low' : 'steady';
  const safetyStatus = crewSafety < 20 ? 'Needs attention' : crewSafety < 40 ? 'Monitor' : 'On track';
  const safetyCard = crewSafety == null ? '' : `<article class="stat-card resource-card resource-safety"><div class="stat-top"><span class="stat-name">Crew safety</span><span class="stat-icon" aria-hidden="true">♥</span></div><div class="stat-number">${Number(crewSafety)}<span style="font-size:13px;color:var(--muted)">%</span></div><div class="meter ${safetyLevel}" role="meter" aria-label="Crew safety" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(crewSafety)}"><span style="width:${crewSafety}%"></span></div><div class="stat-detail">How safe the crew feels</div><span class="resource-state ${safetyLevel}">${safetyStatus}</span></article>`;
  return `<div class="stat-grid">${resourceCards.join('')}${safetyCard}</div>`;
}

function resourceChart(mission) {
  const values = { ...mission.resources, safety: mission.crewSafety };
  const labels = { oxygen: 'Oxygen', water: 'Water', food: 'Food', power: 'Power', shielding: 'Shielding', safety: 'Crew safety' };
  return `<div class="card resource-chart" role="img" aria-label="Chart of current mission resources and crew safety">${Object.entries(values).map(([key, amount]) => `
    <div class="chart-row"><span class="chart-label">${labels[key]}</span><div class="chart-track"><span class="${amount < 30 ? 'low' : ''}" style="width:${amount}%"></span></div><strong class="chart-value">${amount}%</strong></div>`).join('')}</div>`;
}

function missionProgress() {
  if (!state.mission) return '<div class="callout"><strong>Mission control standing by.</strong> Choose the Moon or Mars to begin your outpost mission.</div>';
  const done = state.mission.decisions.length;
  const steps = Array.from({ length: 6 }, (_, index) => `<span class="mission-step ${index < done ? 'complete' : ''}" aria-label="Challenge ${index + 1} ${index < done ? 'complete' : 'not complete'}">${index < done ? '✓' : index + 1}</span>`).join('');
  return `<div class="card"><div class="tiny-label">MISSION CHECKLIST</div><div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px"><span>${done === 6 ? 'Mission complete!' : `${6 - done} challenge${6 - done === 1 ? '' : 's'} remaining`}</span><strong>${done}/6</strong></div><div class="mission-steps" aria-label="Mission challenge progress">${steps}</div><div class="progress-track"><span style="width:${done / 6 * 100}%"></span></div><div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center"><span class="stat-detail">${esc(state.mission.playerName)} · ${state.mission.destination.toUpperCase()} OUTPOST</span><a class="button small secondary" href="#/${done === 6 ? 'results' : 'events'}">${done === 6 ? 'See report' : 'Continue mission'} →</a></div></div>`;
}

function missionAchievements(mission) {
  const decisions = mission.decisions || [];
  const thoughtfulChoices = decisions.filter((item) => !Object.values(item.effects).some((value) => value <= -15)).length + (mission.smartChoices || 0);
  const safety = Number(mission.crewSafety ?? Math.round(
    (mission.resources.oxygen + mission.resources.water + mission.resources.shielding) / 3
  ));
  return [
    { name: 'Crew Guardian', detail: 'Keep crew safety at 70 or higher.', earned: safety >= 70 },
    { name: 'Water Wise', detail: 'Finish with at least 60 water.', earned: mission.resources.water >= 60 },
    { name: 'Mission Complete', detail: 'Complete all six challenges.', earned: mission.completed },
    { name: 'Thoughtful Commander', detail: 'Make five thoughtful choices.', earned: thoughtfulChoices >= 5 }
  ];
}

function homePage() {
  const mission = state.mission;
  const destination = mission?.destination;
  const completed = Boolean(mission?.completed);
  const done = mission?.decisions.length || 0;
  const recentDecisions = mission?.decisions.slice(-3).reverse() || [];
  const achievements = mission ? missionAchievements(mission) : [];
  const destinationName = destination === 'mars' ? 'Mars' : 'Moon';
  const missionStatus = completed ? 'MISSION COMPLETE' : 'MISSION ACTIVE';
  return `<section class="hero home-hero ${mission ? `has-mission mission-${destination}` : 'prelaunch'}">
      <div class="hero-copy"><div class="eyebrow">${mission ? `${destinationName.toUpperCase()} OUTPOST · FLIGHT DECK` : 'YOUR SPACE MISSION STARTS HERE'}</div>
        <h1>${mission ? completed ? 'Mission complete.' : `Welcome back, ${esc(mission.playerName)}.` : 'One small choice.<br>One giant mission.'}</h1>
        <p>${mission ? esc(mission.destinationProfile.environment) : 'Lead a crew on the Moon or Mars. Grow food, protect your team, and solve real space challenges, one smart choice at a time.'}</p>
        <div class="home-hero-actions"><a class="button" href="#/${mission ? 'control' : 'briefing'}">${mission ? 'Open mission control' : 'Start your mission'} <span aria-hidden="true">→</span></a><a class="button secondary" href="#/${mission && completed ? 'results' : 'briefing'}">${mission && completed ? 'View mission report' : mission ? 'Mission briefing' : 'How it works'}</a></div>
      </div>
      <div class="planet-scene" aria-hidden="true"><div class="orbit"></div><div class="planet ${destination === 'mars' ? 'mars' : ''}"></div><div class="orbit-dot"></div></div>
      ${mission ? `<aside class="hero-mission-panel"><div class="mission-panel-top"><span class="tiny-label">MISSION STATUS</span><span class="badge ${completed ? 'complete' : 'active'}">${missionStatus}</span></div><div class="destination-identity"><span class="destination-mark" aria-hidden="true">${destination === 'mars' ? '🔴' : '🌙'}</span><div><span class="tiny-label">DESTINATION</span><strong>${destinationName} Outpost</strong></div></div><div class="mission-panel-progress"><div><span>CHALLENGE PROGRESS</span><strong>${done}/6</strong></div><div class="progress-track"><span style="width:${done / 6 * 100}%"></span></div></div><span class="mission-panel-caption">${completed ? 'Your crew completed every challenge.' : `${6 - done} challenges left in your mission.`}</span></aside>` : '<div class="hero-coordinate"><span>MISSION CONTROL · EARTH LINK</span><strong>Ready for launch</strong><small>Moon & Mars outpost training</small></div>'}
    </section>
    <div class="section-head dashboard-section-head"><div><div class="tiny-label">${mission ? 'OUTPOST RESOURCE STATUS' : 'MISSION CONTROL'}</div><h2>${mission ? 'Outpost at a glance' : 'Your mission starts here'}</h2></div><a class="button small secondary" href="#/${mission ? 'control' : 'select'}">${mission ? 'Mission control →' : 'Choose destination →'}</a></div>
    ${mission ? statCards(mission.resources, mission.crewSafety) : `<div class="grid three"><article class="card feature-card"><span class="feature-icon">◈</span><h3>Balance resources</h3><p>Make oxygen, water, food, and power last.</p></article><article class="card feature-card"><span class="feature-icon">✳</span><h3>Keep your crew safe</h3><p>Prepare for space weather and radiation.</p></article><article class="card feature-card"><span class="feature-icon">✧</span><h3>Explore NASA data</h3><p>Discover astronomy pictures and solar activity, clearly labeled as live or sample.</p></article></div>`}
    ${mission ? `<div class="section-head dashboard-section-head"><div><div class="tiny-label">FLIGHT PLAN</div><h2>Mission progress</h2></div></div>${missionProgress()}
      <div class="home-insights">
        <section class="card insight-panel"><div class="insight-heading"><div><div class="tiny-label">MISSION LOG</div><h2>Recent activity</h2></div><a class="text-link" href="#/events">${completed ? 'Review events' : 'Continue mission'} →</a></div>
          ${recentDecisions.length ? `<ol class="activity-list">${recentDecisions.map((decision, index) => `<li class="activity-item"><span class="activity-index">${mission.decisions.length - index}</span><div><span class="activity-kicker">CHALLENGE ${mission.decisions.length - index}</span><strong>${esc(decision.scenarioTitle)}</strong><span>${esc(decision.choiceLabel)}</span></div></li>`).join('')}</ol>` : '<p class="empty-state">Your event decisions will appear here as your crew works through the mission.</p>'}
        </section>
        <section class="card insight-panel"><div class="insight-heading"><div><div class="tiny-label">CREW MILESTONES</div><h2>Achievements</h2></div><a class="text-link" href="#/results">View report →</a></div>
          <div class="achievement-grid">${achievements.map((achievement) => `<div class="achievement-tile ${achievement.earned ? 'earned' : 'locked'}"><span class="achievement-symbol" aria-hidden="true">${achievement.earned ? '✦' : '◇'}</span><div><strong>${achievement.name}</strong><span>${achievement.earned ? 'Unlocked' : achievement.detail}</span></div></div>`).join('')}</div>
        </section>
      </div>` : `<div class="section-head dashboard-section-head"><div><div class="tiny-label">CHOOSE YOUR DESTINATION</div><h2>Pick your planet</h2></div></div><div class="grid two"><a class="mission-card destination-card moon-card" href="#/select"><div class="tiny-label">CLOSE TO HOME</div><h2 style="margin:9px 0 5px">🌙 Moon outpost</h2><p class="muted" style="font-size:12px;margin:0">A nearby radio link, lunar dust, and a compact starting water supply.</p><span class="module-link">Explore the Moon →</span></a><a class="mission-card destination-card mars-card" href="#/select"><div class="tiny-label">THE RED PLANET</div><h2 style="margin:9px 0 5px">🔴 Mars outpost</h2><p class="muted" style="font-size:12px;margin:0">A long communication delay, dust storms, and a more demanding power plan.</p><span class="module-link">Explore Mars →</span></a></div>`}`;
}

function briefingPage() {
  return `${pageHead('BEFORE LAUNCH · 3 MIN READ', 'Welcome, mission commander.', 'You are in charge of a small astronaut crew living far from Earth. The crew is counting on you to keep the outpost healthy and complete its science.') }
    <div class="grid three" style="margin-top:23px"><article class="card"><span class="feature-icon">01</span><h3>Pick your destination</h3><p>Choose the Moon for a nearby mission or Mars for a farther-away challenge.</p></article><article class="card"><span class="feature-icon">02</span><h3>Meet the challenge</h3><p>Six space events will ask you to make real engineering choices.</p></article><article class="card"><span class="feature-icon">03</span><h3>Learn as you go</h3><p>Every choice changes supplies and shows a simple science explanation.</p></article></div>
    <div class="section-head"><h2>Your mission rules</h2></div><div class="grid two"><div class="callout"><strong>People first.</strong> Protect the air, clean water, food, electricity, and radiation shelter. These supplies all work together.</div><div class="callout"><strong>There is no perfect answer.</strong> Fixing one problem may use a different supply. Think about what your crew needs most.</div></div>
    <div style="margin-top:22px"><a class="button" href="#/select">Choose your destination →</a></div>`;
}

function selectPage() {
  return `${pageHead('MISSION SELECTION', 'Where will your crew go?', 'Both outposts need clever teamwork. Choose a destination and give your mission a name.') }
    <div class="choice-grid"><button class="destination ${state.selectedDestination === 'moon' ? 'selected' : ''}" data-destination="moon"><span class="planet-emoji">🌙</span><h3>Moon outpost</h3><p>Closer to Earth, but with a smaller starting water and shielding supply. Lunar dust can cling to equipment.</p><div class="tiny-label" style="margin-top:13px">ABOUT 1.3 SECONDS ONE WAY · DUSTY GEAR</div></button><button class="destination ${state.selectedDestination === 'mars' ? 'selected' : ''}" data-destination="mars"><span class="planet-emoji">🔴</span><h3>Mars outpost</h3><p>More water and shielding at launch, but less starting power. Dust storms and long message delays need careful planning.</p><div class="tiny-label" style="margin-top:13px">12 MINUTE PRACTICE DELAY · DUST STORMS</div></button></div>
    <form id="mission-form"><label class="field" for="player-name">YOUR CALL SIGN</label><input id="player-name" class="input" type="text" name="playerName" maxlength="32" required placeholder="e.g. Captain Nova" autocomplete="given-name"><div style="margin-top:16px"><button class="button" type="submit">Launch mission 🚀</button></div></form><div id="form-message" aria-live="polite"></div>`;
}

function controlPage() {
  if (!state.mission) return `<div class="card">${pageHead('MISSION CONTROL', 'Your command deck is ready.', 'Launch a mission first to see your outpost systems.') }<a class="button" href="#/select">Choose a destination →</a></div>`;
  return `${pageHead(`${state.mission.destination.toUpperCase()} OUTPOST · COMMAND DECK`, `Welcome, ${esc(state.mission.playerName)}.`, 'Check your crew and supplies. A steady plan helps your outpost stay healthy.') }
    <div class="callout command-environment"><strong>${state.mission.destination.toUpperCase()} environment:</strong> ${esc(state.mission.destinationProfile.environment)}</div>
    ${statCards(state.mission.resources, state.mission.crewSafety)}
    <div class="section-head"><h2>Outpost systems chart</h2></div>${resourceChart(state.mission)}
    <div class="section-head"><h2>Mission status</h2><a class="button small secondary" href="#/events">${state.mission.completed ? 'View report →' : 'Next challenge →'}</a></div>
    <div class="split"><div>${missionProgress()}<div class="section-head"><h2 style="font-size:17px">Crew care</h2></div><div class="callout"><strong>Remember:</strong> protect people first, conserve what you can, and grow your own food when possible.</div></div><div class="card"><div class="tiny-label">TODAY’S OUTPOST CHECK</div><h3 style="margin-top:12px">Keep systems working together</h3><p>Solar panels make power. Power runs the water recycler and garden lights. Your choices can help—or challenge—another system.</p><div style="display:grid;gap:9px;margin-top:17px"><a class="button small secondary" href="#/resources">Check supplies →</a><a class="button small secondary" href="#/outpost">Tour the outpost →</a></div></div></div>`;
}

function outpostPage() {
  if (!state.mission) return `${pageHead('OUTPOST TOUR', 'Your habitat is waiting.', 'Start a mission to see the outpost your crew will call home.') }<a class="button" href="#/select">Pick a destination →</a>`;
  const modules = [
    ['⌂', 'Living quarters', 'Crew rest and habitat safety.', 'radiation'],
    ['◉', 'Life support', 'Air pumps and the water recycler.', 'resources'],
    ['ϟ', 'Power & garden', 'Panels, electricity, lights, and crops.', 'power'],
    ['⬡', 'Storm shelter', 'Plan a shielding strategy for a solar-weather exercise.', 'radiation'],
    ['✿', 'Plant lab', 'Plant seeds, tend crops, and harvest food.', 'food'],
    ['⌁', 'Radio room', `Send messages and practice the ${state.mission.destination === 'mars' ? 'long Mars' : 'short Moon'} delay.`, 'comms']
  ];
  return `${pageHead(`OUTPOST TOUR · ${state.mission.destination.toUpperCase()}`, 'A home away from Earth.', 'Explore a working model of the outpost. Choose a system to open its simulator.') }
    <div class="grid three" style="margin-top:22px">${modules.map(([icon, title, text, route]) => `<a class="card outpost-module" href="#/${route}"><span class="feature-icon">${icon}</span><h3>${title}</h3><p>${text}</p><span class="module-link">Open simulator →</span></a>`).join('')}</div>
    <div class="section-head"><h2>Outpost resource chart</h2><a class="button small secondary" href="#/control">Mission control →</a></div>${resourceChart(state.mission)}`;
}

function resourcePage(key) {
  if (!state.mission) return `${pageHead('OUTPOST SYSTEMS', 'Your crew’s supplies matter.', 'Start a mission to see the supplies your crew will manage.') }<a class="button" href="#/select">Pick a destination →</a>`;
  if (key === 'food') return foodPage();
  if (key === 'power') return powerPage();
  if (key === 'radiation') return radiationPage();
  if (key === 'comms') return communicationsPage();
  const names = { resources: 'Resource management', radiation: 'Radiation protection', power: 'Power management', food: 'Food production', comms: 'Communication center' };
  const copy = {
    resources: 'Every outpost has a limited supply. Keep an eye on how one choice can affect more than one system.',
    radiation: 'The Sun can send powerful bursts of invisible energy toward your crew. A safe shelter and sensible planning help reduce exposure.',
    power: 'Electricity powers life support, lights, and science. Solar panels are useful, but dust and darkness can limit them.',
    food: 'A garden can make fresh food, but plants need light, water, and time. Stored meals help when crops have trouble.',
    comms: state.mission.destination === 'mars' ? 'Mars is very far away. A message takes time to reach Earth and for an answer to come back, so your crew must be ready to decide locally.' : 'The Moon is much closer to Earth than Mars. Your crew can ask mission control for help, but should still practice making safe decisions.'
  };
  const mainContent = key === 'resources' ? statCards(state.mission.resources, state.mission.crewSafety) : `<div class="grid two" style="margin-top:20px"><div class="card"><div class="tiny-label">WHY IT MATTERS</div><h3 style="margin-top:11px">${names[key]}</h3><p>${copy[key]}</p></div><div class="card"><div class="tiny-label">YOUR OUTPOST RIGHT NOW</div>${statCards(state.mission.resources, state.mission.crewSafety)}</div></div>`;
  const tip = {
    resources: '<strong>Engineering trade-off:</strong> saving energy might mean dimming plant lights. Check the full picture before you choose.',
    radiation: '<strong>Kid-sized science:</strong> radiation is energy traveling through space. Water and safe walls can help block some of it.',
    power: '<strong>Kid-sized science:</strong> a solar panel changes sunlight into electricity. Saving power can keep the most important machines going.',
    food: '<strong>Kid-sized science:</strong> plants use light, water, and air to grow. Growing food nearby means fewer trips to bring supplies.',
    comms: '<strong>Kid-sized science:</strong> radio messages travel at the speed of light, but space is so huge that faraway replies still take time.'
  }[key];
  return `${pageHead('OUTPOST SYSTEMS', names[key], copy[key])}<div class="section-head"><h2>System status</h2><a class="button small secondary" href="#/control">Mission control →</a></div>${mainContent}<div class="callout" style="margin-top:17px">${tip}</div><div class="section-head"><h2>Put your knowledge to work</h2></div><div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap"><p>${state.mission.completed ? 'Mission complete! Review the decisions you made.' : 'A new event is waiting. Make a choice and see its effect on your outpost.'}</p><a class="button small" href="#/${state.mission.completed ? 'results' : 'events'}">${state.mission.completed ? 'Open mission report' : 'Take on the next event'} →</a></div>`;
}

function foodPage() {
  const garden = state.mission.garden;
  const growing = garden.plants.filter((plant) => plant.status === 'growing');
  const ready = garden.plants.filter((plant) => plant.growthDays >= 3);
  const waterDefault = Math.min(state.mission.resources.water, growing.length * 2);
  const powerDefault = Math.min(garden.lightCredits, growing.length * 2);
  return `${pageHead('HYDROPONICS LAB · DAY ${garden.day}', 'Grow a garden in space.', 'Plant seeds, budget water and garden-light electricity, and advance mission days. Your plants need both water and light to grow.') }
    <div class="garden-scene card" aria-label="Illustration of the outpost hydroponic garden">
      <div class="garden-sun">☼</div><div class="garden-rack"><span>🌱</span><span>🌿</span><span>🌱</span><span>🪴</span></div>
      <div class="garden-caption">HYDROPONIC GROW RACK <span>Water is reused · Lights use shared outpost power</span></div>
    </div>
    <div class="grid three" style="margin-top:14px"><div class="card"><div class="tiny-label">MISSION DAY</div><div class="big-stat">${garden.day}</div><p>Simulated garden days</p></div><div class="card"><div class="tiny-label">SEEDS READY</div><div class="big-stat">${garden.seeds}</div><p>Seeds left to plant</p></div><div class="card"><div class="tiny-label">GARDEN LIGHT POWER</div><div class="big-stat">${garden.lightCredits}</div><p>Units from Power Management</p></div></div>
    <div class="section-head"><h2>Your plants</h2><span class="badge demo">${garden.plants.length}/6 GROW SLOTS</span></div>
    <div class="plant-grid">${garden.plants.length ? garden.plants.map((plant) => `<article class="plant-card"><span class="plant-picture">${plant.growthDays >= 3 ? '🥬' : plant.growthDays ? '🌿' : '🌱'}</span><strong>${plant.status === 'growing' ? `Growing · ${plant.growthDays}/3 days` : 'Ready to harvest'}</strong><div class="growth-dots">${[0, 1, 2].map((step) => `<i class="${step < plant.growthDays ? 'grown' : ''}"></i>`).join('')}</div></article>`).join('') : '<div class="card muted">Your grow rack is empty. Plant a few seeds to begin.</div>'}</div>
    <div class="grid two" style="margin-top:18px">
      <form class="card" id="garden-plant-form"><div class="tiny-label">STEP 1 · PLANT SEEDS</div><h3>Choose your seedlings</h3><p>Each seed makes one plant. The rack can hold up to 6 growing plants.</p><label class="field" for="seed-count">Seeds to plant</label><select class="input" id="seed-count" name="count">${[1, 2, 3, 4].map((count) => `<option value="${count}" ${count > garden.seeds || count + garden.plants.length > 6 ? 'disabled' : ''}>${count} seed${count === 1 ? '' : 's'}</option>`).join('')}</select><div id="garden-plant-error" aria-live="polite"></div><button class="button small" style="margin-top:14px" type="submit" ${garden.seeds < 1 || garden.plants.length >= 6 ? 'disabled' : ''}>Plant seeds</button></form>
      <form class="card" id="garden-day-form"><div class="tiny-label">STEP 2 · SIMULATE A DAY</div><h3>Set today’s water & light</h3><p>Each growing plant needs at least 2 water units and 2 garden-light units for one growth day.</p><label class="field" for="garden-water">Water allocation · available ${state.mission.resources.water}</label><input class="input" id="garden-water" name="waterAllocation" type="number" min="0" max="${state.mission.resources.water}" value="${waterDefault}"><label class="field" for="garden-electricity">Electricity · light credits ${garden.lightCredits}</label><input class="input" id="garden-electricity" name="electricityAllocation" type="number" min="0" max="${garden.lightCredits}" value="${powerDefault}"><div id="garden-day-error" aria-live="polite"></div><button class="button small" style="margin-top:14px" type="submit" ${!growing.length ? 'disabled' : ''}>Advance one mission day →</button><a class="button small secondary" style="margin:14px 0 0 8px" href="#/power">Allocate garden lights</a></form>
    </div>
    <div class="card" style="margin-top:15px;display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap"><div><div class="tiny-label">STEP 3 · HARVEST</div><p style="margin-top:7px">A plant is ready after 3 well-watered, well-lit days. Each harvest can add up to 6 food units.</p></div><div><span class="stat-detail">${ready.length} plant${ready.length === 1 ? '' : 's'} ready</span><button class="button small" id="garden-harvest" style="margin-left:10px" ${!ready.length ? 'disabled' : ''}>Harvest food 🥬</button></div><div id="garden-harvest-error" aria-live="polite"></div></div>
    <div class="section-head"><h2>Shared supplies</h2></div>${resourceChart(state.mission)}`;
}

function powerPage() {
  const mission = state.mission;
  const minimum = mission.destinationProfile.powerMinimum;
  const available = mission.resources.power;
  const suggested = { lifeSupport: Math.min(available, minimum + 8), communication: 0, gardenLights: 0, scienceEquipment: 0 };
  let remaining = Math.max(0, available - suggested.lifeSupport);
  suggested.communication = Math.min(4, remaining);
  remaining -= suggested.communication;
  suggested.gardenLights = Math.min(8, remaining);
  remaining -= suggested.gardenLights;
  suggested.scienceEquipment = Math.min(4, remaining);
  const total = Object.values(suggested).reduce((sum, value) => sum + value, 0);
  const categories = [
    ['lifeSupport', 'Life support', 'Air pumps and water recycler', minimum],
    ['communication', 'Communication', 'Radio messages need a power packet', 0],
    ['gardenLights', 'Garden lights', 'Adds credits for hydroponic growing', 0],
    ['scienceEquipment', 'Science equipment', 'Builds mission science points', 0]
  ];
  return `${pageHead(`${mission.destination.toUpperCase()} OUTPOST · POWER DESK`, 'Power every system wisely.', 'Split your limited electricity between four systems. The server will protect the minimum life-support budget for this destination.') }
    <div class="power-readout"><div><div class="tiny-label">POWER AVAILABLE</div><strong id="power-available">${available}</strong><span> units</span></div><div><div class="tiny-label">LIFE-SUPPORT MINIMUM</div><strong>${minimum}</strong><span> units</span></div><div><div class="tiny-label">PLANNED ALLOCATION</div><strong id="power-total">${total}</strong><span> units</span></div></div>
    <form class="card allocation-form" id="power-form"><div class="tiny-label">ONE SIMULATED POWER SHIFT</div>${categories.map(([key, title, description, min]) => `<div class="allocation-row"><div><label class="field" for="allocation-${key}">${title}</label><div class="stat-detail">${description}${min ? ` · minimum ${min}` : ''}</div></div><input class="input power-input" id="allocation-${key}" name="${key}" type="number" min="${min}" max="${available}" value="${suggested[key]}"></div>`).join('')}<div class="allocation-bar"><span id="allocation-bar-fill" style="width:${Math.min(100, total / Math.max(available, 1) * 100)}%"></span></div><p id="power-summary" class="muted" aria-live="polite">${total} power units will be used. Unallocated electricity stays in storage.</p><div id="power-error" aria-live="polite"></div><button class="button" type="submit">Run this power plan ⚡</button></form>
    <div class="grid two" style="margin-top:17px"><div class="callout"><strong>Protect life support first.</strong> The ${mission.destination === 'mars' ? 'Mars' : 'Moon'} outpost needs at least ${minimum} power units assigned to life support in every plan.</div><div class="callout"><strong>Systems share power.</strong> Garden lights become credits for growing. Communication power becomes message packets. Science power can boost your mission score.</div></div>
    <div class="section-head"><h2>Power-plan history</h2></div><div class="card">${mission.powerLog.length ? mission.powerLog.slice().reverse().map((entry) => `<div class="history-item"><span>Mission day ${entry.day} · life support ${entry.allocations.lifeSupport} · radio ${entry.allocations.communication} · garden ${entry.allocations.gardenLights} · science ${entry.allocations.scienceEquipment}</span><strong>−${entry.total}</strong></div>`).join('') : '<p>No power plans yet. Make your first allocation above.</p>'}</div>`;
}

function radiationPage() {
  const mission = state.mission;
  const radiation = mission.radiation;
  const strategies = [
    ['water', 'Add water shielding', 'Spend 8 water · strengthen shielding by 14 points · crew safety +7'],
    ['habitat', 'Reinforce the habitat', 'Spend 6 power · strengthen shielding by 12 points · crew safety +6'],
    ['layered', 'Use a layered shelter', 'Spend 10 water and 7 power · strongest simulated protection · crew safety +12'],
    ['exposed', 'Stay outside without extra shelter', 'No supply cost · simulated risk rises and crew safety falls']
  ];
  return `${pageHead('SHELTER PLANNING · ${mission.destination.toUpperCase()}', 'Make a safer place for the crew.', 'Explore how water and habitat materials can act as shielding in this simplified learning simulation.') }
    <div class="radiation-layout">
      <div class="shelter-scene card"><div class="risk-orb" style="--risk:${radiation.riskIndex}"><span>${radiation.riskIndex}<small>SIM RISK<br>INDEX</small></span></div><div class="habitat-cutaway"><div class="habitat-wall"></div><div class="crew-dot">👩‍🚀</div><div class="water-barrels">▰ ▰ ▰</div><span class="shelter-label">WATER + WALL SHIELDING</span></div><div class="tiny-label">OUTPOST SHELTER · ILLUSTRATION</div></div>
      <div class="card"><div class="tiny-label">YOUR CURRENT PLAN</div><h3 style="margin-top:10px">${esc(radiation.strategy)}</h3><p>Shielding supply: <strong>${mission.resources.shielding}%</strong> · Crew safety: <strong>${mission.crewSafety}%</strong></p><div class="callout" style="margin-top:16px"><strong>Important:</strong> the risk index is only a game score. It is not a NASA measurement, radiation dose, forecast, or medical estimate.</div></div>
    </div>
    <div class="section-head"><h2>Choose a shelter strategy</h2></div><div class="grid two radiation-options">${strategies.map(([id, title, text]) => `<button class="card strategy-choice" data-radiation-strategy="${id}"><span class="feature-icon">${id === 'water' ? '◌' : id === 'habitat' ? '⬡' : id === 'layered' ? '🛡' : '⚠'}</span><h3>${title}</h3><p>${text}</p><span class="strategy-action">Choose strategy →</span></button>`).join('')}</div><div id="radiation-error" aria-live="polite"></div>
    <div class="callout" style="margin-top:16px"><strong>Space science:</strong> NASA DONKI CME records describe solar events. They do not measure radiation dose inside this outpost.</div>
    <div class="section-head"><h2>Resource chart</h2></div>${resourceChart(mission)}`;
}

function communicationsPage() {
  const communications = state.mission.communications;
  const pending = communications.messages.some((message) => message.status === 'in-transit');
  return `${pageHead(`RADIO ROOM · ${state.mission.destination.toUpperCase()}`, 'Talk to Earth—or decide locally.', 'Send a message, see how long it would take in this simulation, then advance the mission clock to receive a practice reply.') }
    <div class="comms-delay-card card"><div class="delay-planet" aria-hidden="true">${state.mission.destination === 'mars' ? '🔴' : '🌙'}</div><div><div class="tiny-label">${state.mission.destination === 'mars' ? 'MARS–EARTH PRACTICE LINK' : 'MOON–EARTH PRACTICE LINK'}</div><h2 style="margin:8px 0">${esc(communications.delayLabel)}</h2><p>${state.mission.destination === 'mars' ? 'Real Mars–Earth light time changes with the planets’ positions. The 12-minute one-way delay here is a fixed practice example.' : 'The Moon is much closer to Earth. This simulator uses an approximately 1.3-second one-way practice delay.'}</p><div class="stat-detail">Power packets ready: ${communications.poweredPackets} · Power these in the Power Management simulator.</div></div></div>
    <div class="grid two comms-workspace" style="margin-top:16px"><form class="card" id="comms-form"><div class="tiny-label">SEND A MESSAGE</div><label class="field" for="message-text">Your message to mission control</label><textarea class="input text-area" id="message-text" name="message" maxlength="160" required placeholder="We have checked our water recycler…"></textarea><div class="stat-detail">Messages use a power packet from your communications allocation.</div><div id="comms-error" aria-live="polite"></div><button class="button small" style="margin-top:14px" type="submit" ${communications.poweredPackets < 1 ? 'disabled' : ''}>Send message →</button>${communications.poweredPackets < 1 ? '<a class="button small secondary" style="margin:14px 0 0 8px" href="#/power">Allocate radio power</a>' : ''}</form>
      <div class="card"><div class="tiny-label">CREW CHOICE WHILE WAITING</div><h3>What should your crew do?</h3><p>Even a good message cannot make Earth answer sooner. A trained crew can make a careful local plan.</p><div class="choice-list">${[['act','Use crew training','Act locally and keep a small science bonus.'],['shelter','Shelter and wait safely','Use a little water and power to protect the crew.'],['conserve','Conserve supplies','Save supplies and keep the crew steady.'],['wait','Wait for mission control','Uses power and time; requires a pending reply.']].map(([id,title,copy]) => `<button class="event-choice comms-decision" data-comms-decision="${id}" ${id === 'wait' && !pending ? 'disabled' : ''}><strong>${title}</strong><br>${copy}</button>`).join('')}</div><div id="comms-decision-error" aria-live="polite"></div></div></div>
    <div class="section-head"><h2>Message log</h2><button class="button small secondary" id="advance-comms" ${!pending ? 'disabled' : ''}>Fast-forward the simulated delay →</button></div>
    <div class="card message-log">${communications.messages.length ? communications.messages.slice().reverse().map((message) => `<article class="message-entry"><div><strong>To Earth:</strong> ${esc(message.text)}</div><span class="badge ${message.status === 'replied' ? 'live' : 'demo'}">${message.status === 'replied' ? 'REPLY RECEIVED' : 'IN TRANSIT'}</span><div class="stat-detail">Practice delay: ${esc(message.delayLabel)}</div>${message.reply ? `<div class="callout"><strong>Mission control:</strong> ${esc(message.reply)}</div>` : ''}</article>`).join('') : '<p>No messages yet. Allocate radio power, then send your first note.</p>'}</div>`;
}

function eventsPage() {
  if (!state.mission) return `${pageHead('MISSION CHALLENGES', 'Your crew is standing by.', 'Choose the Moon or Mars to begin solving real outpost challenges.') }<a class="button" href="#/select">Launch a mission →</a>`;
  if (!state.scenarios.length) return `${pageHead('MISSION CHALLENGES', 'Challenge data is unavailable.', 'We could not load the mission events. Check your connection and try again.') }<div class="error-box" role="alert">${esc(state.scenariosError || 'Mission events could not be loaded.')}</div><button class="button small secondary" id="retry-scenarios">Try again</button>`;
  const index = state.mission.decisions.length;
  if (state.mission.completed || index >= state.scenarios.length) return `${pageHead('MISSION CHALLENGES', 'All challenges complete!', 'Your outpost crew made it through every event. See what your decisions taught you.') }<a class="button" href="#/results">See your mission report →</a>`;
  const event = state.scenarios[index];
  const solarBriefing = event.id === 'solar-storm'
    ? '<div class="solar-briefing card" id="solar-briefing" aria-live="polite"><div class="skeleton">Checking NASA space-weather observations…</div></div>'
    : '';
  return `${pageHead(`CHALLENGE ${index + 1} OF ${state.scenarios.length} · ${state.mission.destination.toUpperCase()} OUTPOST`, 'A new event needs your help.', 'Think about your crew and supplies, choose a plan, then read what happens.') }
    ${solarBriefing}
    <article class="card event-card" style="margin-top:23px"><div class="eyebrow event-type">${esc(event.type)}</div><h2 style="margin:11px 0 7px">${esc(event.title)}</h2><p>${esc(event.description)}</p><div class="callout" style="margin-top:16px"><strong>Space science:</strong> ${esc(event.science)}</div><div class="choice-list" id="choices">${event.choices.map((choice, i) => `<button class="event-choice" data-choice="${esc(choice.id)}"><strong>${i + 1}.</strong> ${esc(choice.label)} <span aria-hidden="true">→</span></button>`).join('')}</div><div id="event-feedback" class="feedback" aria-live="polite"></div></article>
    <div class="section-head"><h2>Supplies before you decide</h2><a class="button small secondary" href="#/resources">All systems →</a></div>${statCards(state.mission.resources, state.mission.crewSafety)}`;
}

async function resultsPage() {
  const historyData = await api('/api/missions/history');
  const history = historyData.missions || [];
  const latest = state.mission?.completed ? state.mission : history.find((mission) => mission.id === state.mission?.id);
  let report = null;
  if (latest?.completed && state.mission?.completed && latest.id === state.mission.id) {
    const result = await api(`/api/missions/${latest.id}`);
    report = result.mission;
  }
  const currentReport = state.mission?.completed ? report : null;
  return `${pageHead('MISSION DEBRIEF', 'Every astronaut learns from every mission.', 'See how your outpost did, celebrate smart ideas, and learn what you would try next time.') }
    ${currentReport ? renderReport(currentReport) : `<div class="card" style="margin-top:20px"><h3>${state.mission ? 'Your mission is in progress' : 'No finished mission yet'}</h3><p>${state.mission ? 'Finish all six challenges to unlock your final score and achievements.' : 'Launch your first outpost mission, then come back here for its report.'}</p><a class="button small" style="margin-top:15px" href="#/${state.mission ? 'events' : 'select'}">${state.mission ? 'Continue mission' : 'Start a mission'} →</a></div>`}
    <div class="section-head"><h2>Mission history</h2></div><div class="card">${history.length ? history.map((mission) => `<div class="history-item"><span><strong>${esc(mission.playerName)}</strong><span class="muted"> · ${esc(mission.destination.toUpperCase())} · ${mission.completed ? 'Complete' : 'In progress'}</span></span><strong>${Number(mission.score) || 0} pts</strong></div>`).join('') : '<p>No missions yet. Your next adventure will appear here.</p>'}</div>`;
}

function renderReport(mission) {
  const decisions = mission.decisions || [];
  const score = mission.score || 0;
  const safety = Number(mission.crewSafety ?? Math.round((mission.resources.oxygen + mission.resources.water + mission.resources.shielding) / 3));
  const average = Math.round(Object.values(mission.resources).reduce((a, b) => a + b, 0) / 5);
  const careful = decisions.filter((item) => !Object.values(item.effects).some((value) => value <= -15)).length + (mission.smartChoices || 0);
  const science = decisions.reduce((sum, item) => sum + Math.max(item.effects.science || 0, 0), 0) + (mission.scienceCredits || 0);
  const awards = missionAchievements(mission).filter((achievement) => achievement.earned);
  return `<div class="grid two report-hero"><div class="card report-score-card"><div class="score-ring" role="img" aria-label="Mission score ${score} out of 100" style="--score:${score}%"><strong>${score}</strong></div><div><div class="eyebrow">FINAL MISSION SCORE</div><h2>${score >= 80 ? 'Stellar commander!' : score >= 60 ? 'Great space teamwork!' : 'You learned and adapted!'}</h2><p class="muted">${esc(mission.playerName)} · ${mission.destination.toUpperCase()} outpost</p></div></div><div class="card report-achievements"><div class="tiny-label">ACHIEVEMENTS EARNED</div><div class="achievement-report-list">${awards.length ? awards.map((award) => `<div class="achievement-report-item"><span aria-hidden="true">✦</span><strong>${award.name}</strong></div>`).join('') : '<p>Every mission is a chance to practice a new skill. Keep exploring!</p>'}</div></div></div>
    <div class="section-head"><h2>What went well</h2></div><div class="grid two"><div class="card">${[['Resource care', average], ['Crew safety', safety], ['Smart decisions', Math.min(100, Math.round(careful / 6 * 100))], ['Science', Math.min(100, science * 2)]].map(([label, amount]) => `<div style="margin:13px 0"><div style="display:flex;justify-content:space-between;font-size:11px"><span>${label}</span><strong>${amount}/100</strong></div><div class="progress-track"><span style="width:${amount}%"></span></div></div>`).join('')}</div><div class="card"><div class="tiny-label">YOUR FINAL SUPPLIES</div>${Object.entries(mission.resources).map(([key, amount]) => `<div class="history-item"><span>${resourceInfo[key].icon} ${resourceInfo[key].unit}</span><strong>${amount}%</strong></div>`).join('')}<div class="history-item"><span>🥬 Plants harvested</span><strong>${mission.garden?.harvestedPlants || 0}</strong></div><div class="history-item"><span>🛡 Simulated shelter risk index</span><strong>${mission.radiation?.riskIndex ?? '—'}</strong></div><div class="history-item"><span>⚡ Power plans completed</span><strong>${mission.powerLog?.length || 0}</strong></div></div></div>
    <div class="section-head"><h2>Decisions & lessons</h2></div><div class="grid two">${decisions.map((decision) => `<article class="card lesson-card"><div class="tiny-label">${esc(decision.scenarioTitle)}</div><h3 style="margin:9px 0">${esc(decision.choiceLabel)}</h3><p>${esc(decision.explanation)}</p></article>`).join('')}</div>
    <div class="callout" style="margin-top:16px"><strong>Outpost science:</strong> oxygen supports breathing; water supports people and plants; food takes time to grow; power runs your systems; and shelter helps protect a crew from radiation.</div>`;
}

async function dataPage() {
  const results = await Promise.allSettled([api('/api/nasa/apod'), api('/api/nasa/space-weather')]);
  state.apod = results[0].status === 'fulfilled' ? results[0].value : { status: 'sample', source: 'NASA APOD', error: results[0].reason.message, explanation: 'NASA APOD could not be reached. Try refreshing in a moment.', title: 'Image unavailable', url: null };
  state.weather = results[1].status === 'fulfilled' ? results[1].value : { status: 'sample', source: 'NASA DONKI', error: results[1].reason.message, events: [] };
  const image = state.apod.media_type === 'image' && state.apod.url ? `<img class="data-image" src="${esc(state.apod.url)}" alt="${esc(state.apod.title)}">` : `<div class="card" style="height:145px;margin-bottom:13px;display:grid;place-items:center;background:radial-gradient(circle,#263e74,#0d1426 70%)"><span style="font-size:42px">✧</span></div>`;
  const statusLabel = (record) => `<span class="badge ${record.status === 'live' ? 'live' : 'demo'}">${record.status === 'live' ? 'LIVE NASA DATA' : 'SAMPLE DATA · NOT LIVE'}</span>`;
  return `${pageHead('NASA DATA EXPLORER', 'Space is full of discoveries.', 'Explore NASA space information. If NASA’s API is unavailable or not configured, we show a labeled sample instead of pretending it is live.') }
    <div class="grid two nasa-data-grid" style="margin-top:22px"><article class="card nasa-data-card apod-card"><div class="nasa-card-heading"><div class="tiny-label">ASTRONOMY PICTURE OF THE DAY</div>${statusLabel(state.apod)}</div>${image}<h3>${esc(state.apod.title || 'NASA image')}</h3><p>${esc(state.apod.explanation || '')}</p>${state.apod.error ? `<div class="error-box">${esc(state.apod.error)}</div>` : ''}<div class="stat-detail" style="margin-top:13px">Image and description: ${esc(state.apod.source || 'NASA APOD')}${state.apod.date ? ` · ${esc(state.apod.date)}` : ''} · NASA</div></article>
    <article class="card nasa-data-card donki-card"><div class="nasa-card-heading"><div class="tiny-label">RECENT SOLAR ACTIVITY</div>${statusLabel(state.weather)}</div><h3>Space-weather watch</h3><p>NASA’s DONKI tracks solar activity scientists observe in space.</p><div class="nasa-event-list">${(state.weather.events || []).length ? state.weather.events.map((event) => `<div class="history-item" style="align-items:flex-start"><span><strong>${esc(event.eventType)}</strong><br><span class="stat-detail">${esc(event.note || '')}</span></span><span class="stat-detail">${esc(event.eventDate)}</span></div>`).join('') : '<p>No events are available right now.</p>'}</div>${state.weather.error ? `<div class="error-box">${esc(state.weather.error)}</div>` : ''}<div class="stat-detail" style="margin-top:13px">Source: ${esc(state.weather.source || 'NASA DONKI')}</div></article></div>
    <div class="section-head"><h2>Why real space data matters</h2></div><div class="callout"><strong>Real missions use real observations.</strong> Solar activity can affect satellites and astronauts. NASA data helps us learn how scientists watch the Sun and plan safe journeys.</div><div style="margin-top:15px"><a class="button small secondary" href="#/about">See all data sources →</a></div>`;
}

function aboutPage() {
  return `${pageHead('OUR MISSION', 'Big space ideas, made kid-sized.', 'ASTRA COMMAND is a junior astronaut mission trainer for explorers aged 7–12. It makes real outpost trade-offs easier to understand through hands-on play.') }
    <div class="section-head"><h2>Learn by making mission choices</h2></div><div class="grid three"><article class="card"><span class="feature-icon">⚖</span><h3>Trade-offs are real</h3><p>Choosing one helpful action may use water, power, time, or another limited resource. There is no magic button.</p></article><article class="card"><span class="feature-icon">♥</span><h3>Safety comes first</h3><p>Smart crews protect one another and make a plan before a challenge gets worse.</p></article><article class="card"><span class="feature-icon">✧</span><h3>Curiosity counts</h3><p>Each decision includes an easy science explanation to help you learn for your next mission.</p></article></div>
    <div class="section-head"><h2>Data sources & honesty</h2></div><div class="grid two"><article class="card"><div class="tiny-label">NASA APOD</div><h3>Astronomy Picture of the Day</h3><p>When a NASA_API_KEY is configured on the server, the app requests NASA’s APOD service. Only returned NASA images are shown as live images.</p><div class="stat-detail" style="margin-top:12px">Source: NASA APOD API · api.nasa.gov</div></article><article class="card"><div class="tiny-label">NASA DONKI</div><h3>Space-weather events</h3><p>When an API key is configured, the app requests recent coronal mass ejection reports from NASA’s DONKI space-weather database.</p><div class="stat-detail" style="margin-top:12px">Source: NASA DONKI CME API · api.nasa.gov/DONKI</div></article><article class="card"><div class="tiny-label">SAMPLE MODE</div><h3>Clear labels, always</h3><p>If a NASA key is missing or NASA’s service cannot be reached, the app clearly marks its fallback content as sample data—not as a real event or live image.</p></article><article class="card"><div class="tiny-label">MORE TO EXPLORE</div><h3>Keep asking questions</h3><p>NASA publishes additional planetary imagery and research datasets. This version uses the stable APOD and DONKI APIs and does not claim unconnected RadLab, OSDR, or Mars Trek integrations.</p></article></div>
    <div class="callout" style="margin-top:17px"><strong>Built for learning.</strong> Simulation resource numbers are part of the game—not real spacecraft measurements or medical advice.</div>`;
}

function showActionError(id, error) {
  const output = document.getElementById(id);
  if (output) output.innerHTML = `<div class="error-box" role="alert">${esc(error.message)}</div>`;
}

async function submitSystemAction(url, body, successMessage) {
  const result = await api(url, { method: 'POST', body: JSON.stringify(body || {}) });
  state.mission = result.mission || result;
  state.notice = typeof successMessage === 'function' ? successMessage(result) : successMessage;
  await render();
}

async function renderSolarBriefing() {
  const container = document.getElementById('solar-briefing');
  if (!container) return;
  try {
    const briefing = await api(`/api/missions/${state.mission.id}/briefing`);
    const isLive = briefing.status === 'live';
    const event = briefing.latestObservation;
    container.innerHTML = `    <div class="solar-briefing-head"><div class="tiny-label">NASA SPACE-WEATHER MISSION BRIEFING</div><span class="badge ${isLive ? 'live' : 'demo'}">${isLive ? 'LIVE NASA OBSERVATION' : 'SAMPLE DATA · NOT LIVE'}</span></div>
      <h3>${event ? `Recent observation · ${esc(event.eventDate)}` : isLive ? 'No recent CME report in this time window' : 'No live NASA observation available'}</h3>
      <p>${event ? esc(event.note || 'NASA DONKI reported a recent coronal mass ejection.') : briefing.status === 'live' ? 'NASA DONKI returned no CME records for this recent time window.' : 'This is a clearly labeled sample fallback, not a live solar event.'}</p>
      <div class="stat-detail">Source: ${esc(briefing.source)} · ${esc(briefing.note)}</div>
      <div class="callout" style="margin-top:12px"><strong>Safety reminder:</strong> CME reports describe solar activity. They are not a radiation dose, a local outpost reading, or a forecast that your crew is in danger.</div>`;
  } catch (error) {
    container.innerHTML = `<div class="error-box" role="alert">Could not load the NASA briefing: ${esc(error.message)} The shelter exercise still works.</div>`;
  }
}

async function bindPage(page) {
  document.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('mobile-overlay').classList.remove('show');
  }));
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    const open = document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('mobile-overlay').classList.toggle('show', open);
  });
  document.getElementById('mobile-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('mobile-overlay').classList.remove('show');
  });
  document.getElementById('retry-scenarios')?.addEventListener('click', render);
  document.querySelectorAll('[data-destination]').forEach((button) => button.addEventListener('click', () => {
    state.selectedDestination = button.dataset.destination;
    document.querySelectorAll('[data-destination]').forEach((item) => item.classList.toggle('selected', item === button));
  }));
  document.getElementById('mission-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const output = document.getElementById('form-message');
    button.disabled = true;
    button.textContent = 'Preparing your outpost…';
    try {
      const { mission } = await api('/api/missions', { method: 'POST', body: JSON.stringify({ playerName: document.getElementById('player-name').value, destination: state.selectedDestination }) });
      state.mission = mission;
      state.scenarios = (await api(`/api/missions/scenarios?destination=${mission.destination}`)).scenarios;
      saveMissionId(mission.id);
      go('control');
    } catch (error) {
      output.innerHTML = `<div class="error-box" role="alert">${esc(error.message)}</div>`;
      button.disabled = false;
      button.textContent = 'Launch mission 🚀';
    }
  });
  document.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', async () => {
    const output = document.getElementById('event-feedback');
    const originalLabel = button.innerHTML;
    const buttons = [...document.querySelectorAll('[data-choice]')];
    buttons.forEach((item) => { item.disabled = true; });
    button.textContent = 'Sending your decision…';
    try {
      const event = state.scenarios[state.mission.decisions.length];
      const result = await api(`/api/missions/${state.mission.id}/decisions`, { method: 'POST', body: JSON.stringify({ scenarioId: event.id, choiceId: button.dataset.choice }) });
      state.mission = result.mission;
      output.innerHTML = `<div class="callout"><strong>Mission update:</strong> ${esc(result.choice.explanation)}</div><a class="button small" style="margin-top:13px" href="#/${result.mission.completed ? 'results' : 'control'}">${result.mission.completed ? 'Finish mission & see report' : 'Update mission control'} →</a>`;
      document.querySelectorAll('[data-choice]').forEach((item) => item.remove());
    } catch (error) {
      output.innerHTML = `<div class="error-box" role="alert">${esc(error.message)}</div>`;
      buttons.forEach((item) => { item.disabled = false; });
      button.innerHTML = originalLabel;
    }
  }));
  document.getElementById('garden-plant-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await submitSystemAction(`/api/missions/${state.mission.id}/garden/plant`, {
        count: Number(document.getElementById('seed-count').value)
      }, 'Seeds planted. They need enough water and garden light to grow.');
    } catch (error) { showActionError('garden-plant-error', error); }
  });
  document.getElementById('garden-day-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const result = await api(`/api/missions/${state.mission.id}/garden/day`, {
        method: 'POST',
        body: JSON.stringify({
          waterAllocation: Number(document.getElementById('garden-water').value),
          electricityAllocation: Number(document.getElementById('garden-electricity').value)
        })
      });
      state.mission = result.mission;
      state.notice = result.message;
      await render();
    } catch (error) { showActionError('garden-day-error', error); }
  });
  document.getElementById('garden-harvest')?.addEventListener('click', async () => {
    try {
      await submitSystemAction(`/api/missions/${state.mission.id}/garden/harvest`, {}, (result) => `Harvested ${result.harvested} plant${result.harvested === 1 ? '' : 's'} and added ${result.foodAdded} food units.`);
    } catch (error) { showActionError('garden-harvest-error', error); }
  });
  document.querySelectorAll('.power-input').forEach((input) => input.addEventListener('input', () => {
    const values = [...document.querySelectorAll('.power-input')].map((item) => Number(item.value) || 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const available = state.mission.resources.power;
    const minimum = state.mission.destinationProfile.powerMinimum;
    document.getElementById('power-total').textContent = total;
    document.getElementById('allocation-bar-fill').style.width = `${Math.min(100, total / Math.max(available, 1) * 100)}%`;
    document.getElementById('power-summary').textContent = total > available
      ? `Over budget by ${total - available} power units. Reduce an allocation.`
      : values[0] < minimum
        ? `Life support needs at least ${minimum} units at this destination.`
        : `${total} power units will be used. Unallocated electricity stays in storage.`;
    document.querySelector('#power-form button[type="submit"]').disabled = total > available || values[0] < minimum;
  }));
  document.getElementById('power-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries([...document.querySelectorAll('.power-input')].map((input) => [input.name, Number(input.value)]));
    try {
      await submitSystemAction(`/api/missions/${state.mission.id}/power`, values, 'Power plan applied. Garden-light credits and radio packets are ready for their simulators.');
    } catch (error) { showActionError('power-error', error); }
  });
  document.querySelectorAll('[data-radiation-strategy]').forEach((button) => button.addEventListener('click', async () => {
    document.querySelectorAll('[data-radiation-strategy]').forEach((item) => { item.disabled = true; });
    try {
      await submitSystemAction(`/api/missions/${state.mission.id}/radiation`, { strategy: button.dataset.radiationStrategy }, 'Shelter strategy applied. The risk index is a game value, never a radiation dose.');
    } catch (error) {
      showActionError('radiation-error', error);
      document.querySelectorAll('[data-radiation-strategy]').forEach((item) => { item.disabled = false; });
    }
  }));
  document.getElementById('comms-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await submitSystemAction(`/api/missions/${state.mission.id}/communications/messages`, {
        message: document.getElementById('message-text').value
      }, 'Message sent. The simulated radio delay is now in progress.');
    } catch (error) { showActionError('comms-error', error); }
  });
  document.getElementById('advance-comms')?.addEventListener('click', async () => {
    try {
      await submitSystemAction(`/api/missions/${state.mission.id}/communications/advance`, {}, 'Simulated delay complete. Mission control has replied.');
    } catch (error) { showActionError('comms-decision-error', error); }
  });
  document.querySelectorAll('[data-comms-decision]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await submitSystemAction(`/api/missions/${state.mission.id}/communications/decision`, {
        choice: button.dataset.commsDecision
      }, 'Local crew choice recorded. Your crew can act while a message is traveling.');
    } catch (error) { showActionError('comms-decision-error', error); }
  }));
  if (page === 'events' && state.mission && state.scenarios[state.mission.decisions.length]?.id === 'solar-storm') {
    await renderSolarBriefing();
  }
  if (page === 'results' || page === 'data') {
    try {
      const html = page === 'results' ? await resultsPage() : await dataPage();
      document.querySelector('.page').innerHTML = `${html}<p class="footer-note">Made for curious explorers ages 7–12 · Learn by choosing, trying, and trying again.</p>`;
    } catch (error) {
      document.querySelector('.page').insertAdjacentHTML('afterbegin', `<div class="error-box" role="alert">Couldn’t load this information. ${esc(error.message)} <button class="button small secondary" id="retry-page">Try again</button></div>`);
      document.getElementById('retry-page')?.addEventListener('click', render);
    }
  }
}

async function render() {
  let page = currentPage();
  if (!pageTitles[page]) page = 'home';
  if (!state.scenarios.length) {
    try {
      state.scenarios = (await api(`/api/missions/scenarios?destination=${state.mission?.destination || state.selectedDestination}`)).scenarios;
      state.scenariosError = null;
    } catch (error) {
      state.scenarios = [];
      state.scenariosError = error.message;
    }
  }
  const contents = {
    home: homePage,
    briefing: briefingPage,
    select: selectPage,
    control: controlPage,
    outpost: outpostPage,
    resources: () => resourcePage('resources'),
    radiation: () => resourcePage('radiation'),
    power: () => resourcePage('power'),
    food: () => resourcePage('food'),
    comms: () => resourcePage('comms'),
    events: eventsPage,
    results: () => `${pageHead('MISSION DEBRIEF', 'Loading mission report…', 'Please wait while we load your mission history.')}`,
    data: () => `${pageHead('NASA DATA EXPLORER', 'Loading space data…', 'Checking NASA’s public data services.')}`,
    about: aboutPage
  };
  let content = (contents[page] || homePage)();
  if (state.notice) {
    content = `<div class="callout action-notice" role="status"><strong>Outpost update:</strong> ${esc(state.notice)}</div>${content}`;
    state.notice = null;
  }
  app.innerHTML = layout(page, content);
  document.title = `${pageTitles[page]} — ASTRA COMMAND`;
  const bindings = bindPage(page);
  try {
    const health = await api('/api/health');
    const badge = document.getElementById('storage-badge');
    badge.textContent = health.storage === 'mysql' ? 'MYSQL CONNECTED' : 'DEMO MODE';
    badge.className = `badge ${health.storage === 'mysql' ? 'live' : 'demo'}`;
  } catch {
    const badge = document.getElementById('storage-badge');
    badge.textContent = 'SERVER OFFLINE';
    badge.className = 'badge demo';
  }
  await bindings;
}

async function startApp() {
  const id = savedMissionId();
  if (id) {
    try {
      const { mission } = await api(`/api/missions/${encodeURIComponent(id)}`);
      state.mission = mission;
    } catch (error) {
      if (error.status === 404) {
        clearSavedMissionId();
        state.notice = 'Your saved mission is no longer available. Create a new mission to continue.';
      } else {
        state.notice = 'Could not restore your saved mission. Its ID is saved; try again when the server is available.';
      }
    }
  }
  window.addEventListener('hashchange', render);
  await render();
}

startApp();
