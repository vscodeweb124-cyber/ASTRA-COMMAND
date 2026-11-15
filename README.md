# ASTRA COMMAND

ASTRA COMMAND is a hands-on Moon and Mars outpost mission trainer for curious explorers ages 7–12. Children manage oxygen, water, food, power, and radiation protection while making choices during six space-mission events.

## What is included

- Responsive mission control dashboard and dedicated briefing, destination, outpost, resource, radiation, power, food, communication, challenge, report, data explorer, and about screens.
- Six branching challenges. Choices change outpost resources and crew safety; every choice receives a short science explanation.
- Interactive hydroponics: plant seeds, spend shared water, use garden-light credits from the power plan, simulate growing days, and harvest food into mission supplies.
- Power desk: allocate a limited power budget to life support, communications, garden lights, and science equipment. Destination-specific life-support minimums are enforced by the API.
- Radiation shelter planner: compare water, habitat, layered, and exposed strategies. Its risk index is a game value, never a NASA radiation measurement or dose.
- Radio simulator: power a radio, send a message, practice a destination-specific one-way delay, fast-forward a reply, or make a local crew decision.
- Moon and Mars missions have different starting supplies, environmental challenges, power minimums, dust-event outcomes, and communication delays.
- A final report with a score, achievements, resource ratings, decisions, and lessons.
- Express API with validation, mission history, input limits, and error responses.
- Optional MySQL persistence for missions and system actions. ASTRA uses the `astra_command_missions` and `astra_command_mission_decisions` tables so an existing numeric-ID `missions` table is left untouched. When no MySQL database is configured, the application clearly reports demo mode and saves missions in memory while the server is running.
- Server-side NASA APOD and DONKI proxies. The NASA API key is never included in browser code or API responses. Missing keys and unavailable NASA services produce clearly labeled sample data—not pretend live data. Invalid-key responses, NASA rate limits, timeouts, network errors, and malformed payloads use safe messages and never log the API key or request URL.

The numeric resource levels and shelter risk index are game values, not measurements from a real spacecraft. NASA DONKI coronal mass ejection reports are solar-event observations, not local radiation readings, astronaut dose measurements, or forecasts for the simulated outpost. RadLab, OSDR, and Mars Trek are not claimed as integrated data sources in this version.

## Requirements

- Windows 10/11
- Node.js 20 or newer
- MySQL 8 (optional; demo mode works without it)
- A NASA API key (optional; NASA data cards use labeled sample data until configured)

## Run on Windows

Open **Command Prompt** in this project folder and run:

```cmd
npm install
copy .env.example .env
notepad .env
npm start
```

In the browser, open `http://localhost:3000`.

In `.env`, add your NASA key privately to `NASA_API_KEY`. Keep `.env` on your computer: it is excluded from Git. Never paste the key into `public`, a browser URL, or a screenshot you share. If you leave `MYSQL_DATABASE` blank, the app starts in demo mode.

### Optional MySQL setup

Create the schema from the project folder (the MySQL client must be installed and available in Command Prompt):

```cmd
mysql -u root -p < database\schema.sql
```

Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE=astra_command` in `.env`, then run:

```cmd
npm start
```

The server checks the MySQL connection during startup and creates its tables if needed. If MySQL is configured but unreachable, startup reports the error rather than silently switching to demo mode. Omit `MYSQL_DATABASE` to explicitly use demo mode.

For development with automatic server restarts:

```cmd
npm run dev
```

## API

- `GET /api/health` — server status and selected storage mode.
- `GET /api/missions/scenarios` — event descriptions and available choices.
- `GET /api/missions/scenarios?destination=moon|mars` — destination-specific event descriptions and trade-offs.
- `POST /api/missions` — start a Moon or Mars mission. JSON body: `{"playerName":"Nova","destination":"moon"}`.
- `GET /api/missions/:id` — retrieve the mission state.
- `GET /api/missions/:id/briefing` — recent NASA DONKI observations with an explicit live/sample label and safety context.
- `POST /api/missions/:id/decisions` — apply a decision. JSON body: `{"scenarioId":"solar-storm","choiceId":"shelter"}`.
- `POST /api/missions/:id/garden/plant` — plant seeds. JSON body: `{"count":2}`.
- `POST /api/missions/:id/garden/day` — advance a garden day. JSON body: `{"waterAllocation":4,"electricityAllocation":4}`.
- `POST /api/missions/:id/garden/harvest` — harvest plants that have completed three growing days.
- `POST /api/missions/:id/power` — allocate power. JSON body: `{"lifeSupport":28,"communication":4,"gardenLights":8,"scienceEquipment":4}`. Allocations must fit the shared power supply and destination life-support minimum.
- `POST /api/missions/:id/radiation` — apply a shielding strategy. JSON body: `{"strategy":"water"}`. Options: `water`, `habitat`, `layered`, and `exposed`.
- `POST /api/missions/:id/communications/messages` — send a message using an allocated radio power packet. JSON body: `{"message":"Recycler checked."}`.
- `POST /api/missions/:id/communications/decision` — choose a local action while waiting. JSON body: `{"choice":"act"}`. Options: `act`, `shelter`, `conserve`, and `wait`.
- `POST /api/missions/:id/communications/advance` — advance the simulator clock to receive the next practice reply.
- `GET /api/missions/history` — recent missions.
- `GET /api/nasa/apod` — server-proxied NASA Astronomy Picture of the Day.
- `GET /api/nasa/space-weather` — server-proxied NASA DONKI coronal mass ejections.

## Testing

```cmd
npm test
```

Run `npm test` for campaign, simulator, and NASA proxy behavior tests. Open the application to exercise destination selection, power allocation, planting/growing/harvesting, shelter strategies, message sending/replies, mission decisions, and the final report. Check `/api/health` to see whether this run is using demo or MySQL storage. NASA service calls use the server-side key; the browser never receives it. NASA errors and rate limits result in labeled sample data.

## Data sources

- NASA Astronomy Picture of the Day (APOD): `https://api.nasa.gov/planetary/apod`
- NASA DONKI coronal mass ejection reports: `https://api.nasa.gov/DONKI/CME`

NASA data is retrieved by the server, not directly by browser code. NASA source attribution and live/sample status are displayed in the data explorer.
