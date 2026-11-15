const mysql = require('mysql2/promise');

let pool;

function isDatabaseConfigured() {
  return Boolean(process.env.MYSQL_DATABASE);
}

function isDatabaseEnabled() {
  return Boolean(pool);
}

async function initializeDatabase() {
  pool = null;
  if (!isDatabaseConfigured()) return;

  const candidatePool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4'
  });

  try {
    await candidatePool.query(`
      CREATE TABLE IF NOT EXISTS astra_command_missions (
        id CHAR(36) PRIMARY KEY,
        destination VARCHAR(12) NOT NULL,
        player_name VARCHAR(32) NOT NULL,
        state_json JSON NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX mission_history (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await candidatePool.query(`
      CREATE TABLE IF NOT EXISTS astra_command_mission_decisions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        mission_id CHAR(36) NOT NULL,
        scenario_id VARCHAR(40) NOT NULL,
        choice_id VARCHAR(40) NOT NULL,
        explanation VARCHAR(500) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX decision_history (mission_id),
        CONSTRAINT fk_astra_decision_mission FOREIGN KEY (mission_id) REFERENCES astra_command_missions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    pool = candidatePool;
  } catch (error) {
    console.error(
      `Could not initialize ASTRA COMMAND database (${error.code || 'unknown error'}); continuing in demo mode.`
    );
    try {
      await candidatePool.end();
    } catch (closeError) {
      console.error(
        `Could not close ASTRA COMMAND database pool (${closeError.code || 'unknown error'}).`
      );
    }
  }
}

async function getMission(id) {
  if (!pool) return null;
  const [rows] = await pool.execute('SELECT state_json FROM astra_command_missions WHERE id = ?', [id]);
  return rows.length ? rows[0].state_json : null;
}

async function createMission(mission) {
  if (!pool) return;
  await pool.execute(
    'INSERT INTO astra_command_missions (id, destination, player_name, state_json) VALUES (?, ?, ?, ?)',
    [mission.id, mission.destination, mission.playerName, JSON.stringify(mission)]
  );
}

async function saveMission(mission, decision) {
  if (!pool) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('UPDATE astra_command_missions SET state_json = ? WHERE id = ?', [JSON.stringify(mission), mission.id]);
    await connection.execute(
      'INSERT INTO astra_command_mission_decisions (mission_id, scenario_id, choice_id, explanation) VALUES (?, ?, ?, ?)',
      [mission.id, decision.scenarioId, decision.choiceId, decision.explanation]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function saveMissionState(mission) {
  if (!pool) return;
  await pool.execute('UPDATE astra_command_missions SET state_json = ? WHERE id = ?', [JSON.stringify(mission), mission.id]);
}

async function getHistory() {
  if (!pool) return null;
  const [rows] = await pool.query(
    "SELECT id, destination, player_name AS playerName, JSON_UNQUOTE(JSON_EXTRACT(state_json, '$.score')) AS score, JSON_UNQUOTE(JSON_EXTRACT(state_json, '$.completed')) AS completed, created_at AS createdAt FROM astra_command_missions ORDER BY created_at DESC LIMIT 25"
  );
  return rows.map((row) => ({
    ...row,
    score: Number(row.score),
    completed: row.completed === 'true'
  }));
}

module.exports = { initializeDatabase, isDatabaseEnabled, getMission, createMission, saveMission, saveMissionState, getHistory };
